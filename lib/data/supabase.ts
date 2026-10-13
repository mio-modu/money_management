import { DEFAULT_CATEGORIES, DEFAULT_RULES, DEFAULT_SETTINGS } from '../defaults'
import type { DB, Settings, TableName } from '../types'
import { EMPTY_TABLES, type DataAdapter, type Row } from './adapter'
import { supabase } from './supabase-client'

const TABLES = Object.keys(EMPTY_TABLES) as TableName[]

async function userId(): Promise<string> {
  const { data } = await supabase().auth.getUser()
  if (!data.user) throw new Error('로그인이 필요합니다')
  return data.user.id
}

function strip<T>(rows: (T & { user_id?: string })[] | null): T[] {
  return (rows ?? []).map(({ user_id: _drop, ...rest }) => rest as T)
}

export const supabaseAdapter: DataAdapter = {
  mode: 'supabase',

  async load() {
    const db = { ...structuredClone(EMPTY_TABLES), settings: { ...DEFAULT_SETTINGS } } as DB
    const sb = supabase()

    const results = await Promise.all(TABLES.map((t) => sb.from(t).select('*')))
    TABLES.forEach((t, i) => {
      const { data, error } = results[i]
      if (error) throw new Error(`${t} 읽기 실패: ${error.message}`)
      ;(db as unknown as Record<string, unknown[]>)[t] = strip(data as Record<string, unknown>[])
    })

    const { data: s } = await sb.from('settings').select('data').maybeSingle()
    db.settings = { ...DEFAULT_SETTINGS, ...((s?.data as Partial<Settings>) ?? {}) }

    // 첫 로그인이면 기본 카테고리/규칙을 심어 준다.
    if (db.categories.length === 0) {
      await this.insertMany('categories', structuredClone(DEFAULT_CATEGORIES))
      db.categories = structuredClone(DEFAULT_CATEGORIES)
    }
    if (db.rules.length === 0) {
      await this.insertMany('rules', structuredClone(DEFAULT_RULES))
      db.rules = structuredClone(DEFAULT_RULES)
    }
    return db
  },

  async insert(table, row) {
    const uid = await userId()
    const { error } = await supabase()
      .from(table)
      .insert({ ...row, user_id: uid })
    if (error) throw new Error(error.message)
  },

  async insertMany(table, rows) {
    if (rows.length === 0) return
    const uid = await userId()
    const { error } = await supabase()
      .from(table)
      .insert(rows.map((r) => ({ ...r, user_id: uid })))
    if (error) throw new Error(error.message)
  },

  async update(table, id, patch) {
    const { error } = await supabase().from(table).update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async remove(table, id) {
    const { error } = await supabase().from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async replace(table, rows) {
    const uid = await userId()
    const sb = supabase()
    const { error: delErr } = await sb.from(table).delete().eq('user_id', uid)
    if (delErr) throw new Error(delErr.message)
    if (rows.length) {
      const { error } = await sb.from(table).insert(rows.map((r) => ({ ...r, user_id: uid })))
      if (error) throw new Error(error.message)
    }
  },

  async saveSettings(settings) {
    const uid = await userId()
    const { error } = await supabase()
      .from('settings')
      .upsert({ user_id: uid, data: settings }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  },

  async reset(db) {
    for (const t of TABLES) {
      await this.replace(t, db[t] as Row<TableName>[])
    }
    await this.saveSettings(db.settings)
  },
}
