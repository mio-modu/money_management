import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconArrowDown, IconArrowUp } from '@/components/icons'
import { shortWon, won } from '@/lib/format'

/**
 * 대시보드 최상단의 큰 숫자. 축약(125만)을 크게, 정확한 값(1,250,000원)을 작게
 * 함께 보여 준다 — 한눈에 읽히되 틀린 인상을 주지 않게.
 */
export function BigNumber({
  label,
  value,
  delta,
  deltaLabel,
  tone = 'neutral',
  suffix = '원',
  note,
  right,
}: {
  label: string
  value: number
  delta?: number
  deltaLabel?: string
  tone?: 'neutral' | 'danger' | 'warn' | 'good'
  suffix?: string
  note?: ReactNode
  right?: ReactNode
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'good'
          ? 'text-good'
          : 'text-fg'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {right}
      </div>
      <div className="mt-1 flex items-end gap-2">
        <span className={cn('amount tnum text-[32px] font-bold leading-none tracking-tight', toneClass)}>
          {shortWon(value)}
          <span className="ml-0.5 text-[18px] font-semibold">{suffix}</span>
        </span>
        {delta != null && delta !== 0 ? (
          <span
            className={cn(
              'amount tnum mb-0.5 inline-flex items-center gap-0.5 text-[13px] font-semibold',
              delta > 0 ? 'text-good' : 'text-danger',
            )}
          >
            {delta > 0 ? <IconArrowUp width={13} height={13} /> : <IconArrowDown width={13} height={13} />}
            {shortWon(Math.abs(delta))}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
        <span className="amount tnum">{won(value)}원</span>
        {deltaLabel ? <span>· {deltaLabel}</span> : null}
      </div>
      {note ? <div className="mt-1.5 text-[12px] leading-snug text-muted">{note}</div> : null}
    </div>
  )
}
