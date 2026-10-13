import { daysAgo, today, ymd } from '../date'
import type { DB, Subscription } from '../types'
import { sum } from '../utils'
import { monthlyAmount, yearlyAmount } from './selectors'

export interface SubView extends Subscription {
  monthly: number
  yearly: number
  /** 마지막 사용일로부터 지난 날 수. 기록이 없으면 null */
  unusedDays: number | null
  isZombie: boolean
  /** 직전 가격 대비 인상률 % */
  raisePct: number | null
  daysToCharge: number
}

export function subViews(db: DB, now = new Date()): SubView[] {
  const limit = db.rules.find((r) => r.code === 'ZOMBIE_SUB')?.params?.days ?? 60
  return db.subscriptions
    .map((s) => {
      const unusedDays = s.last_used_at ? daysAgo(s.last_used_at, now) : null
      const hist = [...(s.price_history ?? [])].sort((a, b) => a.date.localeCompare(b.date))
      const prev = hist.length >= 2 ? hist[hist.length - 2].amount : null
      return {
        ...s,
        monthly: monthlyAmount(s.amount, s.cycle),
        yearly: yearlyAmount(s.amount, s.cycle),
        unusedDays,
        isZombie: s.status !== 'cancelled' && unusedDays !== null && unusedDays >= limit,
        raisePct: prev && prev > 0 && s.amount > prev ? ((s.amount - prev) / prev) * 100 : null,
        daysToCharge: -daysAgo(s.next_charge_at, now),
      }
    })
    .sort((a, b) => {
      if (a.status === 'cancelled' && b.status !== 'cancelled') return 1
      if (b.status === 'cancelled' && a.status !== 'cancelled') return -1
      // 끊을 후보부터 위로: 좀비 → 만족도 낮은 순 → 금액 큰 순
      if (a.isZombie !== b.isZombie) return a.isZombie ? -1 : 1
      if (a.value_rating !== b.value_rating) return a.value_rating - b.value_rating
      return b.yearly - a.yearly
    })
}

export interface SubSummary {
  activeCount: number
  monthlyTotal: number
  /** 연간 환산 합계 — 이 숫자가 보통 제일 충격적이다 */
  yearlyTotal: number
  zombies: SubView[]
  zombieYearly: number
  /** 만족도 2 이하 */
  lowValue: SubView[]
  lowValueYearly: number
  cancelledYearlySaved: number
}

export function subSummary(views: SubView[]): SubSummary {
  const active = views.filter((s) => s.status !== 'cancelled')
  const zombies = active.filter((s) => s.isZombie)
  const lowValue = active.filter((s) => s.value_rating <= 2 && !s.isZombie)
  return {
    activeCount: active.length,
    monthlyTotal: sum(active.map((s) => s.monthly)),
    yearlyTotal: sum(active.map((s) => s.yearly)),
    zombies,
    zombieYearly: sum(zombies.map((s) => s.yearly)),
    lowValue,
    lowValueYearly: sum(lowValue.map((s) => s.yearly)),
    cancelledYearlySaved: sum(views.filter((s) => s.status === 'cancelled').map((s) => s.yearly)),
  }
}

/** 다음 결제일을 주기만큼 앞으로 민다. */
export function advanceCharge(sub: Subscription, from = today()): string {
  const d = new Date(`${sub.next_charge_at}T00:00:00`)
  const base = new Date(`${from}T00:00:00`)
  while (d <= base) {
    if (sub.cycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
    else if (sub.cycle === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
  }
  return ymd(d)
}

export const CYCLE_LABEL: Record<Subscription['cycle'], string> = {
  monthly: '월',
  yearly: '연',
  weekly: '주',
}
