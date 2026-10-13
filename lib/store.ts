'use client'

import { create } from 'zustand'
import { mergeAlerts } from './agent/engine'
import { adapter, hasSupabase } from './data'
import { blankDB } from './data/local'
import { daysAgo, thisMonth, today } from './date'
import type {
  Account,
  Alert,
  Asset,
  Budget,
  DB,
  Debt,
  Goal,
  Receivable,
  Rule,
  RoutineLog,
  Settings,
  Subscription,
  TableName,
  Transaction,
} from './types'
import { uid } from './utils'

type Row<T extends TableName> = DB[T][number]

interface State {
  db: DB
  ready: boolean
  mode: 'local' | 'supabase'
  /** 보고 있는 월 (yyyy-MM) */
  month: string
  error: string | null
  /** PIN 잠금이 걸려 있는 동안 true */
  locked: boolean

  init: () => Promise<void>
  setMonth: (m: string) => void
  unlock: (pin: string) => boolean
  lock: () => void

  add: <T extends TableName>(table: T, row: Row<T>) => Promise<void>
  patch: <T extends TableName>(table: T, id: string, p: Partial<Row<T>>) => Promise<void>
  drop: <T extends TableName>(table: T, id: string) => Promise<void>
  setSettings: (p: Partial<Settings>) => Promise<void>

  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>
  upsertBudget: (categoryId: string, month: string, planned: number, carryover?: boolean) => Promise<void>
  setReserve: (month: string, reserved: number, required: number, businessIncome: number) => Promise<void>
  toggleRoutine: (kind: string, item: string, period: string) => Promise<void>

  /** 60일 이상 미사용 구독을 zombie 로 자동 태깅한다 */
  syncSubscriptions: () => Promise<void>
  markAlertDone: (id: string) => Promise<void>
  dismissAlert: (id: string) => Promise<void>
  refreshAgent: () => Promise<void>

  replaceAll: (db: DB) => Promise<void>
}

export const useStore = create<State>((set, get) => ({
  db: blankDB(),
  ready: false,
  mode: hasSupabase ? 'supabase' : 'local',
  month: thisMonth(),
  error: null,
  locked: false,

  async init() {
    try {
      const db = await adapter().load()
      set({ db, ready: true, locked: Boolean(db.settings.pin) })
      await get().refreshAgent()
    } catch (e) {
      set({ ready: true, error: e instanceof Error ? e.message : String(e) })
    }
  },

  setMonth(m) {
    set({ month: m })
  },

  unlock(pin) {
    const real = get().db.settings.pin
    if (!real || pin === real) {
      set({ locked: false })
      return true
    }
    return false
  },

  lock() {
    if (get().db.settings.pin) set({ locked: true })
  },

  async add(table, row) {
    set((s) => ({ db: { ...s.db, [table]: [row, ...(s.db[table] as Row<typeof table>[])] } }))
    await adapter().insert(table, row)
  },

  async patch(table, id, p) {
    set((s) => ({
      db: {
        ...s.db,
        [table]: (s.db[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...p } : r)),
      },
    }))
    await adapter().update(table, id, p)
  },

  async drop(table, id) {
    set((s) => ({
      db: { ...s.db, [table]: (s.db[table] as { id: string }[]).filter((r) => r.id !== id) },
    }))
    await adapter().remove(table, id)
  },

  async setSettings(p) {
    const next = { ...get().db.settings, ...p }
    set((s) => ({ db: { ...s.db, settings: next } }))
    await adapter().saveSettings(next)
  },

  async addTransaction(t) {
    const row: Transaction = { ...t, id: uid('t-'), created_at: new Date().toISOString() }
    await get().add('transactions', row)
    // 사업 수입이 들어오면 세금 적립 필요액을 바로 다시 계산한다.
    await get().refreshAgent()
  },

  async upsertBudget(categoryId, month, planned, carryover = false) {
    const found = get().db.budgets.find((b) => b.category_id === categoryId && b.month === month)
    if (found) {
      await get().patch('budgets', found.id, { planned, carryover_enabled: carryover })
    } else {
      const row: Budget = {
        id: uid('b-'),
        category_id: categoryId,
        month,
        planned,
        carryover_enabled: carryover,
      }
      await get().add('budgets', row)
    }
    await get().refreshAgent()
  },

  async setReserve(month, reserved, required, businessIncome) {
    const found = get().db.tax_reserve.find((r) => r.month === month)
    if (found) {
      await get().patch('tax_reserve', found.id, { reserved, required, business_income: businessIncome })
    } else {
      await get().add('tax_reserve', {
        id: uid('tr-'),
        month,
        reserved,
        required,
        business_income: businessIncome,
      })
    }
    await get().refreshAgent()
  },

  async toggleRoutine(kind, item, period) {
    const found = get().db.routine_logs.find(
      (r) => r.kind === kind && r.item === item && r.period === period,
    )
    if (found) {
      await get().drop('routine_logs', found.id)
    } else {
      const row: RoutineLog = {
        id: uid('rl-'),
        kind,
        item,
        period,
        done_at: new Date().toISOString(),
      }
      await get().add('routine_logs', row)
    }
  },

  async syncSubscriptions() {
    const { db } = get()
    const limit = db.rules.find((r) => r.code === 'ZOMBIE_SUB')?.params?.days ?? 60
    const now = new Date()
    for (const s of db.subscriptions) {
      if (s.status === 'cancelled') continue
      const unused = s.last_used_at ? daysAgo(s.last_used_at, now) : null
      const next = unused !== null && unused >= limit ? 'zombie' : 'active'
      if (s.status !== next) await get().patch('subscriptions', s.id, { status: next })
    }
  },

  async markAlertDone(id) {
    await get().patch('alerts', id, { action_taken: true })
  },

  async dismissAlert(id) {
    await get().patch('alerts', id, { dismissed_at: new Date().toISOString() })
  },

  async refreshAgent() {
    await get().syncSubscriptions()
    const { db } = get()
    const { alerts } = mergeAlerts(db, new Date())
    const changed =
      alerts.length !== db.alerts.length ||
      alerts.some((a, i) => db.alerts[i]?.id !== a.id || db.alerts[i]?.message !== a.message)
    if (!changed) return
    set((s) => ({ db: { ...s.db, alerts } }))
    try {
      await adapter().replace('alerts', alerts)
    } catch {
      // 알림은 언제든 다시 계산되므로 저장 실패는 치명적이지 않다.
    }
  },

  async replaceAll(db) {
    set({ db })
    await adapter().reset(db)
    await get().refreshAgent()
  },
}))

// ── 편의 selector hooks ───────────────────────────────────────
export const useDB = () => useStore((s) => s.db)
export const useMonth = () => useStore((s) => s.month)
export const useSettings = () => useStore((s) => s.db.settings)

export type { Account, Alert, Asset, Budget, Debt, Goal, Receivable, Rule, Subscription, Transaction }
export { today, thisMonth }
