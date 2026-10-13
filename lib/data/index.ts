import type { DataAdapter } from './adapter'
import { localAdapter } from './local'
import { hasSupabase } from './supabase-client'
import { supabaseAdapter } from './supabase'

export { hasSupabase }
export type { DataAdapter }

export function adapter(): DataAdapter {
  return hasSupabase ? supabaseAdapter : localAdapter
}
