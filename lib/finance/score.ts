import { shiftMonth, thisMonth } from '../date'
import type { DB } from '../types'
import { clamp, sum } from '../utils'
import { pct, shortWon } from '../format'
import {
  avgMonthlyExpense,
  budgetLines,
  budgetTotal,
  emergencyMonths,
  flowSeries,
  gradeMix,
  loggingDays,
  monthFlow,
  safePlan,
  spendable,
} from './selectors'

export interface ScorePart {
  key: string
  label: string
  score: number
  max: number
  /** 지금 상태를 한 줄로 */
  detail: string
  /** 점수를 올리려면 뭘 해야 하는지 */
  advice: string
}

export interface HealthScore {
  total: number
  grade: '위험' | '주의' | '보통' | '양호' | '우수'
  parts: ScorePart[]
  /** 판정할 기록이 아직 모자란다. 이때 total 은 의미가 없다. */
  insufficient: boolean
}

/**
 * 재정 건강 점수 0~100.
 * 점수만 보여주면 아무 의미가 없으므로 항목마다 근거와 다음 행동을 함께 만든다.
 */
export function healthScore(db: DB, month = thisMonth()): HealthScore {
  const parts: ScorePart[] = [
    savingRate(db, month),
    emergencyFund(db),
    debtRatio(db, month),
    budgetKeep(db, month),
    wasteShare(db, month),
    logging(db),
  ]
  const total = Math.round(sum(parts.map((p) => p.score)))
  // 거래가 없으면 "부채 0 = 만점" 같은 항목만 점수를 올려 실제보다 좋게 나온다.
  // 그 숫자를 보여 주느니 아직 모른다고 말하는 게 맞다.
  const insufficient = db.transactions.length < 5
  return { total, grade: gradeOf(total), parts, insufficient }
}

function gradeOf(total: number): HealthScore['grade'] {
  if (total < 35) return '위험'
  if (total < 50) return '주의'
  if (total < 65) return '보통'
  if (total < 80) return '양호'
  return '우수'
}

/** 저축률 25점 — 수입 대비 남긴 돈. 30% 저축이면 만점. */
function savingRate(db: DB, month: string): ScorePart {
  const series = flowSeries(db, 3, month).filter((f) => f.income > 0)
  const income = sum(series.map((f) => f.income))
  const expense = sum(series.map((f) => f.expense))
  const rate = income > 0 ? ((income - expense) / income) * 100 : 0
  const score = clamp(rate / 30, 0, 1) * 25
  return {
    key: 'saving',
    label: '저축률',
    score,
    max: 25,
    detail: income > 0 ? `최근 3개월 저축률 ${pct(rate, 1)}` : '수입 기록이 없어 계산할 수 없다',
    advice:
      rate >= 30
        ? '이 속도면 충분하다. 저축액을 목표에 묶어 두면 더 안 샌다.'
        : `저축률 30%가 만점선이다. 월 ${shortWon(Math.max(0, (income / series.length) * 0.3 - (income - expense) / Math.max(1, series.length)))}원을 더 남기면 만점.`,
  }
}

/** 비상자금 20점 — 현금성 자산이 월 지출 몇 달 분인가. 6개월이면 만점. */
function emergencyFund(db: DB): ScorePart {
  const months = emergencyMonths(db)
  const score = clamp(months / 6, 0, 1) * 20
  const need = avgMonthlyExpense(db) * 3
  return {
    key: 'emergency',
    label: '비상자금',
    score,
    max: 20,
    detail: months > 0 ? `현금성 자산 ${months.toFixed(1)}개월분` : '현금성 자산이 잡히지 않았다',
    advice:
      months >= 6
        ? '6개월분을 넘겼다. 초과분은 목표나 고금리 부채 상환으로 돌릴 때다.'
        : `최소선은 3개월분(${shortWon(need)}원)이다. 지금 ${months.toFixed(1)}개월분.`,
  }
}

