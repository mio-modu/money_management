import { daysAgo, lastMonths, shiftMonth, thisMonth, today, ym } from '../date'
import { pct, shortWon, won } from '../format'
import type { DB, Severity } from '../types'
import { avg, sum } from '../utils'
import {
  avgMonthlyExpense,
  budgetLines,
  categoryMap,
  emergencyMonths,
  fixedProfile,
  flowSeries,
  gradeMix,
  monthFlow,
  monthTx,
  monthlyAmount,
  netWorthSeries,
  noSpendStreak,
  rootOf,
  spendable,
  yearlyAmount,
} from '../finance/selectors'
import { taxView } from '../finance/tax'

export interface RuleContext {
  db: DB
  month: string
  now: Date
  /** 사용자가 조절한 임계값. 없으면 규칙 기본값 */
  p: (key: string) => number
}

export interface Finding {
  /** 같은 상황이면 같은 키 — 중복 알림을 막는다 */
  key: string
  severity: Severity
  title: string
  /** 상황 설명. 숫자를 반드시 포함한다 */
  message: string
  /** 그래서 뭘 해야 하는지 — 한 문장 */
  action: string
  action_label: string
  action_href: string
  /** 우선순위. 클수록 먼저 */
  weight: number
}

export interface RuleDef {
  code: string
  label: string
  /** 설정 화면에 보여줄 설명 */
  about: string
  group: '누수' | '위험' | '강화'
  defaults: Record<string, number>
  evaluate: (ctx: RuleContext) => Finding[]
}

const f = (x: Omit<Finding, 'key'> & { key: string }): Finding => x

// ══════════════════════════════════════════════════════════════
// 누수 탐지
// ══════════════════════════════════════════════════════════════

const ZOMBIE_SUB: RuleDef = {
  code: 'ZOMBIE_SUB',
  label: '좀비 구독',
  about: '마지막 사용일로부터 오래 지난 구독을 찾아 해지하라고 말한다.',
  group: '누수',
  defaults: { days: 60 },
  evaluate: ({ db, p, now }) => {
    const limit = p('days')
    const zombies = db.subscriptions.filter((s) => {
      if (s.status === 'cancelled') return false
      if (!s.last_used_at) return false
      return daysAgo(s.last_used_at, now) >= limit
    })
    if (zombies.length === 0) return []
    const yearly = sum(zombies.map((s) => yearlyAmount(s.amount, s.cycle)))
    const names = zombies.map((s) => s.name).slice(0, 3).join(', ')
    return [
      f({
        key: `ZOMBIE_SUB:${zombies.map((s) => s.id).sort().join(',')}`,
        severity: 'info',
        title: `${limit}일 넘게 안 쓴 구독 ${zombies.length}개`,
        message: `${names}${zombies.length > 3 ? ` 외 ${zombies.length - 3}개` : ''}를 ${limit}일 이상 쓰지 않았다. 이대로 두면 1년에 ${won(yearly)}원이 나간다.`,
        action: `지금 해지하면 연 ${shortWon(yearly)}원이 그대로 남는다.`,
        action_label: '구독 정리하기',
        action_href: '/subscriptions',
        weight: 70 + Math.min(20, Math.round(yearly / 100000)),
      }),
    ]
  },
}

const PRICE_CREEP: RuleDef = {
  code: 'PRICE_CREEP',
  label: '가격 인상',
  about: '정기결제 금액이 전보다 올랐는지 이력으로 비교한다.',
  group: '누수',
  defaults: { min_pct: 5 },
  evaluate: ({ db, p }) => {
    const minPct = p('min_pct')
    const out: Finding[] = []
    for (const s of db.subscriptions) {
      const hist = [...(s.price_history ?? [])].sort((a, b) => a.date.localeCompare(b.date))
      if (hist.length < 2) continue
      const prev = hist[hist.length - 2].amount
      const cur = hist[hist.length - 1].amount
      if (prev <= 0 || cur <= prev) continue
      const up = ((cur - prev) / prev) * 100
      if (up < minPct) continue
      const yearlyDiff = yearlyAmount(cur - prev, s.cycle)
      out.push(
        f({
          key: `PRICE_CREEP:${s.id}:${hist[hist.length - 1].date}`,
          severity: 'warn',
          title: `${s.name} 가격이 ${pct(up, 1)} 올랐다`,
          message: `${won(prev)}원 → ${won(cur)}원. 연간으로 ${won(yearlyDiff)}원을 더 내게 된다.`,
          action: `같은 값을 하는지 다시 따져라. 아니면 요금제를 낮추거나 해지한다.`,
          action_label: '구독 보기',
          action_href: '/subscriptions',
          weight: 60 + Math.min(15, Math.round(up)),
        }),
      )
    }
    return out
  },
}

