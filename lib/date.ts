import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'

export const ymd = (d: Date | string) => format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM-dd')
export const ym = (d: Date | string) => format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM')
export const today = () => ymd(new Date())
export const thisMonth = () => ym(new Date())

export function monthRange(month: string) {
  const base = parseISO(`${month}-01`)
  return { from: ymd(startOfMonth(base)), to: ymd(endOfMonth(base)) }
}

/** month 로부터 n개월 전 월키. shiftMonth('2026-03', -2) → '2026-01' */
export function shiftMonth(month: string, n: number) {
  const base = parseISO(`${month}-01`)
  return ym(n >= 0 ? addMonths(base, n) : subMonths(base, -n))
}

/** 최근 n개월 월키 배열 (오래된 것부터). 기준월 포함. */
export function lastMonths(n: number, from = thisMonth()): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(from, -(n - 1 - i)))
}

export function monthProgress(month = thisMonth(), now = new Date()): number {
  const days = getDaysInMonth(parseISO(`${month}-01`))
  if (ym(now) !== month) return 1
  return now.getDate() / days
}

export function daysInMonth(month: string) {
  return getDaysInMonth(parseISO(`${month}-01`))
}

export function daysBetween(a: string, b: string) {
  return differenceInCalendarDays(parseISO(a), parseISO(b))
}

export function daysAgo(dateStr: string, now = new Date()) {
  return differenceInCalendarDays(now, parseISO(dateStr))
}

export const weekStart = (d: Date = new Date()) => ymd(startOfWeek(d, { weekStartsOn: 0 }))

export const MONTH_LABEL = (month: string) => `${Number(month.slice(5, 7))}월`

export function krDate(dateStr: string) {
  const d = parseISO(dateStr)
  return format(d, 'M월 d일')
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function weekdayOf(dateStr: string) {
  return WEEKDAYS[parseISO(dateStr).getDay()]
}