/** 부채 비율 20점 — DSR(월 상환액 / 월 수입). 40% 이상이면 0점. */
function debtRatio(db: DB, month: string): ScorePart {
  const pay = sum(db.debts.map((d) => d.min_payment))
  const base = monthFlow(db, month).income || safePlan(db, month).baseIncome
  const dsr = base > 0 ? (pay / base) * 100 : 0
  const score = (1 - clamp(dsr / 40, 0, 1)) * 20
  const worst = [...db.debts].sort((a, b) => b.interest_rate - a.interest_rate)[0]
  return {
    key: 'debt',
    label: '부채 비율',
    score,
    max: 20,
    detail: db.debts.length === 0 ? '부채 없음' : `월 상환액이 수입의 ${pct(dsr, 1)} (DSR)`,
    advice:
      db.debts.length === 0
        ? '부채가 없다. 이 항목은 유지만 하면 된다.'
        : dsr < 20
          ? '20% 아래로 관리되고 있다. 이자율 높은 것부터 줄이면 더 빨라진다.'
          : `DSR 40%가 0점선이다. ${worst ? `${worst.name}(${worst.interest_rate}%)부터 줄여라.` : ''}`,
  }
}

/** 예산 준수율 15점 — 예산을 넘기지 않은 카테고리 비율. */
function budgetKeep(db: DB, month: string): ScorePart {
  const lines = budgetLines(db, month)
  if (lines.length === 0) {
    const sp = spendable(db, month)
    const ok = sp.budget > 0 && sp.usedPct <= 100
    return {
      key: 'budget',
      label: '예산 준수',
      score: ok ? 7.5 : 0,
      max: 15,
      detail: '카테고리 예산이 없어 안전 예산으로만 봤다',
      advice: '예산 화면에서 카테고리 예산을 잡으면 이 항목이 제대로 채점된다.',
    }
  }
  const kept = lines.filter((l) => l.remain >= 0).length
  const score = (kept / lines.length) * 15
  const over = lines.filter((l) => l.remain < 0)
  return {
    key: 'budget',
    label: '예산 준수',
    score,
    max: 15,
    detail: `${lines.length}개 중 ${kept}개 지킴`,
    advice: over.length
      ? `초과: ${over
          .slice(0, 3)
          .map((o) => `${o.name} ${shortWon(-o.remain)}원`)
          .join(', ')}`
      : '전부 예산 안에서 끝냈다.',
  }
}

/** 낭비 등급 비중 10점 — 낭비가 전체 지출의 15%를 넘으면 0점. */
function wasteShare(db: DB, month: string): ScorePart {
  const mix = gradeMix(db, month)
  const total = mix.need + mix.want + mix.waste
  const share = total > 0 ? (mix.waste / total) * 100 : 0
  const score = (1 - clamp(share / 15, 0, 1)) * 10
  const prev = gradeMix(db, shiftMonth(month, -1))
  const prevTotal = prev.need + prev.want + prev.waste
  const prevShare = prevTotal > 0 ? (prev.waste / prevTotal) * 100 : 0
  return {
    key: 'waste',
    label: '낭비 비중',
    score,
    max: 10,
    detail: total > 0 ? `지출의 ${pct(share, 1)}이 낭비 등급 (${shortWon(mix.waste)}원)` : '지출 기록이 없다',
    advice:
      share <= 0
        ? '낭비 등급 지출이 없다.'
        : `전월 ${pct(prevShare, 1)} → 이번 달 ${pct(share, 1)}. 15% 아래로 내려야 점수가 붙기 시작한다.`,
  }
}

/** 기록 성실도 10점 — 최근 7일 중 입력한 날. */
function logging(db: DB): ScorePart {
  const days = loggingDays(db, 7)
  return {
    key: 'logging',
    label: '기록 성실도',
    score: (days / 7) * 10,
    max: 10,
    detail: `최근 7일 중 ${days}일 입력`,
    advice:
      days >= 6
        ? '기록이 끊기지 않고 있다. 다른 점수의 정확도가 여기서 나온다.'
        : '하루 한 번, 3초면 끝난다. 기록이 빠지면 나머지 점수도 틀린다.',
  }
}

export function totalBudgetedOrSafe(db: DB, month = thisMonth()) {
  const b = budgetTotal(db, month)
  return b > 0 ? b : safePlan(db, month).safeBudget
}
