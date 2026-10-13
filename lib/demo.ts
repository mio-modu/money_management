import { DEFAULT_CATEGORIES, DEFAULT_RULES, DEFAULT_SETTINGS } from './defaults'
import { daysInMonth, lastMonths, shiftMonth, thisMonth, ymd } from './date'
import type { DB, Transaction } from './types'
import { EMPTY_TABLES } from './data/adapter'

/**
 * 더미 데이터.
 * 아무 데이터나 넣으면 화면만 채워지고 규칙 엔진이 뭘 하는지 안 보인다.
 * 그래서 누수 6종·위험 6종·강화 3종이 실제로 걸리도록 "새는 지점"을 일부러 심어 뒀다.
 *
 * 프리랜서 1인 사업자 가정: 불규칙 수입, 고정지출 과다, 고금리 카드론, 세금 미적립.
 */

// 같은 버튼을 눌러도 같은 화면이 나와야 비교가 된다 — 시드 고정 난수.
function rng(seed = 20260413) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export function demoDB(now = new Date()): DB {
  const rand = rng()
  const months = lastMonths(6, thisMonth())
  const [m5, m4, m3, m2, m1, m0] = months
  const tx: Transaction[] = []
  let seq = 0

  const day = (month: string, d: number) =>
    `${month}-${String(Math.min(Math.max(1, d), daysInMonth(month))).padStart(2, '0')}`

  // 최근 3일은 일부러 비운다 — 무지출일 연속(STREAK)이 어떻게 보이는지 확인할 수 있게.
  const cutoff = ymd(new Date(now.getTime() - 3 * 86400000))

  function push(
    month: string,
    d: number,
    amount: number,
    categoryId: string,
    opts: Partial<Transaction> = {},
  ) {
    const date = day(month, d)
    if (date > cutoff) return
    tx.push({
      id: `t-demo-${String(++seq).padStart(4, '0')}`,
      account_id: 'ac-checking',
      date,
      amount: Math.round(amount),
      direction: 'out',
      category_id: categoryId,
      merchant: null,
      memo: null,
      is_business: false,
      is_fixed: false,
      tags: [],
      hour: 12 + Math.floor(rand() * 8),
      created_at: new Date(`${date}T12:00:00Z`).toISOString(),
      ...opts,
    })
  }

  // ── 수입: 최근 3개월이 직전 3개월보다 35% 낮다 (INCOME_DROP) ──
  const incomeByMonth: Record<string, { biz: number; side: number }> = {
    [m5]: { biz: 3_800_000, side: 700_000 },
    [m4]: { biz: 3_900_000, side: 600_000 },
    [m3]: { biz: 3_700_000, side: 800_000 },
    [m2]: { biz: 2_400_000, side: 500_000 },
    [m1]: { biz: 2_500_000, side: 400_000 },
    [m0]: { biz: 2_400_000, side: 500_000 },
  }
  for (const m of months) {
    const inc = incomeByMonth[m]
    push(m, 5, inc.biz, 'c-in-biz', { direction: 'in', is_business: true, merchant: '디자인 외주' })
    push(m, 18, inc.side, 'c-in-side', { direction: 'in', merchant: '강의료' })
  }

  // ── 고정지출: 수입의 절반을 넘긴다 (FIXED_RATIO_HIGH) ──
  const fixed: [string, number, number][] = [
    ['c-housing-rent', 1_050_000, 25],
    ['c-housing-util', 92_000, 17],
    ['c-housing-comm', 78_000, 14],
    ['c-finance-insurance', 185_000, 10],
    ['c-finance-interest', 121_000, 26],
  ]
  for (const m of months) {
    for (const [cat, amount, d] of fixed) {
      push(m, d, amount, cat, { is_fixed: true, merchant: fixedName(cat) })
    }
  }

  // ── 구독 결제도 고정으로 찍힌다 ──
  const subPayments: [string, number, number][] = [
    ['넷플릭스', 17_000, 7],
    ['티빙', 13_900, 11],
    ['웨이브', 10_900, 19],
    ['헬스장', 55_000, 3],
    ['클라우드 스토리지', 3_300, 22],
  ]
  for (const m of months) {
    for (const [name, amount, d] of subPayments) {
      const bump = name === '넷플릭스' && (m === m1 || m === m0) ? 4_500 : 0
      push(m, d, amount + bump, 'c-leisure-sub', { is_fixed: true, merchant: name })
    }
    push(m, 2, 29_000, 'c-biz-tool', { is_fixed: true, is_business: true, merchant: '피그마' })
  }

  // ── 변동지출: 월별로 조금씩 흔들리게 ──
  const variable: [string, number, number][] = [
    ['c-food-grocery', 62_000, 4],
    ['c-food-dining', 23_000, 9],
    ['c-food-delivery', 19_500, 11],
    ['c-food-cafe', 5_200, 14],
    ['c-transport-public', 1_500, 14],
    ['c-transport-taxi', 12_800, 3],
    ['c-living-goods', 18_000, 3],
    ['c-health-clinic', 14_000, 1],
    ['c-etc-gift', 50_000, 1],
  ]
  for (const m of months) {
    for (const [cat, base, count] of variable) {
      for (let i = 0; i < count; i++) {
        const d = 1 + Math.floor(rand() * 27)
        push(m, d, base * (0.7 + rand() * 0.6), cat, { merchant: merchantFor(cat, rand) })
      }
    }
  }

  // ── 낭비 등급: 지난달이 더 많았다 (UNDER_BUDGET 칭찬) ──
  for (let i = 0; i < 6; i++) push(m1, 3 + i * 4, 48_000 + rand() * 30_000, 'c-leisure-drink', { merchant: '포차' })
  for (let i = 0; i < 8; i++) push(m1, 2 + i * 3, 4_500, 'c-etc-smoke', { merchant: '편의점' })
  for (let i = 0; i < 2; i++) push(m0, 4 + i * 6, 38_000, 'c-leisure-drink', { merchant: '포차' })
  for (let i = 0; i < 3; i++) push(m0, 3 + i * 4, 4_500, 'c-etc-smoke', { merchant: '편의점' })

  // ── 쇼핑 급증: 3개월 평균의 3배 (CATEGORY_SPIKE) ──
  for (const m of [m3, m2, m1]) push(m, 12, 60_000 + rand() * 40_000, 'c-shopping-clothes', { merchant: '무신사' })
  push(m0, 6, 289_000, 'c-shopping-digital', { merchant: '애플스토어' })
  push(m0, 8, 184_000, 'c-shopping-clothes', { merchant: '무신사' })
  push(m0, 9, 96_000, 'c-shopping-clothes', { merchant: '자라' })

  // ── 잔돈 누수: 1만원 이하가 이번 달 20건 넘게 (SMALL_LEAK) ──
  for (let i = 0; i < 24; i++) {
    const d = 1 + Math.floor(rand() * 26)
    push(m0, d, 2_800 + rand() * 4_500, 'c-food-cafe', { merchant: i % 3 === 0 ? '편의점' : '스타벅스' })
  }

  // ── 심야 결제 (IMPULSE_PATTERN) ──
  const lateHours = [23, 0, 1, 23, 0]
  lateHours.forEach((h, i) => {
    push(m0, 1 + i * 2, 26_000 + rand() * 30_000, 'c-food-delivery', {
      hour: h,
      merchant: '배달앱',
      memo: '심야',
    })
  })

  // ── 사업 비용 ──
  for (const m of months) {
    push(m, 13, 140_000 + rand() * 80_000, 'c-biz-outsource', { is_business: true, merchant: '일러스트 외주' })
    push(m, 21, 90_000 + rand() * 60_000, 'c-biz-ads', { is_business: true, merchant: '메타 광고' })
  }

  const db: DB = {
    ...structuredClone(EMPTY_TABLES),
    categories: structuredClone(DEFAULT_CATEGORIES),
    rules: structuredClone(DEFAULT_RULES),
    settings: { ...DEFAULT_SETTINGS, onboarded: true, irregular_income: true, business_mode: true },
    transactions: tx.sort((a, b) => b.date.localeCompare(a.date)),
  } as DB

  // ── 계좌 ──
  db.accounts = [
    { id: 'ac-checking', name: '생활비 입출금', type: 'checking', balance: 1_240_000, is_business: false, interest_rate: null, due_day: null },
    { id: 'ac-savings', name: '비상금 저축', type: 'savings', balance: 1_100_000, is_business: false, interest_rate: 3.1, due_day: null },
    { id: 'ac-biz', name: '사업용 통장', type: 'checking', balance: 980_000, is_business: true, interest_rate: null, due_day: null },
    { id: 'ac-card', name: '신용카드 미결제', type: 'card', balance: 980_000, is_business: false, interest_rate: null, due_day: 14 },
    { id: 'ac-cash', name: '현금', type: 'cash', balance: 120_000, is_business: false, interest_rate: null, due_day: null },
  ]

  // ── 구독: 좀비 2개 · 가격 인상 1개 · OTT 3개 중복 ──
  const back = (days: number) => ymd(new Date(now.getTime() - days * 86400000))
  const fwd = (days: number) => ymd(new Date(now.getTime() + days * 86400000))
  db.subscriptions = [
    {
      id: 'sb-netflix', name: '넷플릭스', amount: 21_500, cycle: 'monthly', next_charge_at: fwd(6),
      last_used_at: back(3), value_rating: 4, status: 'active', category_id: 'c-leisure-sub',
      price_history: [
        { date: shiftMonth(m0, -2) + '-07', amount: 17_000 },
        { date: m1 + '-07', amount: 21_500 },
      ],
    },
    {
      id: 'sb-tving', name: '티빙', amount: 13_900, cycle: 'monthly', next_charge_at: fwd(11),
      last_used_at: back(74), value_rating: 2, status: 'active', category_id: 'c-leisure-sub',
      price_history: [{ date: m1 + '-11', amount: 13_900 }],
    },
    {
      id: 'sb-wavve', name: '웨이브', amount: 10_900, cycle: 'monthly', next_charge_at: fwd(2),
      last_used_at: back(96), value_rating: 1, status: 'active', category_id: 'c-leisure-sub',
      price_history: [{ date: m1 + '-19', amount: 10_900 }],
    },
    {
      id: 'sb-gym', name: '헬스장', amount: 55_000, cycle: 'monthly', next_charge_at: fwd(14),
      last_used_at: back(41), value_rating: 3, status: 'active', category_id: 'c-health-fitness',
      price_history: [{ date: m1 + '-03', amount: 55_000 }],
    },
    {
      id: 'sb-cloud', name: '클라우드 스토리지', amount: 3_300, cycle: 'monthly', next_charge_at: fwd(9),
      last_used_at: back(1), value_rating: 5, status: 'active', category_id: 'c-leisure-sub',
      price_history: [{ date: m1 + '-22', amount: 3_300 }],
    },
    {
      id: 'sb-figma', name: '피그마', amount: 348_000, cycle: 'yearly', next_charge_at: fwd(120),
      last_used_at: back(1), value_rating: 5, status: 'active', category_id: 'c-biz-tool',
      price_history: [{ date: m5 + '-02', amount: 348_000 }],
    },
    {
      id: 'sb-adobe', name: '어도비 CC', amount: 24_000, cycle: 'monthly', next_charge_at: fwd(4),
      last_used_at: back(88), value_rating: 2, status: 'active', category_id: 'c-biz-tool',
      price_history: [{ date: m1 + '-04', amount: 24_000 }],
    },
  ]

  // ── 자산 ──
  db.assets = [
    { id: 'as-stock', name: '국내외 ETF', kind: 'invest', value: 6_800_000, valued_at: ymd(now) },
    { id: 'as-deposit', name: '청약 저축', kind: 'cash', value: 3_400_000, valued_at: ymd(now) },
    { id: 'as-pension', name: '연금저축', kind: 'invest', value: 2_100_000, valued_at: ymd(now) },
  ]

  // ── 부채: 고금리 카드론이 1순위 (HIGH_INTEREST_DEBT) ──
  db.debts = [
    { id: 'dt-cardloan', name: '카드론', principal: 4_000_000, balance: 3_200_000, interest_rate: 18.9, min_payment: 180_000, maturity: null },
    { id: 'dt-student', name: '학자금 대출', principal: 8_000_000, balance: 5_400_000, interest_rate: 2.8, min_payment: 120_000, maturity: `${Number(m0.slice(0, 4)) + 4}-03-31` },
    { id: 'dt-phone', name: '휴대폰 할부', principal: 1_320_000, balance: 660_000, interest_rate: 5.9, min_payment: 55_000, maturity: `${Number(m0.slice(0, 4)) + 1}-01-15` },
  ]

  // ── 목표 ──
  db.goals = [
    { id: 'gl-emergency', name: '비상자금 3개월분', target_amount: 8_400_000, deadline: `${Number(m0.slice(0, 4)) + 1}-06-30`, current_amount: 1_100_000, priority: 1 },
    { id: 'gl-mac', name: '맥북 교체', target_amount: 2_600_000, deadline: `${Number(m0.slice(0, 4)) + 1}-02-28`, current_amount: 400_000, priority: 3 },
  ]

  // ── 예산: 이번 달은 일부러 빡빡하게 (BUDGET_PACE) ──
  const budgetPlan: [string, number][] = [
    ['c-food-grocery', 320_000],
    ['c-food-dining', 180_000],
    ['c-food-delivery', 120_000],
    ['c-food-cafe', 80_000],
    ['c-transport-taxi', 60_000],
    ['c-shopping-clothes', 150_000],
    ['c-leisure-drink', 100_000],
    ['c-living-goods', 80_000],
  ]
  db.budgets = [m1, m0].flatMap((m) =>
    budgetPlan.map(([cat, planned], i) => ({
      id: `bd-${m}-${i}`,
      category_id: cat,
      month: m,
      planned,
      carryover_enabled: i === 0,
    })),
  )

  // ── 세금 적립: 모자라게 (TAX_UNRESERVED) ──
  db.tax_reserve = [
    { id: 'tr-1', month: m1, business_income: incomeByMonth[m1].biz, required: 470_000, reserved: 470_000 },
    { id: 'tr-0', month: m0, business_income: incomeByMonth[m0].biz, required: 450_000, reserved: 100_000 },
  ]

  // ── 미수금: 하나는 밀렸다 ──
  db.receivables = [
    { id: 'rc-1', client: '○○에이전시', amount: 1_650_000, due_at: back(18), paid_at: null, memo: '3차 잔금' },
    { id: 'rc-2', client: '△△스튜디오', amount: 880_000, due_at: fwd(9), paid_at: null, memo: '랜딩 페이지' },
  ]

  return db
}

function fixedName(cat: string) {
  const map: Record<string, string> = {
    'c-housing-rent': '월세',
    'c-housing-util': '관리비',
    'c-housing-comm': '통신요금',
    'c-finance-insurance': '실손보험',
    'c-finance-interest': '카드론 이자',
  }
  return map[cat] ?? null
}

function merchantFor(cat: string, rand: () => number) {
  const pool: Record<string, string[]> = {
    'c-food-grocery': ['이마트', '쿠팡', '동네마트'],
    'c-food-dining': ['국밥집', '회사 근처 식당', '중식당'],
    'c-food-delivery': ['배달앱'],
    'c-food-cafe': ['스타벅스', '편의점', '동네카페'],
    'c-transport-public': ['지하철', '버스'],
    'c-transport-taxi': ['카카오택시'],
    'c-living-goods': ['다이소', '쿠팡'],
    'c-health-clinic': ['내과', '약국'],
    'c-etc-gift': ['경조사'],
  }
  const list = pool[cat]
  return list ? list[Math.floor(rand() * list.length)] : null
}
