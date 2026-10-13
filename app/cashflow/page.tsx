'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Amount } from '@/components/amount'
import { FixedVariableBars, FlowBars, Legend, VIZ } from '@/components/charts'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Pill, Progress } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { thisMonth } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import {
  fixedProfile,
  flowSeries,
  monthFlow,
  safePlan,
  upcomingFixed,
} from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import { sum } from '@/lib/utils'

export default function CashflowPage() {
  const db = useStore((s) => s.db)
  const month = thisMonth()

  const v = useMemo(() => {
    const series = flowSeries(db, 6)
    return {
      series,
      flow: monthFlow(db, month),
      fixed: fixedProfile(db, month),
      plan: safePlan(db, month),
      upcoming: upcomingFixed(db, month),
    }
  }, [db, month])

  const { series, flow, fixed, plan, upcoming } = v
  if (db.transactions.length === 0) {
    return (
      <div className="p-3">
        <Card>
          <Empty
            title="아직 흐름이 없다"
            body="수입과 지출이 몇 건 쌓이면 고정/변동이 갈리고, 불규칙 수입에 맞춘 안전 예산이 계산된다."
            action={
              <Link href="/add">
                <Button variant="primary">지출 입력</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const danger = fixed.ratio >= 50

  return (
    <div className="space-y-3 p-3">
      {/* 고정지출 비중 — 이 화면의 주인공 */}
      <Card className={danger ? 'border-danger/40' : undefined}>
        <CardHead
          title="고정지출 비중"
          sub="수입의 50%를 넘으면 변동지출을 아껴도 복구되지 않는다"
          right={
            <Pill tone={danger ? 'danger' : fixed.ratio >= 40 ? 'warn' : 'good'}>
              {pct(fixed.ratio, 0)}
            </Pill>
          }
        />
        <CardBody className="pt-2.5">
          <Progress value={fixed.ratio} tone={danger ? 'danger' : fixed.ratio >= 40 ? 'warn' : 'good'} marker={50} />
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            월 수입 <Amount value={fixed.incomeBase} short /> 중{' '}
            <Amount value={fixed.fixedBase} short />이 들어오기 전에 이미 정해져 나간다.
            {danger ? ' 가장 큰 고정비 하나를 손대는 것 말고는 방법이 없다.' : ' 아직 여유가 있다.'}
          </p>
          <p className="mt-1 text-[11px] text-faint">
            이번 달 숫자가 아니라 완결된 직전 3개월로 계산한다 — 월 중에는 아직 안 나간 고정비 때문에
            비중이 낮게 보이기 때문이다.
          </p>
        </CardBody>
      </Card>

      {/* 월별 수입/지출 */}
      <Card>
        <CardHead title="6개월 수입 · 지출" sub="막대를 누르면 정확한 금액이 나온다" />
        <CardBody className="pt-2">
          <FlowBars data={series} />
        </CardBody>
      </Card>

      {/* 고정 vs 변동 */}
      <Card>
        <CardHead title="고정 vs 변동" sub="줄일 수 있는 쪽은 변동지출뿐이다" />
        <CardBody className="pt-2">
          <FixedVariableBars data={series} />
          <div className="mt-3 overflow-hidden rounded-md border border-line">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-faint">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">월</th>
                  <th className="px-2 py-1.5 text-right font-medium">고정</th>
                  <th className="px-2 py-1.5 text-right font-medium">변동</th>
                  <th className="px-2 py-1.5 text-right font-medium">남김</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((f) => (
                  <tr key={f.month} className="border-t border-line">
                    <td className="px-2 py-1.5 text-muted">{f.month.slice(5)}월</td>
                    <td className="amount tnum px-2 py-1.5 text-right">{shortWon(f.fixed)}</td>
                    <td className="amount tnum px-2 py-1.5 text-right">{shortWon(f.variable)}</td>
                    <td
                      className={
                        'amount tnum px-2 py-1.5 text-right font-medium ' +
                        (f.net >= 0 ? 'text-good' : 'text-danger')
                      }
                    >
                      {shortWon(f.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 불규칙 수입 안전 예산 */}
      <Card>
        <CardHead
          title={plan.irregular ? '안전 예산 (불규칙 수입)' : '안전 예산'}
          sub={
            plan.irregular
              ? '최근 6개월 수입의 중앙값에서 출발한다. 평균은 한 번의 큰 입금에 끌려간다.'
              : '최근 수입에서 고정비와 세금, 목표 저축을 뺀 금액이다.'
          }
        />
        <CardBody className="pt-2">
          <Row label="기준 수입 (중앙값)" value={<Amount value={plan.baseIncome} />} />
          <Row label="− 고정지출 평균" value={<Amount value={-plan.fixedAvg} signed />} />
          {plan.taxReserve > 0 ? (
            <Row label="− 세금 적립 필요" value={<Amount value={-plan.taxReserve} signed />} />
          ) : null}
          {plan.goalSaving > 0 ? (
            <Row label="− 목표 저축" value={<Amount value={-plan.goalSaving} signed />} />
          ) : null}
          <div className="mt-1.5 border-t border-line pt-2">
            <Row
              label={<b className="text-fg">이번 달 안전 예산</b>}
              value={<b className="text-accent"><Amount value={plan.safeBudget} /></b>}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            수입이 들쭉날쭉하면 좋았던 달을 기준으로 쓰게 된다. 중앙값은 그 유혹을 막는 선이다.
          </p>
        </CardBody>
      </Card>

      {/* 남은 고정지출 */}
      <Card>
        <CardHead
          title="남은 고정지출"
          sub={upcoming.length ? `${upcoming.length}건 예정` : '이번 달 고정지출은 다 나갔다'}
          right={
            upcoming.length ? (
              <span className="amount tnum text-sm font-semibold">
                {shortWon(sum(upcoming.map((u) => u.amount)))}원
              </span>
            ) : null
          }
        />
        {upcoming.length ? (
          <CardBody className="space-y-1.5 pt-2">
            {upcoming.map((u) => (
              <div key={`${u.label}-${u.date}`} className="flex items-center justify-between text-[13px]">
                <span className="text-muted">
                  <span className="tnum mr-2 text-faint">{u.date.slice(5).replace('-', '/')}</span>
                  {u.label}
                </span>
                <Amount value={u.amount} />
              </div>
            ))}
          </CardBody>
        ) : null}
      </Card>

      <Card>
        <CardHead title="이번 달" />
        <CardBody className="pt-2">
          <Row label="수입" value={<Amount value={flow.income} />} />
          <Row label="지출" value={<Amount value={flow.expense} />} />
          <Row
            label="남김"
            value={
              <span className={flow.net >= 0 ? 'text-good' : 'text-danger'}>
                <Amount value={flow.net} signed />
              </span>
            }
          />
          {db.settings.business_mode ? (
            <>
              <Row label="사업 수입" value={<Amount value={flow.businessIncome} />} sub="세금 전" />
              <Row label="사업 비용" value={<Amount value={flow.businessExpense} />} />
            </>
          ) : null}
          <Legend items={[{ color: VIZ.in, label: '수입' }, { color: VIZ.out, label: '지출' }]} />
        </CardBody>
      </Card>

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-faint">
        수입이 최근 3개월 동안 직전 3개월보다 30% 이상 줄면 에이전트가 긴축 플랜을 띄운다.
        지금은 <b className="text-muted">{pct(fixed.ratio, 0)}</b>가 고정으로 묶여 있다.
      </p>
    </div>
  )
}