const DUPLICATE_SERVICE: RuleDef = {
  code: 'DUPLICATE_SERVICE',
  label: '중복 서비스',
  about: '같은 카테고리에 구독이 여러 개면 통합하라고 말한다.',
  group: '누수',
  defaults: { count: 2 },
  evaluate: ({ db, p }) => {
    const threshold = p('count')
    const map = categoryMap(db)
    const groups: Record<string, typeof db.subscriptions> = {}
    for (const s of db.subscriptions) {
      if (s.status === 'cancelled') continue
      const key = s.category_id ?? 'none'
      ;(groups[key] ||= []).push(s)
    }
    const out: Finding[] = []
    for (const [catId, subs] of Object.entries(groups)) {
      if (catId === 'none' || subs.length < threshold) continue
      const monthly = sum(subs.map((s) => monthlyAmount(s.amount, s.cycle)))
      const weakest = [...subs].sort((a, b) => a.value_rating - b.value_rating)[0]
      const save = yearlyAmount(weakest.amount, weakest.cycle)
      out.push(
        f({
          key: `DUPLICATE_SERVICE:${catId}:${subs.map((s) => s.id).sort().join(',')}`,
          severity: 'info',
          title: `${map[catId]?.name ?? '같은 카테고리'} 구독이 ${subs.length}개`,
          message: `${subs.map((s) => s.name).join(', ')} — 월 ${won(monthly)}원이 같은 용도로 나간다.`,
          action: `만족도가 가장 낮은 ${weakest.name}부터 끊으면 연 ${shortWon(save)}원이 남는다.`,
          action_label: '하나로 줄이기',
          action_href: '/subscriptions',
          weight: 55 + subs.length * 3,
        }),
      )
    }
    return out
  },
}

const SMALL_LEAK: RuleDef = {
  code: 'SMALL_LEAK',
  label: '잔돈 누수',
  about: '소액 결제가 잦으면 월 합계로 묶어 보여 준다. 한 건은 작아도 합치면 크다.',
  group: '누수',
  defaults: { amount: 10000, count: 15 },
  evaluate: ({ db, month, p }) => {
    const cap = p('amount')
    const minCount = p('count')
    const smalls = monthTx(db, month).filter((t) => t.direction === 'out' && !t.is_business && t.amount <= cap)
    if (smalls.length <= minCount) return []
    const total = sum(smalls.map((t) => t.amount))
    return [
      f({
        key: `SMALL_LEAK:${month}:${smalls.length}`,
        severity: 'warn',
        title: `${shortWon(cap)}원 이하 결제가 ${smalls.length}건`,
        message: `한 건 평균 ${won(total / smalls.length)}원이지만 합치면 ${won(total)}원이다. 이번 달 지출의 ${pct((total / Math.max(1, monthFlow(db, month).expense)) * 100, 1)}.`,
        action: `가장 많이 찍힌 ${topMerchant(smalls)}부터 주 1회로 줄여라.`,
        action_label: '소액 결제 보기',
        action_href: '/spending',
        weight: 50 + Math.min(20, smalls.length - minCount),
      }),
    ]
  },
}

