'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import { shortWon, won } from '@/lib/format'
import { MONTH_LABEL } from '@/lib/date'
import type { Grade } from '@/lib/types'
import { cn } from '@/lib/utils'

export const VIZ = {
  in: 'var(--viz-in)',
  out: 'var(--viz-out)',
  need: 'var(--viz-need)',
  want: 'var(--viz-want)',
  waste: 'var(--viz-waste)',
  grid: 'var(--viz-grid)',
  axis: 'var(--viz-axis)',
} as const

export const GRADE_COLOR: Record<Grade, string> = {
  need: VIZ.need,
  want: VIZ.want,
  waste: VIZ.waste,
}

export const GRADE_LABEL: Record<Grade, string> = {
  need: '필수',
  want: '선택',
  waste: '낭비',
}

/** 서버에서는 폭이 0이라 차트가 깨진다. 마운트 뒤에만 그린다. */
function Frame({ height, children }: { height: number; children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ height }} className="animate-pulse rounded-md bg-surface-2" />
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

/** 색만으로 구분하게 두지 않는다. 범례는 2계열 이상이면 항상 붙인다. */
export function Legend({ items }: { items: { color: string; label: string; value?: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
          {it.value ? <b className="amount tnum font-semibold text-fg">{it.value}</b> : null}
        </span>
      ))}
    </div>
  )
}

function Box({ title, rows }: { title: string; rows: { color?: string; label: string; value: string }[] }) {
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          {r.color ? <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} /> : null}
          {r.label}
          <b className="amount tnum ml-auto pl-3 font-semibold text-fg">{r.value}</b>
        </p>
      ))}
    </div>
  )
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: VIZ.axis, fontSize: 11 },
} as const

