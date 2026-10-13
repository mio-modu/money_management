import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface', className)} {...p} />
}

export function CardHead({
  title,
  sub,
  right,
  className,
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs leading-snug text-faint">{sub}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3.5', className)} {...p} />
}

export function Row({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', className)}>
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right">
        <span className="tnum text-sm font-medium">{value}</span>
        {sub ? <span className="ml-1.5 text-xs text-faint">{sub}</span> : null}
      </span>
    </div>
  )
}
