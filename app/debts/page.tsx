'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { PayoffCompare } from '@/components/charts'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Pill, Segmented } from '@/components/ui/bits'
import { pct, shortWon, won } from '@/lib/format'
import { compare, marginalEffect, type Strategy } from '@/lib/finance/debt'
import { spendable } from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import { sum } from '@/lib/utils'

const STEPS = [0, 50_000, 100_000, 200_000, 300_000, 500_000]

export default function DebtsPage() {
  const db = useStore((s) => s.db)
  const [extra, setExtra] = useState(100_000)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')

  const live = db.debts.filter((d) => d.balance > 0)
  const c = useMemo(() => compare(live, extra), [live, extra])
  const marginal = useMemo(() => marginalEffect(live, extra, strategy, 100_000), [live, extra, strategy])
  const sp = useMemo(() => spendable(db), [db])

  if (live.length === 0) {
    return (
      <div className="p-3">
        <Card>
          <Empty
            title="갚을 부채가 없다"
            body="부채가 없으면 이 화면은 할 일이 없다. 그 상태가 제일 좋다."
            action={
              <Link href="/assets">
                <Button variant="outline">자산 보기</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const picked = strategy === 'snowball' ? c.snowball : c.avalanche
  const minTotal = sum(live.map((d) => d.min_payment))
  const worst = [...live].sort((a, b) => b.interest_rate - a.interest_rate)[0]

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="부채 상환 시뮬레이터"
          sub={`${live.length}건 · 잔액 ${won(sum(live.map((d) => d.balance)))}원`}
        />
        <CardBody className="pt-2">
          <Row label="월 최소 상환 합계" value={<Amount value={minTotal} />} />
          <Row
            label="추가로 넣을 돈"
            value={<Amount value={extra} />}
            sub={`월 ${shortWon(minTotal + extra)} 상환`}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setExtra(v)}
                className={
                  'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ' +
                  (extra === v ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted')
                }
              >
                +{v === 0 ? '0' : shortWon(v)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={1_000_000}
            step={10_000}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="mt-3 w-full accent-[hsl(var(--accent))]"
          />
          {sp.remain > 0 ? (
            <p className="mt-1.5 text-[11px] text-faint">
              이번 달 남은 돈이 <Amount value={sp.remain} short className="text-muted" />다. 여기서 끌어올 수 있다.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {c.snowball.insufficient ? (
        <Card className="border-danger/40">
          <CardBody>
            <p className="text-[14px] font-semibold text-danger">최소 상환액이 이자보다 적다</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              지금 상환액으로는 원금이 전혀 줄지 않는다. 월 상환액을 늘리거나,
              {worst ? ` ${worst.name}(${pct(worst.interest_rate, 1)})의 ` : ' '}금리를 낮추는 것부터 해야 한다.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* 추천 */}
          <Card className="border-accent/35">
            <CardBody>
              <div className="flex items-center gap-2">
                <Pill tone="accent">추천</Pill>
                <p className="text-[15px] font-bold">
                  {c.recommend === 'avalanche' ? '눈사태 — 높은 이자부터' : '눈덩이 — 작은 잔액부터'}
                </p>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.reason}</p>
              <p className="mt-2 text-[13px] leading-relaxed">
                눈사태로 가면 눈덩이보다 이자를{' '}
                <b className={c.interestSaved >= 0 ? 'text-good' : 'text-danger'}>
                  <Amount value={Math.abs(c.interestSaved)} />
                </b>{' '}
                {c.interestSaved >= 0 ? '아낀다' : '더 낸다'}.{' '}
                {c.monthsSaved === 0 ? (
                  '끝나는 시점은 같다.'
                ) : (
                  <>
                    끝나는 시점은{' '}
                    <b className={c.monthsSaved > 0 ? 'text-good' : 'text-danger'}>
                      {Math.abs(c.monthsSaved)}개월
                    </b>{' '}
                    {c.monthsSaved > 0 ? '빨라진다' : '늦어진다'}.
                  </>
                )}
              </p>
            </CardBody>
          </Card>

          <Segmented
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: 'avalanche', label: '눈사태' },
              { value: 'snowball', label: '눈덩이' },
            ]}
          />

          <Card>
            <CardHead
              title="잔액이 줄어드는 모양"
              sub="다 갚은 부채의 상환액은 다음 부채로 굴려 넣는다 — 이게 두 방식의 핵심이다"
            />
            <CardBody className="pt-2">
              <PayoffCompare snowball={c.snowball.series} avalanche={c.avalanche.series} />
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Stat
              title="눈사태"
              months={c.avalanche.months}
              interest={c.avalanche.totalInterest}
              active={strategy === 'avalanche'}
            />
            <Stat
              title="눈덩이"
              months={c.snowball.months}
              interest={c.snowball.totalInterest}
              active={strategy === 'snowball'}
            />
          </div>

          <Card>
            <CardHead title="갚는 순서" sub={strategy === 'avalanche' ? '이자율 높은 것부터' : '잔액 작은 것부터'} />
            <CardBody className="space-y-2 pt-2">
              {picked.order.map((o, i) => {
                const d = live.find((x) => x.id === o.id)
                return (
                  <div key={o.id} className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {o.name}
                        {d ? <span className="ml-1.5 text-[11px] text-faint">{pct(d.interest_rate, 1)}</span> : null}
                      </p>
                      <p className="text-[11px] text-faint">
                        {o.paidOffAt > 0 ? `${o.paidOffAt}개월 뒤 완제` : '기간 내 미완제'} · 이자{' '}
                        {shortWon(o.interest)}원
                      </p>
                    </div>
                    {d ? <Amount value={d.balance} short className="text-[13px] font-medium" /> : null}
                  </div>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="10만원을 더 넣으면" sub="지금 선택한 방식 기준" />
            <CardBody className="pt-2">
              <Row label="단축되는 기간" value={`${marginal.monthsSaved}개월`} />
              <Row label="아끼는 이자" value={<Amount value={marginal.interestSaved} />} />
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {worst && worst.interest_rate >= 10 ? (
                  <>
                    {worst.name}은 연 {pct(worst.interest_rate, 1)}다. 여기에 넣는 10만원은
                    연 {pct(worst.interest_rate, 1)} 확정 수익과 같다. 어떤 투자보다 먼저다.
                  </>
                ) : (
                  <>이자율이 낮은 편이다. 비상자금 3개월분을 먼저 채우고 나서 추가 상환을 늘려도 된다.</>
                )}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="두 방식 비교" sub="같은 돈으로 같은 부채를 갚을 때" />
            <CardBody className="pt-2">
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full text-[12px]">
                  <thead className="bg-surface-2 text-faint">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">방식</th>
                      <th className="px-2 py-1.5 text-right font-medium">기간</th>
                      <th className="px-2 py-1.5 text-right font-medium">총 이자</th>
                      <th className="px-2 py-1.5 text-right font-medium">총 상환</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '눈사태 (고금리 우선)', r: c.avalanche },
                      { label: '눈덩이 (소액 우선)', r: c.snowball },
                    ].map((row) => (
                      <tr key={row.label} className="border-t border-line">
                        <td className="px-2 py-1.5">{row.label}</td>
                        <td className="tnum px-2 py-1.5 text-right">{row.r.months}개월</td>
                        <td className="amount tnum px-2 py-1.5 text-right">{won(row.r.totalInterest)}</td>
                        <td className="amount tnum px-2 py-1.5 text-right">{won(row.r.totalPaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                이자가 매달 잔액에 붙고, 최소 상환액을 먼저 다 낸 뒤 남은 여력을 1순위 부채에 전부 넣는 가정이다.
                중도상환수수료나 금리 변동은 넣지 않았다. 차이를 보는 용도다.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({
  title,
  months,
  interest,
  active,
}: {
  title: string
  months: number
  interest: number
  active: boolean
}) {
  return (
    <div
      className={
        'rounded-lg border p-3 ' + (active ? 'border-accent/50 bg-accent/[0.06]' : 'border-line bg-surface')
      }
    >
      <p className="text-[12px] font-medium text-muted">{title}</p>
      <p className="tnum mt-1 text-[22px] font-bold leading-none">
        {Math.floor(months / 12)}년 {months % 12}개월
      </p>
      <p className="amount tnum mt-1.5 text-[11px] text-faint">총 이자 {won(interest)}원</p>
    </div>
  )
}