const IMPULSE_PATTERN: RuleDef = {
  code: 'IMPULSE_PATTERN',
  label: '심야 결제',
  about: '22시~새벽 2시 결제가 잦으면 알려 준다. 그 시간의 결제는 대개 다음 날 후회한다.',
  group: '누수',
  defaults: { count: 3 },
  evaluate: ({ db, month, p }) => {
    const minCount = p('count')
    const late = monthTx(db, month).filter(
      (t) => t.direction === 'out' && t.hour != null && (t.hour >= 22 || t.hour < 2),
    )
    if (late.length <= minCount) return []
    const total = sum(late.map((t) => t.amount))
    return [
      f({
        key: `IMPULSE_PATTERN:${month}:${late.length}`,
        severity: 'warn',
        title: `심야 결제 ${late.length}건 · ${shortWon(total)}원`,
        message: `이번 달 22시~새벽 2시에 ${late.length}번 결제했다. 합계 ${won(total)}원.`,
        action: `장바구니에 담고 다음 날 아침에 다시 보기로 규칙을 하나 만들어라.`,
        action_label: '시간대 패턴 보기',
        action_href: '/spending',
        weight: 48 + late.length,
      }),
    ]
  },
}

const CATEGORY_SPIKE: RuleDef = {
  code: 'CATEGORY_SPIKE',
  label: '카테고리 급증',
  about: '특정 카테고리가 3개월 평균보다 크게 튀면 경고한다.',
  group: '누수',
  defaults: { pct: 150 },
  evaluate: ({ db, month, p }) => {
    const limit = p('pct')
    const prevMonths = lastMonths(3, shiftMonth(month, -1))
    const map = categoryMap(db)
    const out: Finding[] = []

    const cur: Record<string, number> = {}
    for (const t of monthTx(db, month)) {
      if (t.direction !== 'out') continue
      const root = rootOf(db, t.category_id)
      if (!root) continue
      cur[root.id] = (cur[root.id] ?? 0) + t.amount
    }

    for (const [rootId, amount] of Object.entries(cur)) {
      const history = prevMonths.map((m) =>
        sum(
          monthTx(db, m)
            .filter((t) => t.direction === 'out' && rootOf(db, t.category_id)?.id === rootId)
            .map((t) => t.amount),
        ),
      )
      const base = avg(history.filter((h) => h > 0))
      if (!base || amount < base * (limit / 100)) continue
      const over = amount - base
      out.push(
        f({
          key: `CATEGORY_SPIKE:${month}:${rootId}`,
          severity: 'warn',
          title: `${map[rootId]?.name ?? '카테고리'} 지출이 평균의 ${pct((amount / base) * 100, 0)}`,
          message: `3개월 평균 ${won(base)}원 → 이번 달 ${won(amount)}원. ${won(over)}원 더 썼다.`,
          action: `남은 기간 이 카테고리는 더 쓰지 말고, 다른 데서 ${shortWon(over)}원을 줄여 메워라.`,
          action_label: '지출 분석 보기',
          action_href: '/spending',
          weight: 58 + Math.min(20, Math.round((amount / base - 1) * 20)),
        }),
      )
    }
    return out
  },
}

// ══════════════════════════════════════════════════════════════
// 위험 신호
// ══════════════════════════════════════════════════════════════

const BUDGET_PACE: RuleDef = {
  code: 'BUDGET_PACE',
  label: '예산 소진 속도',
  about: '월 경과율보다 예산 소진율이 빠르면 경고한다.',
  group: '위험',
  defaults: { gap_pp: 20 },
  evaluate: ({ db, month, p, now }) => {
    if (ym(now) !== month) return []
    const gap = p('gap_pp')
    const sp = spendable(db, month, now)
    if (sp.budget <= 0 || sp.paceGapPp < gap) return []
    const overspent = Math.round((sp.paceGapPp / 100) * sp.budget)
    return [
      f({
        key: `BUDGET_PACE:${month}:${Math.round(sp.paceGapPp / 5)}`,
        severity: sp.usedPct >= 100 ? 'danger' : 'warn',
        title: `예산 소진이 ${pct(sp.paceGapPp, 0)} 빠르다`,
        message: `${now.getDate()}일 기준 예산의 ${pct(sp.usedPct, 0)}를 썼다. 날짜 비율보다 ${won(overspent)}원 앞서 있다.`,
        action:
          sp.remain <= 0
            ? `이번 달 예산을 ${shortWon(-sp.remain)}원 넘겼다. 남은 ${sp.daysLeft}일은 꼭 필요한 것만 쓰고, 다음 달 예산을 다시 잡아라.`
            : sp.daysLeft > 0
              ? `남은 ${sp.daysLeft}일을 하루 ${won(sp.perDay)}원으로 묶어라.`
              : `다음 달 예산을 ${shortWon(sp.budget + overspent)}원으로 다시 잡아라.`,
        action_label: '예산 조정',
        action_href: '/budget',
        weight: 75 + Math.min(15, Math.round(sp.paceGapPp / 3)),
      }),
    ]
  },
}

