import { daysInMonth, lastMonths, monthProgress, shiftMonth, thisMonth, today, ym } from '../date'
import type { Category, DB, Grade, Transaction } from '../types'
import { avg, median, sum } from '../utils'

// ─────────────────────────────────────────────────────────────
// 거래 집계
// ─────────────────────────────────────────────────────────────

export const inMonth = (t: Transaction, month: string) => t.date.slice(0, 7) === month

export function monthTx(db: DB, month: string) {
  return db.transactions.filter((t) => inMonth(t, month))
}

export interface MonthFlow {
  month: string
  income: number
  expense: number
  fixed: number
  variable: number
  businessIncome: number
  businessExpense: number
  net: number
}

export function monthFlow(db: DB, month: string): MonthFlow {
  const tx = monthTx(db, month)
  const outs = tx.filter((t) => t.direction === 'out')
  const income = sum(tx.filter((t) => t.direction === 'in').map((t) => t.amount))
  const expense = sum(outs.map((t) => t.amount))
  const fixed = sum(outs.filter((t) => t.is_fixed).map((t) => t.amount))
  return {
    month,
    income,
    expense,
    fixed,
    variable: expense - fixed,
    businessIncome: sum(tx.filter((t) => t.direction === 'in' && t.is_business).map((t) => t.amount)),
    businessExpense: sum(outs.filter((t) => t.is_business).map((t) => t.amount)),
    net: income - expense,
  }
}

export function flowSeries(db: DB, months: number, from = thisMonth()): MonthFlow[] {
  return lastMonths(months, from).map((m) => monthFlow(db, m))
}

// ─────────────────────────────────────────────────────────────
// 자산 · 부채 · 순자산
// ─────────────────────────────────────────────────────────────

const ASSET_ACCOUNTS = ['checking', 'savings', 'cash', 'invest'] as const
const DEBT_ACCOUNTS = ['card', 'loan'] as const

export function totalAssets(db: DB) {
  const fromAccounts = sum(
    db.accounts
      .filter((a) => !a.archived && (ASSET_ACCOUNTS as readonly string[]).includes(a.type))
      .map((a) => a.balance),
  )
  return fromAccounts + sum(db.assets.map((a) => a.value))
}

export function totalDebts(db: DB) {
  const fromAccounts = sum(
    db.accounts
      .filter((a) => !a.archived && (DEBT_ACCOUNTS as readonly string[]).includes(a.type))
      .map((a) => Math.abs(a.balance)),
  )
  return fromAccounts + sum(db.debts.map((d) => d.balance))
}

export function netWorth(db: DB) {
  return totalAssets(db) - totalDebts(db)
}

/** 현금성 자산 — 비상자금 판정에 쓴다. 투자·부동산은 빼고 센다. */
export function liquidCash(db: DB) {
  const accounts = sum(
    db.accounts
      .filter((a) => !a.archived && ['checking', 'savings', 'cash'].includes(a.type))
      .map((a) => a.balance),
  )
  return accounts + sum(db.assets.filter((a) => a.kind === 'cash').map((a) => a.value))
}

/**
 * 순자산 월별 추이.
 * 자산 평가액은 현재 시점 하나뿐이므로, 현재 순자산에서 그 이후 달들의
 * 저축액(수입−지출)을 거꾸로 빼서 역산한다. 추세를 보는 용도다.
 */
