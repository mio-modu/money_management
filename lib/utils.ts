import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = ''): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return prefix + crypto.randomUUID()
  }
  return prefix + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function sum(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0)
}

export function median(ns: number[]) {
  if (ns.length === 0) return 0
  const s = [...ns].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function avg(ns: number[]) {
  return ns.length ? sum(ns) / ns.length : 0
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const it of items) {
    const k = key(it)
    ;(out[k] ||= []).push(it)
  }
  return out
}