const FIXED_RATIO_HIGH: RuleDef = {
  code: 'FIXED_RATIO_HIGH',
  label: '고정지출 과다',
  about: '고정지출이 수입의 절반을 넘으면 구조 문제다. 변동지출을 아껴도 복구가 안 된다.',
  group: '위험',
  defaults: { pct: 50 },
  evaluate: ({ db, month, p }) => {
    const limit = p('pct')
    const { ratio, fixedBase, incomeBase } = fixedProfile(db, month)
    if (ratio < limit || fixedBase <= 0) return []
    const target = (incomeBase * limit) / 100
    return [
      f({
        key: `FIXED_RATIO_HIGH:${month}:${Math.round(ratio / 5)}`,
        severity: 'danger',
        title: `고정지출이 수입의 ${pct(ratio, 0)}`,
        message: `월 수입 ${won(incomeBase)}원 중 ${won(fixedBase)}원이 들어오기 전에 이미 정해져 나간다. ${limit}%가 경고선이다.`,
        action: `주거·통신·보험·구독 중 가장 큰 것 하나를 ${shortWon(fixedBase - target)}원 줄이는 것부터 손대라. 변동지출을 아껴서는 복구되지 않는다.`,
        action_label: '현금흐름 보기',
        action_href: '/cashflow',
        weight: 88,
      }),
    ]
  },
}

const EMERGENCY_FUND_LOW: RuleDef = {
  code: 'EMERGENCY_FUND_LOW',
  label: '비상자금 부족',
  about: '현금성 자산이 월 평균 지출의 3개월분보다 적으면 경고한다.',
  group: '위험',
  defaults: { months: 3 },
  evaluate: ({ db, p }) => {
    const need = p('months')
    const have = emergencyMonths(db)
    const monthly = avgMonthlyExpense(db)
    if (!monthly || have >= need) return []
    const gap = monthly * need - have * monthly
    return [
      f({
        key: `EMERGENCY_FUND_LOW:${Math.round(have * 10)}`,
        severity: have < 1 ? 'danger' : 'warn',
        title: `비상자금 ${have.toFixed(1)}개월분`,
        message: `월 평균 지출 ${won(monthly)}원 대비 ${need}개월분(${won(monthly * need)}원)이 최소선이다. ${won(gap)}원 모자란다.`,
        action: `목표에 "비상자금 ${shortWon(monthly * need)}원"을 1순위로 걸고 매달 먼저 떼어 둬라.`,
        action_label: '목표 만들기',
        action_href: '/goals',
        weight: have < 1 ? 85 : 68,
      }),
    ]
  },
}

const HIGH_INTEREST_DEBT: RuleDef = {
  code: 'HIGH_INTEREST_DEBT',
  label: '고금리 부채',
  about: '이자율이 높은 부채는 어떤 투자보다 먼저 갚는 게 확정 수익이다.',
  group: '위험',
  defaults: { rate: 15 },
  evaluate: ({ db, p }) => {
    const limit = p('rate')
    const bad = db.debts.filter((d) => d.balance > 0 && d.interest_rate >= limit)
    if (bad.length === 0) return []
    const worst = [...bad].sort((a, b) => b.interest_rate - a.interest_rate)[0]
    const yearlyInterest = sum(bad.map((d) => (d.balance * d.interest_rate) / 100))
    return [
      f({
        key: `HIGH_INTEREST_DEBT:${bad.map((d) => d.id).sort().join(',')}`,
        severity: 'danger',
        title: `연 ${limit}% 이상 부채 ${bad.length}건`,
        message: `${worst.name} ${worst.interest_rate}% · 잔액 ${won(worst.balance)}원. 이 상태로 1년이면 이자만 ${won(yearlyInterest)}원이다.`,
        action: `여윳돈은 저축보다 ${worst.name} 상환에 먼저 넣어라. 연 ${worst.interest_rate}% 확정 수익과 같다.`,
        action_label: '상환 시뮬레이터',
        action_href: '/debts',
        weight: 92,
      }),
    ]
  },
}

