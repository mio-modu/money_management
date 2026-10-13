import { createBrowserClient } from '@supabase/ssr'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** 키가 둘 다 있을 때만 Supabase 모드. 아니면 로컬 모드로 돈다. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let cached: ReturnType<typeof createBrowserClient> | null = null

export function supabase() {
  if (!hasSupabase) throw new Error('Supabase 환경변수가 없습니다 (로컬 모드)')
  cached ||= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cached
}
