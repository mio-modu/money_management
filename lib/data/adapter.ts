import type { DB, Settings, TableName } from '../types'

export type Row<T extends TableName> = DB[T][number]

/**
 * 저장소 교체 지점. 로컬(브라우저)과 Supabase 가 같은 인터페이스를 쓴다.
 * 환경변수가 없으면 로컬로 떨어지므로 키 없이도 앱 전체가 돈다.
 */
export interface DataAdapter {
  mode: 'local' | 'supabase'
  load(): Promise<DB>
  insert<T extends TableName>(table: T, row: Row<T>): Promise<void>
  insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<void>
  remove<T extends TableName>(table: T, id: string): Promise<void>
  replace<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  /** 전체 초기화 (더미 데이터 주입 / 데이터 삭제) */
  reset(db: DB): Promise<void>
}

export const EMPTY_TABLES: { [K in TableName]: [] } = {
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  subscriptions: [],
  assets: [],
  debts: [],
  goals: [],
  tax_reserve: [],
  receivables: [],
  alerts: [],
  rules: [],
  routine_logs: [],
}
