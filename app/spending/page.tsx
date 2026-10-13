'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { CategoryTreemap, GRADE_COLOR, GRADE_LABEL, GradeBars, MiniBars, VIZ } from '@/components/charts'
import { IconArrowDown, IconArrowUp } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead } from '@/components/ui/card'
import { Empty, MonthNav, Pill, Progress, Segmented } from '@/components/ui/bits'
import { WEEKDAYS, shiftMonth } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import {
  categoryDeltas,
  categoryTotals,
  gradeMix,
  gradeMixSeries,
  hourPattern,
  monthFlow,
  monthTx,
  rootTotals,
  weekdayPattern,
} from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import type { Grade } from '@/lib/types'
import { sum } from '@/lib/utils'

export default function SpendingPage() {
  const db = useStore((s) => s.db)
  const month = useStore((s) => s.month)
  const setMonth = useStore((s) => s.setMonth)
  const [depth, setDepth] = useState<'root' | 'leaf'>('root')

  const v = useMemo(() => {
    const roots = rootTotals(db, month)
    const leaves = categoryTotals(db, month)
    const mix = gradeMix(db, month)
    const prevMix = gradeMix(db, shiftMonth(month, -1))
    const total = mix.need + mix.want + mix.waste
    const prevTotal = prevMix.need + prevMix.want + prevMix.waste
    return {
      roots,
      leaves,
      mix,
      prevMix,
      total,
      prevTotal,
      deltas: categoryDeltas(db, month, 5),
      gradeSeries: gradeMixSeries(db, 6),
      weekday: weekdayPattern(db, month),
      hours: hourPattern(db, 3),
      flow: monthFlow(db, month),
      count: monthTx(db, month).filter((t) => t.direction === 'out').length,
    }
  }, [db, month])

  const { roots, leaves, mix, prevMix, total, prevTotal, deltas, gradeSeries, weekday, hours, flow, count } = v
  const source = depth === 'root' ? roots : leaves
  const tree = source.slice(0, 12).map((c) => ({ name: c.name, size: c.amount, grade: c.grade, icon: c.icon }))

  const wasteShare = total ? (mix.waste / total) * 100 : 0
  const prevWasteShare = prevTotal ? (prevMix.waste / prevTotal) * 100 : 0
  const lateTotal = hours.slice(22).concat(hours.slice(0, 2)).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <MonthNav month={month} onChange={setMonth} />
        <span className="text-[12px] text-faint">
          지출 {count}건 · <Amount value={flow.expense} short className="text-muted" />
        </span>
      </div>

      {total === 0 ? (
        <Card>
          <Empty
            title="이 달에는 지출 기록이 없다"
            body="월을 바꿔 보거나, 지출을 한 건 넣어 보자. 두 달이 쌓이면 전월 대비 증감이 나온다."
            action={
              <Link href="/add">
                <Button variant="primary">지출 입력</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* 3등급 비율 — 이 화면에서 제일 중요한 숫자 */}
          <Card>
            <CardHead
              title="필수 · 선택 · 낭비"
              sub="낭비 비중이 줄고 있는지가 유일하게 의미 있는 추세다"
              right={
                <Pill tone={wasteShare <= prevWasteShare ? 'good' : 'warn'}>
                  낭비 {pct(wasteShare, 1)}
                </Pill>
              }
            />
            <CardBody className="pt-2.5">
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {(['need', 'want', 'waste'] as Grade[]).map((g) => (
                  <div
                    key={g}
                    style={{
                      width: `${total ? (mix[g] / total) * 100 : 0}%`,
                      background: GRADE_COLOR[g],
                      borderRight: '2px solid hsl(var(--surface))',
                    }}
                    title={`${GRADE_LABEL[g]} ${won(mix[g])}원`}
                  />
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(['need', 'want', 'waste'] as Grade[]).map((g) => (
                  <div key={g} className="rounded-md bg-surface-2 px-2 py-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-faint">
                      <span className="h-2 w-2 rounded-[2px]" style={{ background: GRADE_COLOR[g] }} />
                      {GRADE_LABEL[g]}
                    </span>
                    <p className="amount tnum mt-0.5 text-[15px] font-semibold">{shortWon(mix[g])}</p>
                    <p className="tnum text-[11px] text-faint">{pct(total ? (mix[g] / total) * 100 : 0, 0)}</p>
                  </div>
                ))}
              </div>
              {prevTotal > 0 ? (
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  낭비 비중 전월 {pct(prevWasteShare, 1)} → 이번 달 {pct(wasteShare, 1)}.{' '}
                  {wasteShare <= prevWasteShare
                    ? `${shortWon(prevMix.waste - mix.waste)}원 줄였다. 이 금액을 목표에 바로 넣으면 사라지지 않는다.`
                    : `${shortWon(mix.waste - prevMix.waste)}원 늘었다. 가장 큰 낭비 항목 하나만 이번 주에 끊어 보자.`}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="6개월 등급 추이" sub="낭비(맨 위)가 얇아지고 있는가" />
            <CardBody className="pt-2">
              <GradeBars data={gradeSeries.map((g) => ({ month: g.month, ...g.mix, total: g.total }))} />
            </CardBody>
          </Card>

          {/* 트리맵 */}
          <Card>
            <CardHead
              title="어디로 갔나"
              sub="칸 크기는 금액, 색은 등급"
              right={
                <Segmented
                  value={depth}
                  onChange={setDepth}
                  options={[
                    { value: 'root', label: '대분류' },
                    { value: 'leaf', label: '소분류' },
                  ]}
                />
              }
            />
            <CardBody className="pt-2">
              <CategoryTreemap data={tree} />
              <div className="mt-3 space-y-1.5">
                {source.slice(0, 8).map((c) => (
                  <div key={c.categoryId} className="flex items-center gap-2.5">
                    <span className="w-5 text-center text-[15px]">{c.icon}</span>
                    <span className="w-24 shrink-0 truncate text-[12px] text-muted">{c.name}</span>
                    <Progress
                      className="flex-1"
                      value={(c.amount / Math.max(1, source[0].amount)) * 100}
                      tone={c.grade === 'waste' ? 'danger' : c.grade === 'want' ? 'warn' : 'accent'}
                    />
                    <span className="amount tnum w-16 text-right text-[12px] font-medium">
                      {shortWon(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* 전월 대비 TOP5 */}
          <Card>
            <CardHead title="전월 대비 변화 TOP 5" sub="늘어난 쪽이 먼저다" />
            <CardBody className="space-y-2 pt-2">
              {deltas.length === 0 ? (
                <p className="text-[12px] text-faint">비교할 지난달 기록이 없다.</p>
              ) : (
                deltas.map((d) => (
                  <div key={d.categoryId} className="flex items-center gap-2.5">
                    <span className="w-5 text-center text-[15px]">{d.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{d.name}</p>
                      <p className="tnum text-[11px] text-faint">
                        {shortWon(d.prev)} → {shortWon(d.amount)}
                      </p>
                    </div>
                    <span
                      className={
                        'amount tnum inline-flex items-center gap-0.5 text-[13px] font-semibold ' +
                        (d.delta > 0 ? 'text-danger' : 'text-good')
                      }
                    >
                      {d.delta > 0 ? <IconArrowUp width={13} height={13} /> : <IconArrowDown width={13} height={13} />}
                      {shortWon(Math.abs(d.delta))}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* 요일 · 시간대 */}
          <Card>
            <CardHead title="언제 쓰나" sub="요일과 시간대에 버릇이 남는다" />
            <CardBody className="space-y-4 pt-2">
              <div>
                <p className="mb-1.5 text-[11px] text-faint">요일별 지출</p>
                <MiniBars values={weekday} labels={WEEKDAYS} tone={VIZ.out} />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] text-faint">
                  시간대별 (최근 3개월) · 22~새벽 2시 <Amount value={lateTotal} short className="text-muted" />
                </p>
                <MiniBars
                  values={hours}
                  labels={hours.map((_, i) => (i % 6 === 0 ? String(i) : ''))}
                  highlight={[22, 23, 0, 1]}
                  tone={VIZ.out}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-faint">
                  분홍색이 심야 결제다. 그 시간의 결제는 대개 다음 날 후회한다 —
                  장바구니에 담고 아침에 다시 보기로 규칙을 하나 만들어 두면 대부분 사라진다.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* 표로도 볼 수 있게 */}
          <Card>
            <CardHead title="전체 카테고리" sub={`${leaves.length}개 · 합계 ${won(sum(leaves.map((l) => l.amount)))}원`} />
            <CardBody className="pt-2">
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full text-[12px]">
                  <thead className="bg-surface-2 text-faint">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">카테고리</th>
                      <th className="px-2 py-1.5 text-left font-medium">등급</th>
                      <th className="px-2 py-1.5 text-right font-medium">건수</th>
                      <th className="px-2 py-1.5 text-right font-medium">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((c) => (
                      <tr key={c.categoryId} className="border-t border-line">
                        <td className="px-2 py-1.5">
                          {c.icon} {c.name}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1 text-faint">
                            <span className="h-2 w-2 rounded-[2px]" style={{ background: GRADE_COLOR[c.grade] }} />
                            {GRADE_LABEL[c.grade]}
                          </span>
                        </td>
                        <td className="tnum px-2 py-1.5 text-right text-faint">{c.count}</td>
                        <td className="amount tnum px-2 py-1.5 text-right font-medium">{won(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