const TAX_UNRESERVED: RuleDef = {
  code: 'TAX_UNRESERVED',
  label: '세금 적립 부족',
  about: '사업 수입 대비 세금 적립이 모자라면 신고철에 현금이 비어 버린다.',
  group: '위험',
  defaults: { tolerance_pct: 90 },
  evaluate: ({ db, month, p }) => {
    if (!db.settings.business_mode) return []
    const tol = p('tolerance_pct')
    const v = taxView(db, month)
    if (v.required <= 0 || v.coverPct >= tol) return []
    return [
      f({
        key: `TAX_UNRESERVED:${month}:${Math.round(v.coverPct / 10)}`,
        severity: 'danger',
        title: `세금 적립이 ${pct(v.coverPct, 0)}뿐`,
        message: `${month.slice(5)}월 사업수입 ${won(v.businessIncome)}원에 대해 떼어 둬야 할 ${won(v.required)}원 중 ${won(v.reserved)}원만 적립했다.`,
        action: `지금 ${won(v.shortfall)}원을 세금 통장으로 옮겨라. 이 돈은 처음부터 내 돈이 아니다.`,
        action_label: '세금 적립하기',
        action_href: '/business',
        weight: 90,
      }),
    ]
  },
}

const INCOME_DROP: RuleDef = {
  code: 'INCOME_DROP',
  label: '수입 급감',
  about: '최근 3개월 수입이 직전 3개월보다 크게 줄면 긴축 플랜을 띄운다.',
  group: '위험',
  defaults: { pct: 30 },
  evaluate: ({ db, month, p }) => {
    const limit = p('pct')
    const six = flowSeries(db, 6, month)
    if (six.length < 6) return []
    const prev = sum(six.slice(0, 3).map((x) => x.income))
    const recent = sum(six.slice(3).map((x) => x.income))
    if (prev <= 0) return []
    const drop = ((prev - recent) / prev) * 100
    if (drop < limit) return []
    const cut = Math.round((prev - recent) / 3)
    return [
      f({
        key: `INCOME_DROP:${month}:${Math.round(drop / 5)}`,
        severity: 'danger',
        title: `수입이 ${pct(drop, 0)} 줄었다`,
        message: `직전 3개월 월평균 ${won(prev / 3)}원 → 최근 3개월 ${won(recent / 3)}원. 월 ${won(cut)}원이 사라졌다.`,
        action: `변동지출에서 월 ${shortWon(cut)}원을 먼저 깎아라. 구독 해지가 가장 빠르다.`,
        action_label: '긴축 플랜 보기',
        action_href: '/cashflow',
        weight: 95,
      }),
    ]
  },
}

// ══════════════════════════════════════════════════════════════
// 긍정 강화 — 경고만 쌓이면 앱을 열지 않게 된다
// ══════════════════════════════════════════════════════════════

const STREAK: RuleDef = {
  code: 'STREAK',
  label: '무지출일 연속',
  about: '개인 지출이 없던 날이 이어지면 기록해 준다.',
  group: '강화',
  defaults: { min: 2 },
  evaluate: ({ db, p, now }) => {
    const min = p('min')
    const streak = noSpendStreak(db, now)
    if (streak < min) return []
    return [
      f({
        key: `STREAK:${today()}:${streak}`,
        severity: 'praise',
        title: `무지출 ${streak}일 연속`,
        message: `${streak}일 동안 개인 지출이 0원이었다. 월 평균 하루 지출 ${won(avgMonthlyExpense(db) / 30)}원 기준으로 ${won((avgMonthlyExpense(db) / 30) * streak)}원을 아낀 셈이다.`,
        action: `이 기록을 하루만 더 늘려 보자.`,
        action_label: '루틴 보기',
        action_href: '/routines',
        weight: 30 + streak,
      }),
    ]
  },
}

