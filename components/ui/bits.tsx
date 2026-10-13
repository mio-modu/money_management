'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight } from '@/components/icons'
import { shiftMonth, thisMonth } from '@/lib/date'

export function Progress({
  value,
  tone = 'accent',
  className,
  marker,
}: {
  /** 0~100 이상도 받는다. 100 초과는 빨갛게 넘친다. */
  value: number
  tone?: 'accent' | 'danger' | 'warn' | 'good'
  className?: string
  /** 기준선 위치(%) — 월 경과율 같은 것 */
  marker?: number
}) {
  const over = value > 100
  const toneClass = over
    ? 'bg-danger'
    : tone === 'danger'
      ? 'bg-danger'
      : tone === 'warn'
        ? 'bg-warn'
        : tone === 'good'
          ? 'bg-good'
          : 'bg-accent'
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', toneClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
      {marker != null && marker > 0 && marker < 100 ? (
        <div
          className="absolute top-0 h-full w-px bg-fg/50"
          style={{ left: `${marker}%` }}
          title="오늘까지 경과"
        />
      ) : null}
    </div>
  )
}

export function Pill({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: 'muted' | 'accent' | 'danger' | 'warn' | 'good'
  className?: string
}) {
  const map = {
    muted: 'bg-surface-2 text-muted',
    accent: 'bg-accent/15 text-accent',
    danger: 'bg-danger/15 text-danger',
    warn: 'bg-warn/15 text-warn',
    good: 'bg-good/15 text-good',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-5',
        map[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-md border border-line bg-surface p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[7px] px-2.5 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface-2 text-fg' : 'text-faint hover:text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MonthNav({
  month,
  onChange,
  className,
}: {
  month: string
  onChange: (m: string) => void
  className?: string
}) {
  const isCurrent = month >= thisMonth()
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="이전 달"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"
      >
        <IconChevronLeft width={18} height={18} />
      </button>
      <span className="tnum min-w-[88px] text-center text-sm font-semibold">
        {month.slice(0, 4)}.{month.slice(5, 7)}
      </span>
      <button
        type="button"
        aria-label="다음 달"
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 disabled:opacity-30"
      >
        <IconChevronRight width={18} height={18} />
      </button>
    </div>
  )
}

/** 데이터가 없을 때도 다음 행동을 안내한다. 빈 화면을 그냥 비우지 않는다. */
export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-[28rem] text-[13px] leading-relaxed text-faint">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-faint">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-accent/60'
