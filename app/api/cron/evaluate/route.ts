import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_RULES, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '@/lib/defaults'
import { EMPTY_TABLES } from '@/lib/data/adapter'
import { mergeAlerts } from '@/lib/agent/engine'
import type { DB, Settings, TableName } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TABLES = Object.keys(EMPTY_TABLES) as TableName[]

/**
 * 매일 자정 규칙 평가.
 *
 * Supabase + 서비스 키가 설정돼 있을 때만 서버에서 돈다. 로컬 모드에서는 데이터가
 * 브라우저 안에만 있으므로 서버가 평가할 대상이 없다 — 그 경우 앱을 열 때,
 * 그리고 열어 둔 채 자정이 지날 때 클라이언트가 같은 엔진으로 평가한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({
      mode: 'client',
      evaluated: 0,
      message:
        '서버 평가가 꺼져 있다. Supabase URL 과 SUPABASE_SERVICE_ROLE_KEY 를 설정하면 여기서 돈다. ' +
        '지금은 앱을 열 때와 자정이 지날 때 클라이언트가 같은 엔진으로 평가한다.',
    })
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: users, error } = await sb.from('settings').select('user_id, data')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { user_id: string; alerts: number; added: number }[] = []

  for (const row of users ?? []) {
    const userId = row.user_id as string
    const db = { ...structuredClone(EMPTY_TABLES), settings: { ...DEFAULT_SETTINGS } } as DB

    const fetched = await Promise.all(TABLES.map((t) => sb.from(t).select('*').eq('user_id', userId)))
    TABLES.forEach((t, i) => {
      const rows = (fetched[i].data ?? []) as Record<string, unknown>[]
      ;(db as unknown as Record<string, unknown[]>)[t] = rows.map(({ user_id: _u, ...rest }) => rest)
    })
    db.settings = { ...DEFAULT_SETTINGS, ...((row.data as Partial<Settings>) ?? {}) }
    if (db.categories.length === 0) db.categories = structuredClone(DEFAULT_CATEGORIES)
    if (db.rules.length === 0) db.rules = structuredClone(DEFAULT_RULES)

    const { alerts, added } = mergeAlerts(db, new Date())

    await sb.from('alerts').delete().eq('user_id', userId)
    if (alerts.length) {
      await sb.from('alerts').insert(alerts.map((a) => ({ ...a, user_id: userId })))
    }
    results.push({ user_id: userId, alerts: alerts.length, added: added.length })
  }

  return NextResponse.json({ mode: 'server', evaluated: results.length, results })
}