export function netWorthSeries(db: DB, months = 12): { month: string; value: number }[] {
  // 기록이 없는 달까지 그리면 평평한 직선이 앞에 붙어 추세를 오해하게 만든다.
  const first = db.transactions.reduce<string | null>(
    (min, t) => (min === null || t.date < min ? t.date : min),
    null,
  )
  const keys = lastMonths(months).filter((m) => !first || m >= first.slice(0, 7))
  const now = netWorth(db)
  const out: { month: string; value: number }[] = []
  let running = now
  for (let i = keys.length - 1; i >= 0; i--) {
    out.unshift({ month: keys[i], value: Math.round(running) })
    running -= monthFlow(db, keys[i]).net
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 카테고리 집계
// ─────────────────────────────────────────────────────────────

export function categoryMap(db: DB): Record<string, Category> {
  return Object.fromEntries(db.categories.map((c) => [c.id, c]))
}

export function rootOf(db: DB, categoryId: string | null): Category | null {
  if (!categoryId) return null
  const map = categoryMap(db)
  let c = map[categoryId]
  if (!c) return null
  while (c.parent_id && map[c.parent_id]) c = map[c.parent_id]
  return c
}

export function gradeOf(db: DB, categoryId: string | null): Grade {
  if (!categoryId) return 'want'
  return categoryMap(db)[categoryId]?.grade ?? 'want'
}

export interface CategoryTotal {
  categoryId: string
  name: string
  icon: string
  grade: Grade
  amount: number
  count: number
}

/** 소분류 기준 합계 (지출만). */
export function categoryTotals(
  db: DB,
  month: string,
  opts?: { business?: boolean; fixed?: boolean },
): CategoryTotal[] {
  const map = categoryMap(db)
  const acc: Record<string, CategoryTotal> = {}
  for (const t of monthTx(db, month)) {
    if (t.direction !== 'out') continue
    if (opts?.business !== undefined && t.is_business !== opts.business) continue
    if (opts?.fixed !== undefined && t.is_fixed !== opts.fixed) continue
    const id = t.category_id ?? 'c-etc-unknown'
    const c = map[id]
    acc[id] ||= {
      categoryId: id,
      name: c?.name ?? '분류 안 됨',
      icon: c?.icon ?? '❓',
      grade: c?.grade ?? 'want',
      amount: 0,
      count: 0,
    }
    acc[id].amount += t.amount
    acc[id].count += 1
  }
  return Object.values(acc).sort((a, b) => b.amount - a.amount)
}

/** 대분류 기준 합계 — 트리맵용. */
export function rootTotals(db: DB, month: string): CategoryTotal[] {
  const acc: Record<string, CategoryTotal> = {}
  for (const t of monthTx(db, month)) {
    if (t.direction !== 'out') continue
    const root = rootOf(db, t.category_id)
    const id = root?.id ?? 'c-etc'
    acc[id] ||= {
      categoryId: id,
      name: root?.name ?? '기타',
      icon: root?.icon ?? '🔖',
      grade: root?.grade ?? 'want',
      amount: 0,
      count: 0,
    }
    acc[id].amount += t.amount
    acc[id].count += 1
  }
  return Object.values(acc).sort((a, b) => b.amount - a.amount)
}

export type GradeMix = Record<Grade, number>

export function gradeMix(db: DB, month: string): GradeMix {
  const out: GradeMix = { need: 0, want: 0, waste: 0 }
  for (const t of monthTx(db, month)) {
    if (t.direction !== 'out') continue
    out[gradeOf(db, t.category_id)] += t.amount
  }
  return out
}

export function gradeMixSeries(db: DB, months = 6): { month: string; mix: GradeMix; total: number }[] {
  return lastMonths(months).map((m) => {
    const mix = gradeMix(db, m)
    return { month: m, mix, total: mix.need + mix.want + mix.waste }
  })
}

/** 전월 대비 증감 TOP n (지출 소분류). */
export function categoryDeltas(db: DB, month: string, n = 5) {
  const cur = categoryTotals(db, month)
  const prev = new Map(categoryTotals(db, shiftMonth(month, -1)).map((c) => [c.categoryId, c.amount]))
  return cur
    .map((c) => ({ ...c, prev: prev.get(c.categoryId) ?? 0, delta: c.amount - (prev.get(c.categoryId) ?? 0) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, n)
}

// ─────────────────────────────────────────────────────────────
// 예산 · 쓸 수 있는 돈
// ─────────────────────────────────────────────────────────────

export function budgetTotal(db: DB, month: string) {
  return sum(db.budgets.filter((b) => b.month === month).map((b) => b.planned))
}

export interface BudgetLine {
  categoryId: string
  name: string
  icon: string
  grade: Grade
  planned: number
  spent: number
  /** 이월분 */
  carryover: number
  remain: number
  usedPct: number
}

export function budgetLines(db: DB, month: string): BudgetLine[] {
  const map = categoryMap(db)
  const spentBy = new Map(categoryTotals(db, month).map((c) => [c.categoryId, c.amount]))
  const prevMonth = shiftMonth(month, -1)
  const prevSpent = new Map(categoryTotals(db, prevMonth).map((c) => [c.categoryId, c.amount]))

  return db.budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const c = map[b.category_id]
      const spent = spentBy.get(b.category_id) ?? 0
      let carryover = 0
      if (b.carryover_enabled) {
        const prevPlan = db.budgets.find((x) => x.month === prevMonth && x.category_id === b.category_id)
        if (prevPlan) carryover = Math.max(0, prevPlan.planned - (prevSpent.get(b.category_id) ?? 0))
      }
      const planned = b.planned + carryover
      return {
        categoryId: b.category_id,
        name: c?.name ?? '알 수 없음',
        icon: c?.icon ?? '🔖',
        grade: c?.grade ?? 'want',
        planned,
        spent,
        carryover,
        remain: planned - spent,
        usedPct: planned > 0 ? (spent / planned) * 100 : 0,
      }
    })
    .sort((a, b) => b.usedPct - a.usedPct)
}

/**
 * 남은 고정지출 예정액.
 * (1) 이번 달 남은 날에 결제될 구독 + (2) 지난달엔 있었는데 이번 달 아직 안 나간 고정지출.
 */
export function upcomingFixed(db: DB, month = thisMonth(), from = today()): { label: string; amount: number; date: string }[] {
  const out: { label: string; amount: number; date: string }[] = []

  for (const s of db.subscriptions) {
    if (s.status === 'cancelled') continue
    if (s.next_charge_at.slice(0, 7) === month && s.next_charge_at >= from) {
      out.push({ label: s.name, amount: monthlyAmount(s.amount, s.cycle), date: s.next_charge_at })
    }
  }

  const paidCats = new Set(
    monthTx(db, month)
      .filter((t) => t.direction === 'out' && t.is_fixed)
      .map((t) => t.category_id ?? ''),
  )
  const prev = monthTx(db, shiftMonth(month, -1)).filter((t) => t.direction === 'out' && t.is_fixed)
  const map = categoryMap(db)
  const byCat: Record<string, { amount: number; day: number }> = {}
  for (const t of prev) {
    const id = t.category_id ?? ''
    if (paidCats.has(id)) continue
    byCat[id] ||= { amount: 0, day: Number(t.date.slice(8, 10)) }
    byCat[id].amount += t.amount
  }
  for (const [id, v] of Object.entries(byCat)) {
    const day = String(Math.min(v.day, daysInMonth(month))).padStart(2, '0')
    out.push({ label: map[id]?.name ?? '고정지출', amount: v.amount, date: `${month}-${day}` })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function monthlyAmount(amount: number, cycle: 'monthly' | 'yearly' | 'weekly') {
  if (cycle === 'yearly') return amount / 12
  if (cycle === 'weekly') return (amount * 52) / 12
  return amount
}

export function yearlyAmount(amount: number, cycle: 'monthly' | 'yearly' | 'weekly') {
  if (cycle === 'yearly') return amount
  if (cycle === 'weekly') return amount * 52
  return amount * 12
}

/**
 * 불규칙 수입 대응 안전 예산.
 * 최근 6개월 수입 "중앙값"을 기준 소득으로 본다. 평균은 한 번의 큰 입금에 끌려간다.
 */
export interface SafePlan {
  baseIncome: number
  fixedAvg: number
  taxReserve: number
  goalSaving: number
  safeBudget: number
  irregular: boolean
}

export function safePlan(db: DB, month = thisMonth()): SafePlan {
  const irregular = db.settings.irregular_income
  const series = flowSeries(db, 6, shiftMonth(month, -1))
  const incomes = series.map((f) => f.income).filter((v) => v > 0)
  const recent = series.slice(-3).map((f) => f.income).filter((v) => v > 0)
  // 6개월 중앙값이 기본이되, 최근 3개월이 더 낮으면 낮은 쪽을 쓴다.
  // 수입이 꺾인 직후에는 6개월 중앙값이 아직 좋았던 달에 걸려 있어서 "안전"하지 않다.
  const baseIncome = irregular
    ? Math.min(median(incomes) || Infinity, median(recent) || Infinity) || 0
    : (incomes.length ? incomes[incomes.length - 1] : 0) || median(incomes)

  const fixedAvg = avg(series.slice(-3).map((f) => f.fixed))
  const bizIncome = monthFlow(db, month).businessIncome
  const taxReserve = db.settings.business_mode
    ? (bizIncome * (db.settings.vat_rate + db.settings.income_tax_rate)) / 100
    : 0
  const goalSaving = sum(db.goals.map((g) => monthlyNeedForGoal(g, month)))

  return {
    baseIncome,
    fixedAvg,
    taxReserve,
    goalSaving,
    safeBudget: Math.max(0, baseIncome - fixedAvg - taxReserve - goalSaving),
    irregular,
  }
}

export function monthlyNeedForGoal(
  g: { target_amount: number; current_amount: number; deadline: string },
  month = thisMonth(),
) {
  const remain = Math.max(0, g.target_amount - g.current_amount)
  const monthsLeft = monthsUntil(g.deadline, month)
  if (monthsLeft <= 0) return remain
  return remain / monthsLeft
}

export function monthsUntil(deadline: string, from = thisMonth()) {
  const [fy, fm] = from.split('-').map(Number)
  const [dy, dm] = deadline.slice(0, 7).split('-').map(Number)
  return (dy - fy) * 12 + (dm - fm)
}

/**
 * 대시보드 2번 숫자 — "이번 달 쓸 수 있는 남은 돈".
 * 예산이 잡혀 있으면 예산을, 없으면 안전 예산을 기준으로 쓴다.
 */
export interface Spendable {
  budget: number
  spent: number
  upcomingFixedTotal: number
  remain: number
  perDay: number
  daysLeft: number
  usedPct: number
  paceGapPp: number
  basedOn: 'budget' | 'safe'
}

export function spendable(db: DB, month = thisMonth(), now = new Date()): Spendable {
  const budgeted = budgetTotal(db, month)
  const plan = safePlan(db, month)
  const basedOn: 'budget' | 'safe' = budgeted > 0 ? 'budget' : 'safe'
  const budget = basedOn === 'budget' ? budgeted : plan.safeBudget

  const flow = monthFlow(db, month)
  // 예산은 변동지출 기준이므로, 예산 모드일 때 고정지출은 빼고 센다.
  const spent = basedOn === 'budget' ? flow.variable : flow.expense
  const upcoming = sum(upcomingFixed(db, month).map((u) => u.amount))
  const upcomingFixedTotal = basedOn === 'budget' ? 0 : upcoming

  const total = daysInMonth(month)
  const isCurrent = ym(now) === month
  const daysLeft = isCurrent ? Math.max(0, total - now.getDate()) : 0
  const remain = budget - spent - upcomingFixedTotal
  const usedPct = budget > 0 ? (spent / budget) * 100 : 0

  return {
    budget,
    spent,
    upcomingFixedTotal,
    remain,
    daysLeft,
    perDay: daysLeft > 0 ? Math.max(0, remain) / daysLeft : Math.max(0, remain),
    usedPct,
    paceGapPp: usedPct - monthProgress(month, now) * 100,
    basedOn,
  }
}

// ─────────────────────────────────────────────────────────────
// 패턴
// ─────────────────────────────────────────────────────────────

/** 무지출일 연속 기록. 오늘은 아직 끝나지 않았으므로 어제부터 센다. */
export function noSpendStreak(db: DB, now = new Date()): number {
  const spentDays = new Set(
    db.transactions.filter((t) => t.direction === 'out' && !t.is_business).map((t) => t.date),
  )
  let streak = 0
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  for (let i = 0; i < 400; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (spentDays.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** 최근 7일 중 기록을 남긴 날 수 — 기록 성실도. */
export function loggingDays(db: DB, days = 7, now = new Date()): number {
  const set = new Set(db.transactions.map((t) => t.date))
  let count = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (set.has(key)) count++
  }
  return count
}

export function weekdayPattern(db: DB, month: string) {
  const buckets = Array.from({ length: 7 }, () => 0)
  for (const t of monthTx(db, month)) {
    if (t.direction !== 'out') continue
    buckets[new Date(`${t.date}T00:00:00`).getDay()] += t.amount
  }
  return buckets
}

export function hourPattern(db: DB, months = 3) {
  const keys = new Set(lastMonths(months))
  const buckets = Array.from({ length: 24 }, () => 0)
  for (const t of db.transactions) {
    if (t.direction !== 'out' || t.hour == null) continue
    if (!keys.has(t.date.slice(0, 7))) continue
    buckets[t.hour] += t.amount
  }
  return buckets
}

/** 같은 가맹점을 다시 입력할 때 카테고리를 자동으로 추론한다. */
export function guessCategory(db: DB, merchant: string): string | null {
  const m = merchant.trim().toLowerCase()
  if (!m) return null
  const hits = db.transactions.filter((t) => (t.merchant ?? '').trim().toLowerCase() === m && t.category_id)
  if (hits.length === 0) return null
  const tally: Record<string, number> = {}
  for (const h of hits) tally[h.category_id!] = (tally[h.category_id!] ?? 0) + 1
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
}

export function recentMerchants(db: DB, limit = 12): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...db.transactions].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const m = (t.merchant ?? '').trim()
    if (!m || seen.has(m)) continue
    seen.add(m)
    out.push(m)
    if (out.length >= limit) break
  }
  return out
}

export interface FixedProfile {
  /** 대표 월 고정지출 — 직전 3개월 평균. 고정비는 매달 비슷하므로 평균이 가장 정확하다. */
  fixedBase: number
  /** 대표 월 수입 — 직전 3개월 중앙값. 수입 수준이 바뀌었을 때 지금 수준을 잡아낸다. */
  incomeBase: number
  ratio: number
}

/**
 * 고정지출 비중.
 * 이번 달 숫자를 그대로 쓰면 월 중에는 아직 안 나간 고정비 때문에 비중이 낮게 보인다.
 * 그래서 완결된 직전 3개월을 기준으로 계산한다 — 이 지표는 "구조"를 보는 것이다.
 */
export function fixedProfile(db: DB, month = thisMonth()): FixedProfile {
  const cur = monthFlow(db, month)
  const complete = flowSeries(db, 3, shiftMonth(month, -1))
  const fixedBase = avg(complete.map((f) => f.fixed).filter((v) => v > 0)) || cur.fixed
  const incomeBase = median(complete.map((f) => f.income).filter((v) => v > 0)) || cur.income
  return {
    fixedBase,
    incomeBase,
    ratio: incomeBase > 0 ? (fixedBase / incomeBase) * 100 : 0,
  }
}

export function fixedRatio(db: DB, month = thisMonth()): number {
  return fixedProfile(db, month).ratio
}

export function avgMonthlyExpense(db: DB, months = 3, from = thisMonth()): number {
  const series = flowSeries(db, months, shiftMonth(from, -1)).filter((f) => f.expense > 0)
  return series.length ? avg(series.map((f) => f.expense)) : monthFlow(db, from).expense
}

export function emergencyMonths(db: DB): number {
  const m = avgMonthlyExpense(db)
  if (!m) return 0
  return liquidCash(db) / m
}

/**
 * 다음 달 예산 자동 제안.
 * 최근 3개월 "중앙값"을 쓴다 — 한 달 크게 쓴 것이 다음 달 예산을 부풀리지 않게.
 * 제안일 뿐이고 사용자가 고칠 수 있어야 한다.
 */
export interface BudgetSuggestion {
  categoryId: string
  name: string
  icon: string
  grade: Grade
  /** 최근 3개월 중앙값 */
  suggested: number
  /** 이미 잡혀 있는 예산 */
  current: number | null
  months: number[]
}

export function suggestBudgets(db: DB, targetMonth: string, lookback = 3): BudgetSuggestion[] {
  const map = categoryMap(db)
  const keys = lastMonths(lookback, shiftMonth(targetMonth, -1))
  const perCategory: Record<string, number[]> = {}

  for (const m of keys) {
    // 예산으로 통제할 수 있는 것은 변동·개인 지출뿐이다.
    // 월세·보험 같은 고정비를 예산에 넣어 봐야 "지켰다/못 지켰다"가 의미 없다.
    const totals = categoryTotals(db, m, { fixed: false, business: false })
    const seen = new Set<string>()
    for (const t of totals) {
      ;(perCategory[t.categoryId] ||= []).push(t.amount)
      seen.add(t.categoryId)
    }
    // 그 달에 안 쓴 카테고리는 0으로 채워야 중앙값이 부풀지 않는다.
    for (const id of Object.keys(perCategory)) {
      if (!seen.has(id)) perCategory[id].push(0)
    }
  }

  return Object.entries(perCategory)
    .map(([id, values]) => {
      const c = map[id]
      const existing = db.budgets.find((b) => b.month === targetMonth && b.category_id === id)
      return {
        categoryId: id,
        name: c?.name ?? '분류 안 됨',
        icon: c?.icon ?? '❓',
        grade: c?.grade ?? ('want' as Grade),
        suggested: Math.round(median(values) / 1000) * 1000,
        current: existing ? existing.planned : null,
        months: values,
      }
    })
    .filter((s) => s.suggested > 0)
    .sort((a, b) => b.suggested - a.suggested)
}

/** 월간 결산용 한 덩어리. */
export interface MonthlyReport {
  month: string
  flow: MonthFlow
  prevFlow: MonthFlow
  netWorthNow: number
  netWorthPrev: number
  top: CategoryTotal[]
  deltas: ReturnType<typeof categoryDeltas>
  mix: GradeMix
  prevMix: GradeMix
  noSpendDays: number
  budgetKept: { kept: number; total: number }
}

export function monthlyReport(db: DB, month: string): MonthlyReport {
  const series = netWorthSeries(db, 24)
  const idx = series.findIndex((s) => s.month === month)
  const lines = budgetLines(db, month)
  const spentDays = new Set(
    db.transactions.filter((t) => t.direction === 'out' && !t.is_business && inMonth(t, month)).map((t) => t.date),
  )
  // 진행 중인 달은 아직 오지 않은 날을 무지출일로 세면 안 된다.
  const elapsed = month === thisMonth() ? new Date().getDate() : daysInMonth(month)
  return {
    month,
    flow: monthFlow(db, month),
    prevFlow: monthFlow(db, shiftMonth(month, -1)),
    netWorthNow: idx >= 0 ? series[idx].value : netWorth(db),
    netWorthPrev: idx > 0 ? series[idx - 1].value : netWorth(db),
    top: categoryTotals(db, month).slice(0, 5),
    deltas: categoryDeltas(db, month, 5),
    mix: gradeMix(db, month),
    prevMix: gradeMix(db, shiftMonth(month, -1)),
    noSpendDays: Math.max(0, elapsed - spentDays.size),
    budgetKept: { kept: lines.filter((l) => l.remain >= 0).length, total: lines.length },
  }
}