const UNDER_BUDGET: RuleDef = {
  code: 'UNDER_BUDGET',
  label: '낭비 감소',
  about: '전월 대비 낭비 등급 지출이 줄면 칭찬한다.',
  group: '강화',
  defaults: {},
  evaluate: ({ db, month }) => {
    const cur = gradeMix(db, month)
    const prev = gradeMix(db, shiftMonth(month, -1))
    const out: Finding[] = []

    if (prev.waste > 0 && cur.waste < prev.waste) {
      const cut = prev.waste - cur.waste
      out.push(
        f({
          key: `UNDER_BUDGET:waste:${month}`,
          severity: 'praise',
          title: `낭비 지출 ${pct((cut / prev.waste) * 100, 0)} 감소`,
          message: `전월 ${won(prev.waste)}원 → 이번 달 ${won(cur.waste)}원. ${won(cut)}원 줄였다.`,
          action: `이 ${shortWon(cut)}원을 목표에 바로 넣으면 사라지지 않는다.`,
          action_label: '목표에 넣기',
          action_href: '/goals',
          weight: 40,
        }),
      )
    }

    const kept = budgetLines(db, month).filter((l) => l.planned > 0 && l.remain >= 0)
    const lines = budgetLines(db, month).filter((l) => l.planned > 0)
    if (lines.length >= 3 && kept.length === lines.length) {
      out.push(
        f({
          key: `UNDER_BUDGET:all:${month}`,
          severity: 'praise',
          title: `예산 ${lines.length}개 전부 지켰다`,
          message: `계획 ${won(sum(lines.map((l) => l.planned)))}원 중 ${won(sum(lines.map((l) => l.spent)))}원만 썼다.`,
          action: `남은 ${shortWon(sum(lines.map((l) => l.remain)))}원은 다음 달로 이월하지 말고 저축으로 옮겨라.`,
          action_label: '예산 보기',
          action_href: '/budget',
          weight: 38,
        }),
      )
    }
    return out
  },
}

const NET_WORTH_UP: RuleDef = {
  code: 'NET_WORTH_UP',
  label: '순자산 신고점',
  about: '순자산이 최고치를 갈아치우면 알려 준다.',
  group: '강화',
  defaults: {},
  evaluate: ({ db, month }) => {
    const series = netWorthSeries(db, 12)
    if (series.length < 2) return []
    const cur = series[series.length - 1].value
    const past = series.slice(0, -1).map((s) => s.value)
    const peak = Math.max(...past)
    if (cur <= peak) return []
    return [
      f({
        key: `NET_WORTH_UP:${month}:${Math.round(cur / 100000)}`,
        severity: 'praise',
        title: `순자산 신고점 ${shortWon(cur)}원`,
        message: `지난 12개월 최고치 ${won(peak)}원을 ${won(cur - peak)}원 넘겼다.`,
        action: `오른 이유를 한 줄로 적어 두면 다음 달에 또 쓸 수 있다.`,
        action_label: '자산 보기',
        action_href: '/assets',
        weight: 45,
      }),
    ]
  },
}

export const RULES: RuleDef[] = [
  ZOMBIE_SUB,
  PRICE_CREEP,
  DUPLICATE_SERVICE,
  SMALL_LEAK,
  IMPULSE_PATTERN,
  CATEGORY_SPIKE,
  BUDGET_PACE,
  FIXED_RATIO_HIGH,
  EMERGENCY_FUND_LOW,
  HIGH_INTEREST_DEBT,
  TAX_UNRESERVED,
  INCOME_DROP,
  STREAK,
  UNDER_BUDGET,
  NET_WORTH_UP,
]

export const RULE_BY_CODE: Record<string, RuleDef> = Object.fromEntries(RULES.map((r) => [r.code, r]))

function topMerchant(txs: { merchant: string | null }[]): string {
  const tally: Record<string, number> = {}
  for (const t of txs) {
    const m = (t.merchant ?? '').trim()
    if (m) tally[m] = (tally[m] ?? 0) + 1
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return top ? top[0] : '가장 잦은 곳'
}

export { thisMonth }
