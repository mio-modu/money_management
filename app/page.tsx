'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { AlertCard } from '@/components/alert-card'
import { Amount } from '@/components/amount'
import { BigNumber } from '@/components/big-number'
import { IconChevronRight, IconPlus } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardHead, CardBody } from '@/components/ui/card'
import { Empty, Pill, Progress } from '@/components/ui/bits'
import { briefing } from '@/lib/agent/engine'
import { monthProgress, thisMonth } from '@/lib/date'
import { pct, shortWon } from '@/lib/format'
import { healthScore } from '@/lib/finance/score'
import {
  monthFlow,
  netWorth,
  netWorthSeries,
  spendable,
  upcomingFixed,
} from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import { sum } from '@/lib/utils'

export default function Dashboard() {
  const db = useStore((s) => s.db)
  const month = thisMonth()

  const view = useMemo(() => {
    const nw = netWorth(db)
    const series = netWorthSeries(db, 2)
    const prev = series.length > 1 ? series[0].value : nw
    const sp = spendable(db, month)
    const score = healthScore(db, month)
    const brief = briefing(db)
    const upcoming = upcomingFixed(db, month)
    const flow = monthFlow(db, month)
    return { nw, prev, sp, score, brief, upcoming, flow }
  }, [db, month])

  const { nw, prev, sp, score, brief, upcoming, flow } = view
  const hasData = db.transactions.length > 0 || db.accounts.length > 0

  const cards = [brief.warning, brief.suggestion, brief.praise].filter(Boolean)

  return (
    <div className="space-y-3 p-3">
      {/* ── 딱 3개 숫자 ───────────────────────────────── */}
      <Card className="divide-y divide-line">
        <BigNumber
          label="순자산"
          value={nw}
          delta={nw - prev}
          deltaLabel="전월 대비"
          tone={nw < 0 ? 'danger' : 'neutral'}
          right={
            <Link href="/assets" className="text-[11px] text-faint hover:text-muted">
              자산·부채 →
            </Link>
          }
        />
        <BigNumber
          label={
            sp.budget <= 0
              ? '이번 달 쓸 수 있는 돈'
              : sp.basedOn === 'budget'
                ? '이번 달 쓸 수 있는 남은 돈'
                : '이번 달 안전하게 쓸 수 있는 돈'
          }
          value={sp.budget <= 0 ? 0 : sp.remain}
          tone={
            sp.budget <= 0
              ? 'neutral'
              : sp.remain < 0
                ? 'danger'
                : sp.paceGapPp > 20
                  ? 'warn'
                  : 'good'
          }
          note={
            sp.budget <= 0 ? (
              <span>수입을 한 건 넣거나 예산을 잡으면 여기서 계산된다</span>
            ) : (
            <span>
              {sp.remain < 0 ? (
                <>
                  이미 <Amount value={-sp.remain} short /> 넘겼다
                  {sp.daysLeft > 0 ? ` · 남은 ${sp.daysLeft}일은 꼭 필요한 것만` : ''}
                </>
              ) : sp.daysLeft > 0 ? (
                <>
                  남은 {sp.daysLeft}일 · 하루 <Amount value={sp.perDay} short />
                </>
              ) : (
                '이번 달 마지막 날'
              )}
              {sp.upcomingFixedTotal > 0 ? (
                <>
                  {' · 남은 고정지출 '}
                  <Amount value={sp.upcomingFixedTotal} short />
                </>
              ) : null}
            </span>
            )
          }
          right={
            <Link href="/budget" className="text-[11px] text-faint hover:text-muted">
              예산 →
            </Link>
          }
        />
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-muted">재정 건강 점수</span>
            <Link href="/health" className="text-[11px] text-faint hover:text-muted">
              근거 보기 →
            </Link>
          </div>
          {score.insufficient ? (
            <>
              <div className="mt-1 flex items-end gap-2">
                <span className="tnum text-[32px] font-bold leading-none tracking-tight text-faint">—</span>
                <Pill className="mb-1" tone="muted">
                  계산 전
                </Pill>
              </div>
              <Progress className="mt-2.5" value={0} />
              <p className="mt-1.5 text-[11px] leading-snug text-faint">
                거래 {db.transactions.length}건. 5건부터 계산한다 — 기록이 없으면 부채 0점 같은 항목만
                점수를 올려 실제보다 좋게 나온다.
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-end gap-2">
                <span className="tnum text-[32px] font-bold leading-none tracking-tight">
                  {score.total}
                  <span className="ml-0.5 text-[16px] font-semibold text-faint">/100</span>
                </span>
                <Pill
                  className="mb-1"
                  tone={score.total >= 65 ? 'good' : score.total >= 50 ? 'warn' : 'danger'}
                >
                  {score.grade}
                </Pill>
              </div>
              <Progress
                className="mt-2.5"
                value={score.total}
                tone={score.total >= 65 ? 'good' : score.total >= 50 ? 'warn' : 'danger'}
              />
              <p className="mt-1.5 text-[11px] text-faint">가장 낮은 항목: {weakest(score)}</p>
            </>
          )}
        </div>
      </Card>

      {/* ── 오늘의 에이전트 브리핑 — 3장을 넘기지 않는다 ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-bold">오늘의 에이전트 브리핑</h2>
          <Link href="/alerts" className="text-[11px] text-faint hover:text-muted">
            전체 기록 →
          </Link>
        </div>
        {cards.length === 0 ? (
          <Card>
            <Empty
              title="아직 판정할 거리가 없다"
              body="지출 한 건만 넣으면 규칙 15개가 바로 돌기 시작한다. 금액과 카테고리 두 개면 끝난다."
              action={
                <Link href="/add">
                  <Button variant="primary" size="md">
                    <IconPlus width={16} height={16} /> 첫 지출 입력
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          cards.map((a) => <AlertCard key={a!.id} alert={a!} />)
        )}
      </section>

      {/* ── 이번 달 한눈에 ──────────────────────────────── */}
      <Card>
        <CardHead
          title="이번 달"
          sub={`${pct(monthProgress(month) * 100, 0)} 지남 · 예산 ${pct(sp.usedPct, 0)} 소진`}
          right={
            <Link href="/cashflow" className="grid h-8 w-8 place-items-center rounded-md text-faint hover:bg-surface-2">
              <IconChevronRight width={16} height={16} />
            </Link>
          }
        />
        <CardBody className="pt-2.5">
          <Progress value={sp.usedPct} marker={monthProgress(month) * 100} tone={sp.paceGapPp > 20 ? 'warn' : 'accent'} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="수입" value={flow.income} />
            <Mini label="지출" value={flow.expense} tone="danger" />
            <Mini label="남김" value={flow.net} tone={flow.net >= 0 ? 'good' : 'danger'} />
          </div>
          {upcoming.length > 0 ? (
            <div className="mt-3 rounded-md bg-surface-2 p-2.5">
              <p className="text-[11px] font-medium text-muted">
                남은 고정지출 {upcoming.length}건 · <Amount value={sum(upcoming.map((u) => u.amount))} short />
              </p>
              <ul className="mt-1.5 space-y-1">
                {upcoming.slice(0, 3).map((u) => (
                  <li key={`${u.label}-${u.date}`} className="flex justify-between text-[12px]">
                    <span className="text-faint">
                      {u.date.slice(5).replace('-', '/')} {u.label}
                    </span>
                    <Amount value={u.amount} className="text-muted" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {!hasData ? (
        <Card>
          <CardHead title="처음이라면" sub="더미 데이터를 넣어 화면을 먼저 볼 수도 있다" />
          <CardBody className="pt-2">
            <p className="text-[13px] leading-relaxed text-muted">
              설정 → 데이터에서 <b className="text-fg">더미 데이터 생성</b>을 누르면 6개월치 거래·구독·부채가
              한 번에 들어간다. 규칙 엔진이 실제로 무엇을 잡아내는지 바로 볼 수 있다.
            </p>
            <Link href="/settings" className="mt-2.5 inline-block">
              <Button variant="outline" size="sm">
                설정으로
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function Mini({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'danger' | 'good'
}) {
  return (
    <div className="rounded-md bg-surface-2 py-2">
      <p className="text-[11px] text-faint">{label}</p>
      <p
        className={
          'amount tnum mt-0.5 text-[15px] font-semibold ' +
          (tone === 'danger' ? 'text-danger' : tone === 'good' ? 'text-good' : 'text-fg')
        }
      >
        {shortWon(value)}
      </p>
    </div>
  )
}

function weakest(score: ReturnType<typeof healthScore>) {
  const w = [...score.parts].sort((a, b) => a.score / a.max - b.score / b.max)[0]
  return `${w.label} ${w.score.toFixed(0)}/${w.max}점`
}
