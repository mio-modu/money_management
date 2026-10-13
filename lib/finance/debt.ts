import type { Debt } from '../types'
import { sum } from '../utils'

export type Strategy = 'snowball' | 'avalanche'

export interface PayoffResult {
  strategy: Strategy
  months: number
  totalInterest: number
  totalPaid: number
  /** 부채별 완제 시점(개월) */
  order: { id: string; name: string; paidOffAt: number; interest: number }[]
  /** 월별 총 잔액 추이 */
  series: { month: number; balance: number }[]
  /** 월 상환 여력이 최소 상환액보다 적으면 계산이 안 된다 */
  insufficient: boolean
}

const MAX_MONTHS = 600

/**
 * 눈덩이(작은 잔액부터) vs 눈사태(높은 이자부터) 상환 시뮬레이션.
 * 다 갚은 부채의 최소 상환액은 다음 부채로 굴려 넣는다 — 이게 두 전략의 핵심이다.
 */
export function simulate(debts: Debt[], extraMonthly: number, strategy: Strategy): PayoffResult {
  const live = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, interestPaid: 0, paidOffAt: 0 }))

  const minTotal = sum(live.map((d) => d.min_payment))
  const budget = minTotal + Math.max(0, extraMonthly)

  const result: PayoffResult = {
    strategy,
    months: 0,
    totalInterest: 0,
    totalPaid: 0,
    order: [],
    series: [{ month: 0, balance: sum(live.map((d) => d.balance)) }],
    insufficient: false,
  }
  if (live.length === 0) return result

  // 최소 상환액 합이 이자 합보다 작으면 원금이 줄지 않는다.
  const monthlyInterest = sum(live.map((d) => (d.balance * d.interest_rate) / 100 / 12))
  if (budget <= monthlyInterest) {
    result.insufficient = true
    return result
  }

  const priority = () =>
    [...live]
      .filter((d) => d.balance > 0)
      .sort((a, b) =>
        strategy === 'snowball' ? a.balance - b.balance : b.interest_rate - a.interest_rate,
      )

  let month = 0
  while (live.some((d) => d.balance > 0) && month < MAX_MONTHS) {
    month++
    // 1) 이자 발생
    for (const d of live) {
      if (d.balance <= 0) continue
      const i = (d.balance * d.interest_rate) / 100 / 12
      d.balance += i
      d.interestPaid += i
      result.totalInterest += i
    }
    // 2) 최소 상환
    let pool = budget
    for (const d of live) {
      if (d.balance <= 0) continue
      const pay = Math.min(d.min_payment, d.balance, pool)
      d.balance -= pay
      pool -= pay
      result.totalPaid += pay
    }
    // 3) 남은 여력을 우선순위 1번에 전부
    for (const d of priority()) {
      if (pool <= 0) break
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
      result.totalPaid += pay
    }
    // 4) 완제 기록
    for (const d of live) {
      if (d.balance <= 0.5 && d.paidOffAt === 0) {
        d.balance = 0
        d.paidOffAt = month
      }
    }
    result.series.push({ month, balance: Math.round(sum(live.map((d) => d.balance))) })
  }

  result.months = month
  result.order = live
    .map((d) => ({ id: d.id, name: d.name, paidOffAt: d.paidOffAt, interest: Math.round(d.interestPaid) }))
    .sort((a, b) => a.paidOffAt - b.paidOffAt)
  result.totalInterest = Math.round(result.totalInterest)
  result.totalPaid = Math.round(result.totalPaid)
  return result
}

export interface Comparison {
  snowball: PayoffResult
  avalanche: PayoffResult
  /** 눈사태가 눈덩이보다 아끼는 이자 */
  interestSaved: number
  /** 눈사태가 눈덩이보다 단축되는 개월 */
  monthsSaved: number
  recommend: Strategy
  reason: string
}

export function compare(debts: Debt[], extraMonthly: number): Comparison {
  const snowball = simulate(debts, extraMonthly, 'snowball')
  const avalanche = simulate(debts, extraMonthly, 'avalanche')
  const interestSaved = snowball.totalInterest - avalanche.totalInterest
  const monthsSaved = snowball.months - avalanche.months
  // 차이가 작으면 먼저 하나를 없애는 성취감이 유지에 더 유리하다.
  const recommend: Strategy = interestSaved > snowball.totalInterest * 0.03 ? 'avalanche' : 'snowball'
  return {
    snowball,
    avalanche,
    interestSaved,
    monthsSaved,
    recommend,
    reason:
      recommend === 'avalanche'
        ? '이자 차이가 커서 눈사태(고금리 우선)가 유리하다.'
        : '두 방식의 이자 차이가 3% 안쪽이다. 하나를 빨리 없애는 눈덩이가 끝까지 가기 쉽다.',
  }
}

/** 추가 상환 n원을 넣으면 몇 달 단축되는지 */
export function marginalEffect(debts: Debt[], extraMonthly: number, strategy: Strategy, bump: number) {
  const base = simulate(debts, extraMonthly, strategy)
  const bumped = simulate(debts, extraMonthly + bump, strategy)
  return {
    monthsSaved: base.months - bumped.months,
    interestSaved: base.totalInterest - bumped.totalInterest,
  }
}
