'use client'

import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { FlowBars } from '@/components/charts'
import { IconCheck, IconPlus, IconTrash } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Field, MonthNav, Pill, Progress, inputClass } from '@/components/ui/bits'
import { lastMonths, today, ymd } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import { categoryTotals, monthFlow } from '@/lib/finance/selectors'
import { openReceivables, taxView, taxYearView } from '@/lib/finance/tax'
import { useStore } from '@/lib/store'
import type { Receivable } from '@/lib/types'
import { sum, uid } from '@/lib/utils'

export default function BusinessPage() {
  const db = useStore((s) => s.db)
  const month = useStore((s) => s.month)
  const setMonth = useStore((s) => s.setMonth)
  const setSettings = useStore((s) => s.setSettings)
  const setReserve = useStore((s) => s.setReserve)
  const add = useStore((s) => s.add)
  const patch = useStore((s) => s.patch)
  const drop = useStore((s) => s.drop)
  const [adding, setAdding] = useState(false)
  const [reserveInput, setReserveInput] = useState<number | null>(null)

  const v = useMemo(() => {
    const t = taxView(db, month)
    return {
      tax: t,
      year: taxYearView(db, 12),
      flow: monthFlow(db, month),
      bizCats: categoryTotals(db, month, { business: true }),
      receivables: openReceivables(db),
      series: lastMonths(6).map((m) => {
        const f = monthFlow(db, m)
        return { month: m, income: f.businessIncome, expense: f.businessExpense }
      }),
    }
  }, [db, month])

  const { tax, year, bizCats, receivables, series } = v
  const overdue = receivables.filter((r) => r.overdueDays > 0)

  if (!db.settings.business_mode) {
    return (
      <div className="p-3">
        <Card>
          <Empty
            title="사업자 모드가 꺼져 있다"
            body="켜면 개인/사업 거래가 나뉘고, 사업 수입에서 세금 몫을 먼저 뗀 '실제 내 돈'이 계산된다."
            action={
              <Button variant="primary" onClick={() => void setSettings({ business_mode: true })}>
                사업자 모드 켜기
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <MonthNav month={month} onChange={setMonth} />

      {/* 실제 내 돈 — 이 화면이 존재하는 이유 */}
      <Card className={tax.shortfall > 0 ? 'border-danger/40' : 'border-good/30'}>
        <CardBody>
          <p className="text-[12px] font-medium text-muted">세금 떼고 실제 내 돈</p>
          <p className="amount tnum mt-1 text-[32px] font-bold leading-none tracking-tight">
            {shortWon(tax.netOwn)}
            <span className="ml-0.5 text-[18px] font-semibold">원</span>
          </p>
          <p className="amount tnum mt-1 text-[11px] text-faint">
            사업 수입 {won(tax.businessIncome)}원 − 비용 {won(tax.businessExpense)}원 − 세금{' '}
            {won(tax.required)}원
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            통장에 들어온 <Amount value={tax.businessIncome} short />이 전부 내 돈이 아니다.
            세금 몫을 먼저 떼고 보지 않으면 수입을 과대평가하게 된다.
          </p>
        </CardBody>
      </Card>

      {/* 세금 적립 */}
      <Card>
        <CardHead
          title="세금 적립"
          sub={`부가세 ${db.settings.vat_rate}% · 종소세 예상 ${db.settings.income_tax_rate}%`}
          right={
            <Pill tone={tax.coverPct >= 90 ? 'good' : tax.coverPct >= 50 ? 'warn' : 'danger'}>
              {pct(Math.min(100, tax.coverPct), 0)}
            </Pill>
          }
        />
        <CardBody className="pt-2.5">
          <Progress
            value={tax.coverPct}
            tone={tax.coverPct >= 90 ? 'good' : tax.coverPct >= 50 ? 'warn' : 'danger'}
          />
          <div className="mt-3">
            <Row label="부가세 예상" value={<Amount value={tax.vat} />} sub="매출세액 − 매입세액" />
            <Row label="종합소득세 예상" value={<Amount value={tax.incomeTax} />} sub="(수입 − 비용) 기준" />
            <div className="mt-1.5 border-t border-line pt-2">
              <Row label={<b className="text-fg">떼어 둬야 할 돈</b>} value={<b><Amount value={tax.required} /></b>} />
              <Row label="실제 적립" value={<Amount value={tax.reserved} />} />
              {tax.shortfall > 0 ? (
                <Row
                  label={<span className="text-danger">모자란 금액</span>}
                  value={<b className="text-danger"><Amount value={tax.shortfall} /></b>}
                />
              ) : null}
            </div>
          </div>

          {tax.shortfall > 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-danger">
              지금 <Amount value={tax.shortfall} />을 세금 통장으로 옮겨라. 이 돈은 처음부터 내 돈이 아니었다.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-good">이번 달 세금 몫은 다 떼어 뒀다.</p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              className={inputClass}
              placeholder={`적립액 입력 (현재 ${won(tax.reserved)})`}
              value={reserveInput ?? ''}
              onChange={(e) => setReserveInput(Number(e.target.value))}
            />
            <Button
              variant="outline"
              onClick={async () => {
                if (reserveInput === null) return
                await setReserve(month, reserveInput, tax.required, tax.businessIncome)
                setReserveInput(null)
              }}
            >
              저장
            </Button>
            {tax.shortfall > 0 ? (
              <Button
                variant="primary"
                onClick={async () => {
                  await setReserve(month, tax.required, tax.required, tax.businessIncome)
                  setReserveInput(null)
                }}
              >
                <IconCheck width={15} height={15} /> 전액
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* 미수금 */}
      <Card className={overdue.length ? 'border-warn/35' : undefined}>
        <CardHead
          title="미수금"
          sub={
            receivables.length
              ? `${receivables.length}건 · ${won(sum(receivables.map((r) => r.amount)))}원${
                  overdue.length ? ` · 밀린 것 ${overdue.length}건` : ''
                }`
              : '받을 돈 없음'
          }
          right={
            <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        {adding ? (
          <CardBody className="border-b border-line pt-2">
            <ReceivableForm
              onDone={() => setAdding(false)}
              onAdd={async (row) => {
                await add('receivables', row)
              }}
            />
          </CardBody>
        ) : null}
        <CardBody className="space-y-2 pt-2">
          {receivables.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-faint">
              받을 돈을 넣어 두면 지연 일수가 자동으로 센다. 프리랜서는 이 숫자를 모르면
              돈이 들어온 줄 알고 쓰게 된다.
            </p>
          ) : (
            receivables.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-md bg-surface-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {r.client}
                    {r.overdueDays > 0 ? (
                      <span className="ml-1.5 text-[11px] font-semibold text-warn">{r.overdueDays}일 지연</span>
                    ) : (
                      <span className="ml-1.5 text-[11px] text-faint">{-r.overdueDays}일 뒤</span>
                    )}
                  </p>
                  <p className="text-[11px] text-faint">
                    {r.due_at} {r.memo ? `· ${r.memo}` : ''}
                  </p>
                </div>
                <Amount value={r.amount} short className="text-[13px] font-semibold" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void patch('receivables', r.id, { paid_at: today() })}
                >
                  입금됨
                </Button>
                <button
                  type="button"
                  onClick={() => void drop('receivables', r.id)}
                  aria-label="삭제"
                  className="text-faint hover:text-danger"
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* 사업 수입/비용 추이 */}
      <Card>
        <CardHead title="사업 수입 · 비용" sub="6개월" />
        <CardBody className="pt-2">
          <FlowBars data={series} />
        </CardBody>
      </Card>

      {/* 사업 비용 내역 */}
      <Card>
        <CardHead title="이번 달 사업 비용" sub="연말 경비 정리는 여기서 시작한다" />
        <CardBody className="space-y-1.5 pt-2">
          {bizCats.length === 0 ? (
            <p className="text-[12px] text-faint">사업으로 표시한 지출이 없다. 입력 화면의 "사업" 토글을 쓰면 된다.</p>
          ) : (
            bizCats.map((c) => (
              <div key={c.categoryId} className="flex items-center gap-2.5">
                <span className="w-5 text-center text-[15px]">{c.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                <span className="tnum text-[11px] text-faint">{c.count}건</span>
                <Amount value={c.amount} short className="w-20 text-right text-[13px] font-medium" />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* 연간 */}
      <Card>
        <CardHead title="최근 12개월" sub="신고철에 당황하지 않으려면" />
        <CardBody className="pt-2">
          <Row label="사업 수입" value={<Amount value={year.businessIncome} />} />
          <Row label="떼어 뒀어야 할 세금" value={<Amount value={year.required} />} />
          <Row label="실제 적립" value={<Amount value={year.reserved} />} />
          <Row
            label={<span className={year.shortfall > 0 ? 'text-danger' : 'text-good'}>누적 부족분</span>}
            value={
              <b className={year.shortfall > 0 ? 'text-danger' : 'text-good'}>
                <Amount value={year.shortfall} />
              </b>
            }
          />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            부가세는 매출세액에서 매입세액을 뺀 단순 추정, 종소세는 (수입 − 비용)에 설정 세율을 곱한
            예상액이다. 공제·감면·간이과세는 반영하지 않는다. 실제 신고는 세무 전문가와 확인한다.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function ReceivableForm({
  onDone,
  onAdd,
}: {
  onDone: () => void
  onAdd: (row: Receivable) => Promise<void>
}) {
  const [client, setClient] = useState('')
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState(ymd(new Date(Date.now() + 14 * 86400000)))
  const [memo, setMemo] = useState('')
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="거래처">
          <input className={inputClass} value={client} onChange={(e) => setClient(e.target.value)} />
        </Field>
        <Field label="금액">
          <input
            type="number"
            className={inputClass}
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="입금 예정일">
          <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="메모">
          <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!client || amount <= 0}
          onClick={async () => {
            await onAdd({
              id: uid('rc-'),
              client,
              amount,
              due_at: due,
              paid_at: null,
              memo: memo || null,
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
