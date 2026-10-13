'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { IconPlus, IconTrash } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Field, Pill, Progress, inputClass } from '@/components/ui/bits'
import { thisMonth, ymd } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import {
  avgMonthlyExpense,
  flowSeries,
  monthlyNeedForGoal,
  monthsUntil,
} from '@/lib/finance/selectors'
import { subSummary, subViews } from '@/lib/finance/subs'
import { useStore } from '@/lib/store'
import type { Goal } from '@/lib/types'
import { avg, uid } from '@/lib/utils'

export default function GoalsPage() {
  const db = useStore((s) => s.db)
  const add = useStore((s) => s.add)
  const patch = useStore((s) => s.patch)
  const drop = useStore((s) => s.drop)
  const refresh = useStore((s) => s.refreshAgent)
  const [adding, setAdding] = useState(false)

  const v = useMemo(() => {
    const views = subViews(db)
    const s = subSummary(views)
    // 최근 3개월 실제 저축 속도. 목표까지 걸리는 기간은 계획이 아니라 이 속도가 정한다.
    const capacity = Math.max(0, avg(flowSeries(db, 3, thisMonth()).map((f) => f.net)))
    const cuttable = [...views]
      .filter((x) => x.status !== 'cancelled')
      .sort((a, b) => (a.isZombie === b.isZombie ? a.value_rating - b.value_rating : a.isZombie ? -1 : 1))
      .slice(0, 3)
    return {
      capacity,
      cuttable,
      cutMonthly: cuttable.reduce((a, b) => a + b.monthly, 0),
      zombieMonthly: s.zombies.reduce((a, b) => a + b.monthly, 0),
      monthlyExpense: avgMonthlyExpense(db),
    }
  }, [db])

  const goals = [...db.goals].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="목표"
          sub={`지금 저축 속도 월 ${shortWon(v.capacity)}원 (최근 3개월 평균)`}
          right={
            <Button variant="ghost" size="sm" onClick={() => setAdding((x) => !x)}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        {adding ? (
          <CardBody className="border-t border-line pt-3">
            <GoalForm
              monthlyExpense={v.monthlyExpense}
              onDone={() => setAdding(false)}
              onAdd={async (row) => {
                await add('goals', row)
                await refresh()
              }}
            />
          </CardBody>
        ) : null}
      </Card>

      {goals.length === 0 && !adding ? (
        <Card>
          <Empty
            title="목표가 없다"
            body="목표가 없으면 남은 돈은 그냥 쓰인다. 비상자금 3개월분 하나만 걸어도 달라진다."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                목표 만들기
              </Button>
            }
          />
        </Card>
      ) : null}

      {goals.map((g) => {
        const remain = Math.max(0, g.target_amount - g.current_amount)
        const need = monthlyNeedForGoal(g)
        const monthsLeft = monthsUntil(g.deadline)
        const progress = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
        const atPace = v.capacity > 0 ? remain / v.capacity : Infinity
        const withCut = v.capacity + v.cutMonthly > 0 ? remain / (v.capacity + v.cutMonthly) : Infinity
        const saved = isFinite(atPace) && isFinite(withCut) ? Math.floor(atPace - withCut) : null
        const onTrack = v.capacity >= need

        return (
          <Card key={g.id}>
            <CardBody className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                    {g.name}
                    <Pill tone={onTrack ? 'good' : 'warn'}>{onTrack ? '속도 충분' : '속도 부족'}</Pill>
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {g.deadline}까지 {monthsLeft > 0 ? `${monthsLeft}개월 남음` : '기한 지남'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void drop('goals', g.id)}
                  aria-label="삭제"
                  className="text-faint hover:text-danger"
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="amount tnum text-[20px] font-bold">{shortWon(g.current_amount)}</span>
                  <span className="amount tnum text-[12px] text-faint">/ {shortWon(g.target_amount)}원</span>
                </div>
                <Progress className="mt-1.5" value={progress} tone={onTrack ? 'good' : 'warn'} />
                <p className="mt-1 text-[11px] text-faint">
                  {pct(progress, 0)} · 남은 금액 <Amount value={remain} short className="text-muted" />
                </p>
              </div>

              <div className="rounded-md bg-surface-2 p-2.5">
                <Row label="기한까지 맞추려면 월" value={<b className="text-fg"><Amount value={need} /></b>} />
                <Row
                  label="지금 속도로는"
                  value={isFinite(atPace) ? `${Math.ceil(atPace)}개월` : '도달 불가'}
                  sub={isFinite(atPace) ? undefined : '저축이 0 이하다'}
                />
              </div>

              {/* 구체적 행동으로 연결 — 이게 목표 화면의 전부다 */}
              {v.cuttable.length > 0 && remain > 0 ? (
                <div className="rounded-md border border-accent/30 bg-accent/[0.06] p-2.5">
                  <p className="text-[13px] leading-relaxed">
                    <b>{v.cuttable.map((c) => c.name).join(', ')}</b>를 해지하면 월{' '}
                    <Amount value={v.cutMonthly} short />이 더 들어온다.{' '}
                    {saved !== null && saved > 0 ? (
                      <>
                        목표가 <b className="text-accent">{saved}개월</b> 당겨진다.
                      </>
                    ) : isFinite(withCut) ? (
                      <>
                        그래도 {Math.ceil(withCut)}개월이 걸린다 — 지출을 더 줄이거나 기한을 늦춰야 한다.
                      </>
                    ) : (
                      <>그것만으로는 모자란다. 지출부터 줄여야 한다.</>
                    )}
                  </p>
                  <Link href="/subscriptions" className="mt-2 inline-block">
                    <Button size="sm" variant="outline">
                      구독 정리하러 가기
                    </Button>
                  </Link>
                </div>
              ) : null}

              <div className="flex items-center gap-2 border-t border-line pt-2.5">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="이번 달 넣을 금액"
                  className={inputClass}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const n = Number((e.target as HTMLInputElement).value)
                    if (n > 0) {
                      void patch('goals', g.id, { current_amount: g.current_amount + n })
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                  id={`goal-input-${g.id}`}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    const el = document.getElementById(`goal-input-${g.id}`) as HTMLInputElement | null
                    const n = Number(el?.value ?? 0)
                    if (n > 0 && el) {
                      void patch('goals', g.id, { current_amount: g.current_amount + n })
                      el.value = ''
                    }
                  }}
                >
                  넣기
                </Button>
              </div>
            </CardBody>
          </Card>
        )
      })}

      {goals.length > 0 ? (
        <Card>
          <CardHead title="합계" sub="모든 목표를 기한 안에 맞추려면" />
          <CardBody className="pt-2">
            <Row
              label="월 필요 저축액"
              value={<Amount value={goals.reduce((a, g) => a + monthlyNeedForGoal(g), 0)} />}
            />
            <Row label="지금 저축 속도" value={<Amount value={v.capacity} />} sub="최근 3개월 평균" />
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              이 필요 저축액은 안전 예산에서 미리 빠진다. 목표를 걸면 쓸 수 있는 돈이 그만큼 줄어 보이는 게 맞다.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function GoalForm({
  onDone,
  onAdd,
  monthlyExpense,
}: {
  onDone: () => void
  onAdd: (row: Goal) => Promise<void>
  monthlyExpense: number
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [deadline, setDeadline] = useState(ymd(new Date(Date.now() + 365 * 86400000)))
  const [current, setCurrent] = useState(0)

  const presets = [
    { label: '비상자금 3개월분', amount: Math.round(monthlyExpense * 3), months: 12 },
    { label: '비상자금 6개월분', amount: Math.round(monthlyExpense * 6), months: 24 },
  ].filter((p) => p.amount > 0)

  return (
    <div className="space-y-2.5">
      {presets.length ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setName(p.label)
                setTarget(p.amount)
                setDeadline(ymd(new Date(Date.now() + p.months * 30 * 86400000)))
              }}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-muted hover:text-fg"
            >
              {p.label} ({shortWon(p.amount)})
            </button>
          ))}
        </div>
      ) : null}
      <Field label="이름">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="비상자금" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="목표 금액">
          <input
            type="number"
            className={inputClass}
            value={target || ''}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </Field>
        <Field label="이미 모은 금액">
          <input
            type="number"
            className={inputClass}
            value={current || ''}
            onChange={(e) => setCurrent(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="기한">
        <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      {target > 0 ? (
        <p className="text-[12px] text-muted">
          기한까지 맞추려면 월{' '}
          <b className="text-fg">
            {won(monthlyNeedForGoal({ target_amount: target, current_amount: current, deadline }))}원
          </b>
          이 필요하다.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!name || target <= 0}
          onClick={async () => {
            await onAdd({
              id: uid('gl-'),
              name,
              target_amount: target,
              deadline,
              current_amount: current,
              priority: 3,
            })
            onDone()
          }}
        >
          추가
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          취소
        </Button>
      </div>
    </div>
  )
}
