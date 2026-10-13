'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Amount } from '@/components/amount'
import { IconCheck, IconChevronRight } from '@/components/icons'
import { Card, CardBody, CardHead } from '@/components/ui/card'
import { Pill, Progress } from '@/components/ui/bits'
import { krDate, thisMonth } from '@/lib/date'
import { pct, shortWon } from '@/lib/format'
import {
  gradeMix,
  monthFlow,
  noSpendStreak,
  spendable,
  upcomingFixed,
} from '@/lib/finance/selectors'
import { ROUTINES, PERIOD_LABEL, pastPeriods, periodKey, type RoutineKind } from '@/lib/routines'
import { useStore } from '@/lib/store'
import { cn, sum } from '@/lib/utils'

export default function RoutinesPage() {
  const db = useStore((s) => s.db)
  const toggle = useStore((s) => s.toggleRoutine)
  const month = thisMonth()

  const live = useMemo(() => {
    const mix = gradeMix(db, month)
    const total = mix.need + mix.want + mix.waste
    const upcoming = upcomingFixed(db, month)
    return {
      sp: spendable(db, month),
      wasteShare: total ? (mix.waste / total) * 100 : 0,
      waste: mix.waste,
      streak: noSpendStreak(db),
      upcoming: upcoming.slice(0, 3),
      upcomingTotal: sum(upcoming.map((u) => u.amount)),
      flow: monthFlow(db, month),
      yesterdayCount: db.transactions.filter((t) => t.date === yesterday()).length,
    }
  }, [db, month])

  const doneSet = useMemo(
    () => new Set(db.routine_logs.map((r) => `${r.kind}:${r.item}:${r.period}`)),
    [db.routine_logs],
  )

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="루틴"
          sub="기억력에 기대지 않는다. 주기마다 할 일을 띄우고, 한 것만 센다."
        />
        <CardBody className="pt-2">
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {ROUTINES.map((r) => {
              const key = periodKey(r.kind)
              const done = r.items.filter((it) => doneSet.has(`${r.kind}:${it.id}:${key}`)).length
              return (
                <div key={r.kind} className="rounded-md bg-surface-2 px-1 py-2">
                  <p className="text-[10px] text-faint">{r.title}</p>
                  <p
                    className={cn(
                      'tnum mt-0.5 text-[14px] font-bold',
                      done === r.items.length ? 'text-good' : 'text-fg',
                    )}
                  >
                    {done}/{r.items.length}
                  </p>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* 이번 주기에 실제로 봐야 할 숫자 */}
      <Card className="border-accent/25">
        <CardHead title="지금 상황" sub="체크하기 전에 이 숫자부터 본다" />
        <CardBody className="space-y-1.5 pt-2">
          <Live
            label="예산 소진율"
            value={`${pct(live.sp.usedPct, 0)}`}
            note={live.sp.paceGapPp > 20 ? `날짜보다 ${pct(live.sp.paceGapPp, 0)} 빠르다` : '속도는 괜찮다'}
            tone={live.sp.paceGapPp > 20 ? 'warn' : 'good'}
            href="/budget"
          />
          <Live
            label="낭비 비중"
            value={pct(live.wasteShare, 1)}
            note={`이번 달 ${shortWon(live.waste)}원`}
            tone={live.wasteShare > 10 ? 'warn' : 'good'}
            href="/spending"
          />
          <Live
            label="무지출일 연속"
            value={`${live.streak}일`}
            note={live.streak > 0 ? '이어 가는 중' : '어제는 지출이 있었다'}
            tone={live.streak > 0 ? 'good' : 'muted'}
          />
          <Live
            label="어제 기록"
            value={`${live.yesterdayCount}건`}
            note={live.yesterdayCount === 0 ? '빠진 게 없는지 확인' : '기록됨'}
            tone={live.yesterdayCount === 0 ? 'warn' : 'good'}
            href="/add"
          />
          {live.upcoming.length ? (
            <div className="mt-1 rounded-md bg-surface-2 p-2.5">
              <p className="text-[11px] font-medium text-muted">
                다음 고정지출 {live.upcoming.length}건 · <Amount value={live.upcomingTotal} short />
              </p>
              <ul className="mt-1 space-y-0.5">
                {live.upcoming.map((u) => (
                  <li key={`${u.label}-${u.date}`} className="flex justify-between text-[12px] text-faint">
                    <span>
                      {krDate(u.date)} {u.label}
                    </span>
                    <Amount value={u.amount} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {ROUTINES.map((r) => {
        const key = periodKey(r.kind)
        const done = r.items.filter((it) => doneSet.has(`${r.kind}:${it.id}:${key}`)).length
        const rate = streakRate(doneSet, r.kind, r.items.length)
        return (
          <Card key={r.kind}>
            <CardHead
              title={r.title}
              sub={`${r.cadence} · 최근 ${rate.window}${PERIOD_LABEL[r.kind]} 중 ${rate.done}${PERIOD_LABEL[r.kind]} 완료`}
              right={
                <Pill tone={done === r.items.length ? 'good' : done > 0 ? 'warn' : 'muted'}>
                  {done}/{r.items.length}
                </Pill>
              }
            />
            <CardBody className="pt-2">
              <Progress
                value={(done / r.items.length) * 100}
                tone={done === r.items.length ? 'good' : 'accent'}
              />
              <div className="mt-3 space-y-1">
                {r.items.map((it) => {
                  const isDone = doneSet.has(`${r.kind}:${it.id}:${key}`)
                  return (
                    <div key={it.id} className="flex items-start gap-2.5 rounded-md px-1 py-1.5">
                      <button
                        type="button"
                        onClick={() => void toggle(r.kind, it.id, key)}
                        aria-pressed={isDone}
                        aria-label={`${it.label} ${isDone ? '완료 취소' : '완료'}`}
                        className={cn(
                          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors',
                          isDone ? 'border-good bg-good text-bg' : 'border-line bg-surface-2',
                        )}
                      >
                        {isDone ? <IconCheck width={13} height={13} /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[13px] font-medium', isDone && 'text-faint line-through')}>
                          {it.label}
                        </p>
                        <p className="text-[11px] leading-snug text-faint">{it.why}</p>
                      </div>
                      {it.href ? (
                        <Link
                          href={it.href}
                          className="mt-0.5 shrink-0 text-faint hover:text-fg"
                          aria-label={`${it.label} 화면으로`}
                        >
                          <IconChevronRight width={16} height={16} />
                        </Link>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        )
      })}

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-faint">
        체크는 기록으로 남는다. 완벽하게 지키는 것이 목적이 아니라, 몇 번이나 돌아왔는지를 보는 것이 목적이다.
      </p>
    </div>
  )

  function streakRate(set: Set<string>, kind: RoutineKind, itemCount: number) {
    const window = kind === 'daily' ? 14 : kind === 'weekly' ? 8 : kind === 'monthly' ? 6 : 4
    const periods = pastPeriods(kind, window)
    const def = ROUTINES.find((x) => x.kind === kind)!
    const done = periods.filter((p) => def.items.every((it) => set.has(`${kind}:${it.id}:${p}`))).length
    void itemCount
    return { window, done }
  }
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Live({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string
  value: string
  note: string
  tone: 'good' | 'warn' | 'muted'
  href?: string
}) {
  const body = (
    <div className="flex items-center gap-2.5 rounded-md bg-surface-2 px-2.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-muted">{label}</span>
        <span className="block text-[11px] text-faint">{note}</span>
      </span>
      <span
        className={cn(
          'tnum text-[15px] font-semibold',
          tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-fg',
        )}
      >
        {value}
      </span>
      {href ? <IconChevronRight width={15} height={15} className="shrink-0 text-faint" /> : null}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}
