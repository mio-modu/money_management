'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Amount } from '@/components/amount'
import { GRADE_COLOR, GRADE_LABEL, TrendLine } from '@/components/charts'
import { IconArrowDown, IconArrowUp } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, MonthNav, Pill } from '@/components/ui/bits'
import { shiftMonth, thisMonth } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import { monthlyReport, netWorthSeries } from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import type { Grade } from '@/lib/types'

export default function MonthlyPage() {
  const db = useStore((s) => s.db)
  const month = useStore((s) => s.month)
  const setMonth = useStore((s) => s.setMonth)

  const r = useMemo(() => monthlyReport(db, month), [db, month])
  const series = useMemo(() => netWorthSeries(db, 12), [db])

  const total = r.mix.need + r.mix.want + r.mix.waste
  const prevTotal = r.prevMix.need + r.prevMix.want + r.prevMix.waste
  const isCurrent = month === thisMonth()

  if (r.flow.income === 0 && r.flow.expense === 0) {
    return (
      <div className="space-y-3 p-3">
        <MonthNav month={month} onChange={setMonth} />
        <Card>
          <Empty title="이 달에는 기록이 없다" body="월을 바꿔 보거나, 거래를 넣으면 결산이 만들어진다." />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <MonthNav month={month} onChange={setMonth} />
        {isCurrent ? <Pill tone="warn">진행 중</Pill> : <Pill tone="muted">마감</Pill>}
      </div>

      {isCurrent ? (
        <p className="px-1 text-[11px] leading-relaxed text-faint">
          아직 끝나지 않은 달이다. 월세·보험처럼 뒤에 나갈 고정지출이 빠져 있어서
          등급 비율과 저축률이 실제보다 좋게 보인다.
        </p>
      ) : null}

      {/* 한 줄 요약 — 결산은 이 문장 하나가 전부다 */}
      <Card className={r.flow.net >= 0 ? 'border-good/30' : 'border-danger/35'}>
        <CardBody>
          <p className="text-[15px] font-semibold leading-relaxed">{headline(r)}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{detail(r, total, prevTotal)}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="순자산" sub="자산 평가액은 현재 기준이라, 이후 달들의 저축액을 거꾸로 빼서 역산한다" />
        <CardBody className="pt-2">
          <div className="flex items-end gap-2">
            <span className="amount tnum text-[28px] font-bold leading-none">{shortWon(r.netWorthNow)}원</span>
            <span
              className={
                'amount tnum mb-0.5 inline-flex items-center gap-0.5 text-[13px] font-semibold ' +
                (r.netWorthNow >= r.netWorthPrev ? 'text-good' : 'text-danger')
              }
            >
              {r.netWorthNow >= r.netWorthPrev ? (
                <IconArrowUp width={13} height={13} />
              ) : (
                <IconArrowDown width={13} height={13} />
              )}
              {shortWon(Math.abs(r.netWorthNow - r.netWorthPrev))}
            </span>
          </div>
          <div className="mt-3">
            <TrendLine data={series} zeroLine />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="수입 · 지출" />
        <CardBody className="pt-2">
          <Row label="수입" value={<Amount value={r.flow.income} />} sub={delta(r.flow.income, r.prevFlow.income)} />
          <Row label="지출" value={<Amount value={r.flow.expense} />} sub={delta(r.flow.expense, r.prevFlow.expense)} />
          <Row label="고정" value={<Amount value={r.flow.fixed} />} />
          <Row label="변동" value={<Amount value={r.flow.variable} />} />
          <div className="mt-1.5 border-t border-line pt-2">
            <Row
              label={<b className="text-fg">남김</b>}
              value={
                <b className={r.flow.net >= 0 ? 'text-good' : 'text-danger'}>
                  <Amount value={r.flow.net} signed />
                </b>
              }
              sub={r.flow.income > 0 ? `저축률 ${pct((r.flow.net / r.flow.income) * 100, 1)}` : undefined}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="카테고리 TOP 5" sub="합계 기준" />
        <CardBody className="space-y-2 pt-2">
          {r.top.map((c, i) => (
            <div key={c.categoryId} className="flex items-center gap-2.5">
              <span className="tnum w-4 text-[12px] text-faint">{i + 1}</span>
              <span className="w-5 text-center text-[15px]">{c.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
              <span className="tnum text-[11px] text-faint">{c.count}건</span>
              <Amount value={c.amount} className="w-20 text-right text-[13px] font-medium" short />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="전월 대비 변화" sub="늘어난 쪽을 먼저 본다" />
        <CardBody className="space-y-2 pt-2">
          {r.deltas.length === 0 ? (
            <p className="text-[12px] text-faint">비교할 지난달 기록이 없다.</p>
          ) : (
            r.deltas.map((d) => (
              <div key={d.categoryId} className="flex items-center gap-2.5">
                <span className="w-5 text-center text-[15px]">{d.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{d.name}</span>
                <span
                  className={
                    'amount tnum text-[13px] font-semibold ' + (d.delta > 0 ? 'text-danger' : 'text-good')
                  }
                >
                  {d.delta > 0 ? '+' : '−'}
                  {shortWon(Math.abs(d.delta))}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="등급 비율" sub="낭비가 줄었는가" />
        <CardBody className="pt-2">
          {(['need', 'want', 'waste'] as Grade[]).map((g) => {
            const cur = total ? (r.mix[g] / total) * 100 : 0
            const prev = prevTotal ? (r.prevMix[g] / prevTotal) * 100 : 0
            return (
              <Row
                key={g}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: GRADE_COLOR[g] }} />
                    {GRADE_LABEL[g]}
                  </span>
                }
                value={<Amount value={r.mix[g]} short />}
                sub={`${pct(cur, 1)} (전월 ${pct(prev, 1)})`}
              />
            )
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="습관" />
        <CardBody className="pt-2">
          <Row label="무지출일" value={`${r.noSpendDays}일`} sub="개인 지출 기준" />
          {r.budgetKept.total > 0 ? (
            <Row
              label="예산 준수"
              value={`${r.budgetKept.kept} / ${r.budgetKept.total}개`}
              sub={r.budgetKept.kept === r.budgetKept.total ? '전부 지켰다' : undefined}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHead
          title={`${shiftMonth(month, 1).slice(5)}월 예산`}
          sub="최근 3개월 중앙값으로 자동 제안한다. 그대로 쓰지 말고 고쳐라."
        />
        <CardBody className="pt-2">
          <Link href="/budget">
            <Button variant="primary" size="sm">
              예산 제안 보기
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

function delta(cur: number, prev: number) {
  if (!prev) return undefined
  const d = cur - prev
  if (d === 0) return '전월과 같음'
  return `전월 대비 ${d > 0 ? '+' : '−'}${shortWon(Math.abs(d))}`
}

function headline(r: ReturnType<typeof monthlyReport>) {
  const m = `${Number(r.month.slice(5, 7))}월`
  if (r.flow.net >= 0) {
    return `${m}에 ${won(r.flow.net)}원을 남겼다.`
  }
  return `${m}에 ${won(-r.flow.net)}원이 모자랐다.`
}

function detail(r: ReturnType<typeof monthlyReport>, total: number, prevTotal: number) {
  const parts: string[] = []
  const wasteNow = total ? (r.mix.waste / total) * 100 : 0
  const wastePrev = prevTotal ? (r.prevMix.waste / prevTotal) * 100 : 0

  if (r.top[0]) parts.push(`가장 큰 지출은 ${r.top[0].name} ${shortWon(r.top[0].amount)}원이다`)
  if (prevTotal > 0) {
    parts.push(
      wasteNow <= wastePrev
        ? `낭비 비중은 ${pct(wastePrev, 1)}에서 ${pct(wasteNow, 1)}로 내려갔다`
        : `낭비 비중이 ${pct(wastePrev, 1)}에서 ${pct(wasteNow, 1)}로 올라갔다`,
    )
  }
  if (r.noSpendDays > 0) parts.push(`무지출일은 ${r.noSpendDays}일이었다`)
  return parts.join('. ') + '.'
}
