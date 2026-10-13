import { DEFAULT_CATEGORIES, DEFAULT_RULES, DEFAULT_SETTINGS } from '../defaults'
import type { DB, Settings } from '../types'
import { EMPTY_TABLES, type DataAdapter, type Row } from './adapter'

const KEY = 'moneyguard:db:v1'

function blank(): DB {
  return {
    ...structuredClone(EMPTY_TABLES),
    categories: structuredClone(DEFAULT_CATEGORIES),
    rules: structuredClone(DEFAULT_RULES),
    settings: { ...DEFAULT_SETTINGS },
  } as DB
}

/** 제네릭 테이블 쓰기에서 타입 교집합이 걸리지 않게 통로를 하나 둔다. */
function bag(db: DB): Record<string, { id: string }[]> {
  return db as unknown as Record<string, { id: string }[]>
}

function read(): DB {
  if (typeof window === 'undefined') return blank()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return blank()
    const parsed = JSON.parse(raw) as Partial<DB>
    // 스키마가 늘어나도 예전 저장본이 깨지지 않게 빈 테이블로 메꾼다.
    const base = blank()
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      categories: parsed.categories?.length ? parsed.categories : base.categories,
      rules: parsed.rules?.length ? parsed.rules : base.rules,
    } as DB
  } catch {
    return blank()
  }
}

function write(db: DB) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // 용량 초과 — 조용히 넘긴다. 다음 쓰기에서 다시 시도된다.
  }
}

export const localAdapter: DataAdapter = {
  mode: 'local',

  async load() {
    return read()
  },

  async insert(table, row) {
    const db = read()
    ;(db[table] as Row<typeof table>[]).unshift(row)
    write(db)
  },

  async insertMany(table, rows) {
    const db = read()
    ;(db[table] as Row<typeof table>[]).unshift(...rows)
    write(db)
  },

  async update(table, id, patch) {
    const db = read()
    const list = db[table] as { id: string }[]
    const i = list.findIndex((r) => r.id === id)
    if (i >= 0) list[i] = { ...list[i], ...patch }
    write(db)
  },

  async remove(table, id) {
    const db = read()
    bag(db)[table] = bag(db)[table].filter((r) => r.id !== id)
    write(db)
  },

  async replace(table, rows) {
    const db = read()
    bag(db)[table] = rows as { id: string }[]
    write(db)
  },

  async saveSettings(settings: Settings) {
    const db = read()
    db.settings = settings
    write(db)
  },

  async reset(db) {
    write(db)
  },
}

export { blank as blankDB }
