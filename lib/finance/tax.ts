import { lastMonths, thisMonth } from '../date'
import type { DB } from '../types'
import { sum } from '../utils'
import { monthFlow } from './selectors'

export interface TaxView {
  month: string
  businessIncome: number
  businessExpense: number
  /** 부가세 예상 — 매출세액 − 매입세액(간단 추정) */
  vat: number
  /** 종합소득세 예상 — (수입 − 비용) × 설정 세율 */
  incomeTax: number
  required: number
  reserved: number
  shortfall: number
  /** 세금 떼고 실제 내 돈 */
  netOwn: number
  coverPct: number
}

/**
 * 사업 수입은 전부 내 돈이 아니다. 들어온 순간 세금 몫을 떼어 놓고 봐야
 * 수입을 과대평가하지 않는다. 이 함수가 그 "실제 내 돈"을 만든다.
 */
export function taxView(db: DB, month = thisMonth()): TaxView {
  const f = monthFlow(db, month)
  const { vat_rate, income_tax_rate } = db.settings

  // 부가세: 매출의 10/110 − 매입의 10/110 (일반과세자 기준 단순 추정)
  const vatOut = f.businessIncome * (vat_rate / (100 + vat_rate))
  const vatIn = f.businessExpense * (vat_rate / (100 + vat_rate))
  const vat = Math.max(0, vatOut - vatIn)

  const supply = f.businessIncome - vatOut
  const expenseSupply = f.businessExpense - vatIn
  const incomeTax = Math.max(0, (supply - expenseSupply) * (income_tax_rate / 100))

  const required = Math.round(vat + incomeTax)
  const reserved = db.tax_reserve.find((r) => r.month === month)?.reserved ?? 0

  return {
    month,
    businessIncome: f.businessIncome,
    businessExpense: f.businessExpense,
    vat: Math.round(vat),
    incomeTax: Math.round(incomeTax),
    required,
    reserved,
    shortfall: Math.max(0, required - reserved),
    netOwn: Math.round(f.businessIncome - f.businessExpense - required),
    coverPct: required > 0 ? (reserved / required) * 100 : 100,
  }
}

export function taxYearView(db: DB, months = 12) {
  const views = lastMonths(months).map((m) => taxView(db, m))
  return {
    views,
    required: sum(views.map((v) => v.required)),
    reserved: sum(views.map((v) => v.reserved)),
    shortfall: sum(views.map((v) => v.shortfall)),
    businessIncome: sum(views.map((v) => v.businessIncome)),
  }
}

export interface ReceivableView {
  id: string
  client: string
  amount: number
  due_at: string
  /** 지연 일수. 양수면 밀린 것 */
  overdueDays: number
  memo: string | null
}

export function openReceivables(db: DB, now = new Date()): ReceivableView[] {
  const todayKey = now.toISOString().slice(0, 10)
  return db.receivables
    .filter((r) => !r.paid_at)
    .map((r) => ({
      id: r.id,
      client: r.client,
      amount: r.amount,
      due_at: r.due_at,
      overdueDays: Math.floor(
        (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${r.due_at}T00:00:00Z`)) / 86400000,
      ),
      memo: r.memo,
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
}