// ── 월별 수입/지출 ──────────────────────────────────────────
export function FlowBars({
  data,
  height = 180,
}: {
  data: { month: string; income: number; expense: number }[]
  height?: number
}) {
  return (
    <>
      <Frame height={height}>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -10 }} barGap={2}>
          <CartesianGrid stroke={VIZ.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={MONTH_LABEL} {...axisProps} />
          <YAxis tickFormatter={(v: number) => shortWon(v)} width={58} {...axisProps} />
          <Tooltip
            cursor={{ fill: 'rgba(127,127,140,0.12)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Box
                  title={`${String(label).slice(0, 4)}년 ${MONTH_LABEL(String(label))}`}
                  rows={[
                    { color: VIZ.in, label: '수입', value: `${won(Number(payload[0]?.value ?? 0))}원` },
                    { color: VIZ.out, label: '지출', value: `${won(Number(payload[1]?.value ?? 0))}원` },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="income" fill={VIZ.in} radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="expense" fill={VIZ.out} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </Frame>
      <Legend items={[{ color: VIZ.in, label: '수입' }, { color: VIZ.out, label: '지출' }]} />
    </>
  )
}

// ── 고정 vs 변동 (누적) ─────────────────────────────────────
export function FixedVariableBars({
  data,
  height = 180,
}: {
  data: { month: string; fixed: number; variable: number }[]
  height?: number
}) {
  return (
    <>
      <Frame height={height}>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={VIZ.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={MONTH_LABEL} {...axisProps} />
          <YAxis tickFormatter={(v: number) => shortWon(v)} width={58} {...axisProps} />
          <Tooltip
            cursor={{ fill: 'rgba(127,127,140,0.12)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Box
                  title={MONTH_LABEL(String(label))}
                  rows={[
                    { color: VIZ.out, label: '고정', value: `${won(Number(payload[0]?.value ?? 0))}원` },
                    { color: VIZ.want, label: '변동', value: `${won(Number(payload[1]?.value ?? 0))}원` },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="fixed" stackId="a" fill={VIZ.out} maxBarSize={22} stroke="hsl(var(--surface))" strokeWidth={2} />
          <Bar dataKey="variable" stackId="a" fill={VIZ.want} radius={[4, 4, 0, 0]} maxBarSize={22} stroke="hsl(var(--surface))" strokeWidth={2} />
        </BarChart>
      </Frame>
      <Legend items={[{ color: VIZ.out, label: '고정지출' }, { color: VIZ.want, label: '변동지출' }]} />
    </>
  )
}

// ── 추이 선 (순자산 등) ─────────────────────────────────────
export function TrendLine({
  data,
  height = 180,
  zeroLine = false,
}: {
  data: { month: string; value: number }[]
  height?: number
  zeroLine?: boolean
}) {
  return (
    <Frame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={VIZ.grid} vertical={false} />
        <XAxis dataKey="month" tickFormatter={MONTH_LABEL} {...axisProps} />
        <YAxis tickFormatter={(v: number) => shortWon(v)} width={58} {...axisProps} />
        {zeroLine ? <ReferenceLine y={0} stroke={VIZ.axis} strokeDasharray="3 3" /> : null}
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Box
                title={`${String(label).slice(0, 4)}년 ${MONTH_LABEL(String(label))}`}
                rows={[{ color: VIZ.in, label: '순자산', value: `${won(Number(payload[0]?.value ?? 0))}원` }]}
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={VIZ.in}
          strokeWidth={2}
          dot={{ r: 2.5, fill: VIZ.in, strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: 'hsl(var(--surface))', strokeWidth: 2 }}
        />
      </LineChart>
    </Frame>
  )
}

// ── 필수/선택/낭비 비율 추이 ────────────────────────────────
export function GradeBars({
  data,
  height = 170,
}: {
  data: { month: string; need: number; want: number; waste: number; total: number }[]
  height?: number
}) {
  const pctData = data.map((d) => ({
    month: d.month,
    need: d.total ? (d.need / d.total) * 100 : 0,
    want: d.total ? (d.want / d.total) * 100 : 0,
    waste: d.total ? (d.waste / d.total) * 100 : 0,
    raw: d,
  }))
  return (
    <>
      <Frame height={height}>
        <BarChart data={pctData} margin={{ top: 6, right: 4, bottom: 0, left: -6 }}>
          <CartesianGrid stroke={VIZ.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={MONTH_LABEL} {...axisProps} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            width={38}
            {...axisProps}
          />
          <Tooltip
            cursor={{ fill: 'rgba(127,127,140,0.12)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const raw = (payload[0]?.payload as { raw: (typeof data)[number] }).raw
              return (
                <Box
                  title={MONTH_LABEL(String(label))}
                  rows={(['need', 'want', 'waste'] as Grade[]).map((g) => ({
                    color: GRADE_COLOR[g],
                    label: GRADE_LABEL[g],
                    value: `${won(raw[g])}원 · ${raw.total ? Math.round((raw[g] / raw.total) * 100) : 0}%`,
                  }))}
                />
              )
            }}
          />
          {(['need', 'want', 'waste'] as Grade[]).map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              stackId="g"
              fill={GRADE_COLOR[g]}
              maxBarSize={24}
              radius={i === 2 ? [4, 4, 0, 0] : undefined}
              stroke="hsl(var(--surface))"
              strokeWidth={2}
            />
          ))}
        </BarChart>
      </Frame>
      <Legend
        items={(['need', 'want', 'waste'] as Grade[]).map((g) => ({
          color: GRADE_COLOR[g],
          label: GRADE_LABEL[g],
        }))}
      />
    </>
  )
}

// ── 카테고리 트리맵 — 크기는 금액, 색은 등급 ────────────────
interface TreeNode {
  name: string
  size: number
  grade: Grade
  icon: string
}

export function CategoryTreemap({ data, height = 220 }: { data: TreeNode[]; height?: number }) {
  if (data.length === 0) return null
  const total = data.reduce((a, b) => a + b.size, 0)
  return (
    <>
      <Frame height={height}>
        <Treemap
          data={data}
          dataKey="size"
          stroke="hsl(var(--surface))"
          isAnimationActive={false}
          content={<TreemapCell total={total} />}
        />
      </Frame>
      <Legend
        items={(['need', 'want', 'waste'] as Grade[]).map((g) => ({
          color: GRADE_COLOR[g],
          label: GRADE_LABEL[g],
        }))}
      />
    </>
  )
}

interface CellProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  size?: number
  grade?: Grade
  icon?: string
  total?: number
}

function TreemapCell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', size = 0, grade = 'want', icon = '', total = 1 } = props
  const showText = width > 54 && height > 34
  const showValue = width > 72 && height > 50
  // 칸보다 긴 이름은 잘라 낸다. 넘치면 옆 칸까지 침범해 읽을 수 없게 된다.
  const maxChars = Math.max(1, Math.floor((width - 30) / 12))
  const label = name.length > maxChars ? `${name.slice(0, maxChars)}…` : name
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={4}
        fill={GRADE_COLOR[grade]}
        stroke="hsl(var(--surface))"
        strokeWidth={2}
      />
      {showText ? (
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>
          {icon} {label}
        </text>
      ) : null}
      {showValue ? (
        <>
          <text x={x + 8} y={y + 34} fill="rgba(255,255,255,0.9)" fontSize={11}>
            {shortWon(size)}원
          </text>
          <text x={x + 8} y={y + 48} fill="rgba(255,255,255,0.65)" fontSize={10}>
            {Math.round((size / total) * 100)}%
          </text>
        </>
      ) : null}
    </g>
  )
}

// ── 요일/시간대 패턴 — 작은 막대 하나로 충분하다 ────────────
export function MiniBars({
  values,
  labels,
  highlight,
  tone = VIZ.out,
}: {
  values: number[]
  labels: string[]
  /** 강조할 인덱스 (심야 시간대 등) */
  highlight?: number[]
  tone?: string
}) {
  const max = Math.max(1, ...values)
  const hi = new Set(highlight ?? [])
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 76 }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn('w-full rounded-t-[4px] transition-all')}
            style={{
              height: `${Math.max(2, (v / max) * 56)}px`,
              background: hi.has(i) ? VIZ.waste : tone,
              opacity: v === 0 ? 0.25 : 1,
            }}
            title={`${labels[i]} ${won(v)}원`}
          />
          <span className="text-[9px] leading-none text-faint">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ── 부채 상환 시뮬레이션 비교 ───────────────────────────────
export function PayoffCompare({
  snowball,
  avalanche,
  height = 190,
}: {
  snowball: { month: number; balance: number }[]
  avalanche: { month: number; balance: number }[]
  height?: number
}) {
  const len = Math.max(snowball.length, avalanche.length)
  const data = Array.from({ length: len }, (_, i) => ({
    month: i,
    snowball: snowball[i]?.balance ?? 0,
    avalanche: avalanche[i]?.balance ?? 0,
  }))
  return (
    <>
      <Frame height={height}>
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -4 }}>
          <CartesianGrid stroke={VIZ.grid} vertical={false} />
          <XAxis
            dataKey="month"
            interval={5}
            tickFormatter={(v: number) => (v === 0 ? '지금' : v % 12 === 0 ? `${v / 12}년` : `${v}개월`)}
            {...axisProps}
          />
          <YAxis tickFormatter={(v: number) => shortWon(v)} width={58} {...axisProps} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Box
                  title={`${label}개월 뒤`}
                  rows={[
                    { color: VIZ.want, label: '눈덩이', value: `${won(Number(payload[0]?.value ?? 0))}원` },
                    { color: VIZ.in, label: '눈사태', value: `${won(Number(payload[1]?.value ?? 0))}원` },
                  ]}
                />
              ) : null
            }
          />
          {/* 두 선은 대개 거의 겹친다. 점선인 눈덩이를 위에 그려야 겹친 구간이 보인다. */}
          <Line type="monotone" dataKey="avalanche" stroke={VIZ.in} strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="snowball"
            stroke={VIZ.want}
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={false}
          />
        </LineChart>
      </Frame>
      <Legend
        items={[
          { color: VIZ.want, label: '눈덩이 (점선 · 작은 잔액부터)' },
          { color: VIZ.in, label: '눈사태 (높은 이자부터)' },
        ]}
      />
    </>
  )
}
