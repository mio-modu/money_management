'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { IconCheck, IconInfo, IconSparkle, IconWarn, IconX } from '@/components/icons'
import { SEVERITY_LABEL } from '@/lib/agent/engine'
import type { Alert } from '@/lib/types'
import { useStore } from '@/lib/store'

const TONE = {
  danger: { ring: 'border-danger/35 bg-danger/[0.07]', text: 'text-danger', Icon: IconWarn },
  warn: { ring: 'border-warn/30 bg-warn/[0.06]', text: 'text-warn', Icon: IconWarn },
  info: { ring: 'border-line bg-surface', text: 'text-accent', Icon: IconInfo },
  praise: { ring: 'border-good/30 bg-good/[0.06]', text: 'text-good', Icon: IconSparkle },
} as const

/** 모든 경고는 "그래서 뭘 해야 하는지" 한 문장과 실행 버튼을 달고 나온다. */
export function AlertCard({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  const markDone = useStore((s) => s.markAlertDone)
  const dismiss = useStore((s) => s.dismissAlert)
  const tone = TONE[alert.severity]

  return (
    <div className={cn('rounded-lg border p-3.5', tone.ring, alert.action_taken && 'opacity-60')}>
      <div className="flex items-start gap-2.5">
        <span className={cn('mt-0.5 shrink-0', tone.text)}>
          <tone.Icon width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold leading-snug">{alert.title}</p>
            <span className={cn('shrink-0 text-[10px] font-semibold uppercase', tone.text)}>
              {SEVERITY_LABEL[alert.severity]}
            </span>
          </div>
          <p className="amount-wrap mt-1 text-[13px] leading-relaxed text-muted">{alert.message}</p>
          {!compact && alert.action_label ? (
            <div className="mt-2.5 flex items-center gap-1.5">
              {alert.action_href ? (
                <Link
                  href={alert.action_href}
                  onClick={() => markDone(alert.id)}
                  className="inline-flex h-8 items-center rounded-md bg-surface-2 px-3 text-[13px] font-medium hover:bg-line"
                >
                  {alert.action_label}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => markDone(alert.id)}
                aria-label="처리했다고 표시"
                className="grid h-8 w-8 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-fg"
              >
                <IconCheck width={16} height={16} />
              </button>
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                aria-label="이 알림 숨기기"
                className="grid h-8 w-8 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-fg"
              >
                <IconX width={16} height={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
