'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { TrendLine } from '@/components/charts'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Field, Pill, Progress, inputClass } from '@/components/ui/bits'
import { today } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import {
  emergencyMonths,
  avgMonthlyExpense,
  liquidCash,
  netWorth,
  netWorthSeries,
  totalAssets,
  totalDebts,
} from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import type { Account, AccountType, Asset, AssetKind, Debt } from '@/lib/types'
import { sum, uid } from '@/lib/utils'

const ASSET_KIND: Record<AssetKind, string> = {
  cash: '현금성',
  invest: '투자',
  realestate: '부동산',
  other: '기타',
}

const ACCOUNT_TYPE: Record<AccountType, string> = {
  checking: '입출금',
  savings: '저축',
  card: '카드',
  cash: '현금',
  invest: '투자',
  loan: '대출',
}

export default function AssetsPage() {
  const db = useStore((s) => s.db)
  const add = useStore((s) => s.add)
  const patch = useStore((s) => s.patch)
  const drop = useStore((s) => s.drop)
  const refresh = useStore((s) => s.refreshAgent)
  const [form, setForm] = useState<null | 'asset' | 'debt' | 'account'>(null)

  const v = useMemo(() => {
    const series = netWorthSeries(db, 12)
    return {
      series,
      nw: netWorth(db),
      prev: series.length > 1 ? series[series.length - 2].value : netWorth(db),
      assets: totalAssets(db),
      debts: totalDebts(db),
      cash: liquidCash(db),
      months: emergencyMonths(db),
      monthlyExpense: avgMonthlyExpense(db),
      peak: series.length > 1 ? Math.max(...series.slice(0, -1).map((s) => s.value)) : 0,
    }
  }, [db])

  const empty = db.assets.length === 0 && db.debts.length === 0 && db.accounts.length === 0

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="순자산"
          sub="총자산 − 총부채"
          right={
            v.nw > v.peak && v.peak > 0 ? <Pill tone="good">신고점</Pill> : null
          }
        />
        <CardBody className="pt-1">
          <div className="flex items-end gap-2">
            <span className="amount tnum text-[32px] font-bold leading-none tracking-tight">
              {shortWon(v.nw)}
              <span className="ml-0.5 text-[18px] font-semibold">원</span>
            </span>
            {v.nw !== v.prev ? (
              <span
                className={
                  'amount tnum mb-0.5 inline-flex items-center gap-0.5 text-[13px] font-semibold ' +
                  (v.nw >= v.prev ? 'text-good' : 'text-danger')
                }
              >
                {v.nw >= v.prev ? <IconArrowUp width={13} height={13} /> : <IconArrowDown width={13} height={13} />}
                {shortWon(Math.abs(v.nw - v.prev))}
              </span>
            ) : null}
          </div>
          <p className="amount tnum mt-1 text-[11px] text-faint">{won(v.nw)}원 · 전월 대비</p>
          {v.series.length > 1 ? (
            <div className="mt-3">
              <TrendLine data={v.series} zeroLine />
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-surface-2 px-3 py-2">
              <p className="text-[11px] text-faint">총자산</p>
              <p className="amount tnum mt-0.5 text-[15px] font-semibold">{shortWon(v.assets)}</p>
            </div>
            <div className="rounded-md bg-surface-2 px-3 py-2">
              <p className="text-[11px] text-faint">총부채</p>
              <p className="amount tnum mt-0.5 text-[15px] font-semibold text-danger">{shortWon(v.debts)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 비상자금 */}
      <Card className={v.months < 3 ? 'border-warn/35' : undefined}>
        <CardHead
          title="비상자금"
          sub="현금성 자산이 월 평균 지출의 몇 달 분인가"
          right={<Pill tone={v.months >= 6 ? 'good' : v.months >= 3 ? 'warn' : 'danger'}>{v.months.toFixed(1)}개월</Pill>}
        />
        <CardBody className="pt-2.5">
          <Progress value={(v.months / 6) * 100} tone={v.months >= 6 ? 'good' : v.months >= 3 ? 'warn' : 'danger'} marker={50} />
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            현금성 <Amount value={v.cash} short />, 월 평균 지출 <Amount value={v.monthlyExpense} short />.
            {v.months >= 6
              ? ' 6개월분을 넘겼다. 초과분은 고금리 부채 상환이나 목표로 돌릴 때다.'
              : ` 3개월분(${shortWon(v.monthlyExpense * 3)}원)이 최소선이다.`}
          </p>
          <p className="mt-1 text-[11px] text-faint">세로선이 3개월분이다. 투자·부동산은 현금성에서 뺀다.</p>
        </CardBody>
      </Card>

      {empty ? (
        <Card>
          <Empty
            title="자산도 부채도 비어 있다"
            body="통장 잔액과 카드 미결제액만 넣어도 순자산이 나온다. 정확할 필요 없다 — 추세만 맞으면 된다."
            action={
              <Button variant="primary" onClick={() => setForm('account')}>
                계좌 추가
              </Button>
            }
          />
        </Card>
      ) : null}

      {/* 계좌 */}
      <Card>
        <CardHead
          title="계좌"
          sub={`${db.accounts.length}개`}
          right={
            <Button variant="ghost" size="sm" onClick={() => setForm(form === 'account' ? null : 'account')}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        {form === 'account' ? (
          <CardBody className="border-b border-line pt-2">
            <AccountForm
              onDone={() => setForm(null)}
              onAdd={async (row) => {
                await add('accounts', row)
                await refresh()
              }}
            />
          </CardBody>
        ) : null}
        <CardBody className="space-y-1 pt-2">
          {db.accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {a.name}
                <span className="ml-1.5 text-[11px] text-faint">{ACCOUNT_TYPE[a.type]}</span>
                {a.is_business ? <span className="ml-1 text-[11px] text-accent">사업</span> : null}
              </span>
              <input
                type="number"
                defaultValue={a.balance}
                onBlur={(e) => void patch('accounts', a.id, { balance: Number(e.target.value) })}
                className="amount w-32 rounded-[7px] border border-line bg-surface-2 px-2 py-1.5 text-right text-[13px]"
              />
              <button
                type="button"
                onClick={() => void drop('accounts', a.id)}
                aria-label="삭제"
                className="text-faint hover:text-danger"
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>
          ))}
          {db.accounts.length === 0 ? <p className="text-[12px] text-faint">계좌가 없다.</p> : null}
        </CardBody>
      </Card>

      {/* 자산 */}
      <Card>
        <CardHead
          title="자산"
          sub={`평가액 합계 ${won(sum(db.assets.map((a) => a.value)))}원`}
          right={
            <Button variant="ghost" size="sm" onClick={() => setForm(form === 'asset' ? null : 'asset')}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        {form === 'asset' ? (
          <CardBody className="border-b border-line pt-2">
            <AssetForm
              onDone={() => setForm(null)}
              onAdd={async (row) => {
                await add('assets', row)
                await refresh()
              }}
            />
          </CardBody>
        ) : null}
        <CardBody className="space-y-1 pt-2">
          {db.assets.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {a.name}
                <span className="ml-1.5 text-[11px] text-faint">{ASSET_KIND[a.kind]}</span>
              </span>
              <input
                type="number"
                defaultValue={a.value}
                onBlur={(e) => void patch('assets', a.id, { value: Number(e.target.value), valued_at: today() })}
                className="amount w-32 rounded-[7px] border border-line bg-surface-2 px-2 py-1.5 text-right text-[13px]"
              />
              <button
                type="button"
                onClick={() => void drop('assets', a.id)}
                aria-label="삭제"
                className="text-faint hover:text-danger"
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>
          ))}
          {db.assets.length === 0 ? (
            <p className="text-[12px] text-faint">
              투자·부동산처럼 계좌로 안 잡히는 것을 여기에 넣는다. 평가액은 가끔 고쳐 주면 된다.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* 부채 */}
      <Card>
        <CardHead
          title="부채"
          sub="이자율 높은 순"
          right={
            <Button variant="ghost" size="sm" onClick={() => setForm(form === 'debt' ? null : 'debt')}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        {form === 'debt' ? (
          <CardBody className="border-b border-line pt-2">
            <DebtForm
              onDone={() => setForm(null)}
              onAdd={async (row) => {
                await add('debts', row)
                await refresh()
              }}
            />
          </CardBody>
        ) : null}
        <CardBody className="space-y-2 pt-2">
          {[...db.debts]
            .sort((a, b) => b.interest_rate - a.interest_rate)
            .map((d) => (
              <div key={d.id} className="rounded-md bg-surface-2 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{d.name}</span>
                  <Pill tone={d.interest_rate >= 15 ? 'danger' : d.interest_rate >= 7 ? 'warn' : 'muted'}>
                    {pct(d.interest_rate, 1)}
                  </Pill>
                  <button
                    type="button"
                    onClick={() => void drop('debts', d.id)}
                    aria-label="삭제"
                    className="text-faint hover:text-danger"
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <label className="flex-1 text-[11px] text-faint">
                    잔액
                    <input
                      type="number"
                      defaultValue={d.balance}
                      onBlur={(e) => void patch('debts', d.id, { balance: Number(e.target.value) })}
                      className="amount mt-0.5 w-full rounded-[7px] border border-line bg-surface px-2 py-1.5 text-right text-[13px] text-fg"
                    />
                  </label>
                  <label className="flex-1 text-[11px] text-faint">
                    월 상환
                    <input
                      type="number"
                      defaultValue={d.min_payment}
                      onBlur={(e) => void patch('debts', d.id, { min_payment: Number(e.target.value) })}
                      className="amount mt-0.5 w-full rounded-[7px] border border-line bg-surface px-2 py-1.5 text-right text-[13px] text-fg"
                    />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">
                  이대로 두면 1년 이자 <Amount value={(d.balance * d.interest_rate) / 100} short />
                  {d.maturity ? ` · 만기 ${d.maturity}` : ''}
                </p>
              </div>
            ))}
          {db.debts.length === 0 ? (
            <p className="text-[12px] text-faint">부채가 없다. 이 상태를 유지하는 게 제일 좋다.</p>
          ) : null}
        </CardBody>
      </Card>

      {db.debts.length > 0 ? (
        <Card className="border-accent/30">
          <CardHead title="상환 시뮬레이터" sub="눈덩이와 눈사태를 숫자로 비교한다" />
          <CardBody className="pt-2">
            <Row label="총 부채" value={<Amount value={sum(db.debts.map((d) => d.balance))} />} />
            <Row label="월 최소 상환" value={<Amount value={sum(db.debts.map((d) => d.min_payment))} />} />
            <Link href="/debts" className="mt-2 inline-block">
              <Button variant="primary" size="sm">
                몇 달 단축되는지 보기
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function AccountForm({ onDone, onAdd }: { onDone: () => void; onAdd: (row: Account) => Promise<void> }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [balance, setBalance] = useState(0)
  const [isBusiness, setIsBusiness] = useState(false)
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="이름">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="생활비 통장" />
        </Field>
        <Field label="종류">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="잔액" hint="카드·대출은 갚아야 할 금액을 양수로 넣는다">
        <input
          type="number"
          className={inputClass}
          value={balance || ''}
          onChange={(e) => setBalance(Number(e.target.value))}
        />
      </Field>
      <label className="flex items-center gap-2 text-[12px] text-muted">
        <input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
        사업용 계좌
      </label>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!name}
          onClick={async () => {
            await onAdd({
              id: uid('ac-'),
              name,
              type,
              balance,
              is_business: isBusiness,
              interest_rate: null,
              due_day: null,
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

function AssetForm({ onDone, onAdd }: { onDone: () => void; onAdd: (row: Asset) => Promise<void> }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AssetKind>('invest')
  const [value, setValue] = useState(0)
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="이름">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="ETF 계좌" />
        </Field>
        <Field label="종류">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
            {Object.entries(ASSET_KIND).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="평가액">
        <input type="number" className={inputClass} value={value || ''} onChange={(e) => setValue(Number(e.target.value))} />
      </Field>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!name}
          onClick={async () => {
            await onAdd({ id: uid('as-'), name, kind, value, valued_at: today() })
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

function DebtForm({ onDone, onAdd }: { onDone: () => void; onAdd: (row: Debt) => Promise<void> }) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState(0)
  const [rate, setRate] = useState(0)
  const [payment, setPayment] = useState(0)
  return (
    <div className="space-y-2.5">
      <Field label="이름">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="카드론" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="잔액">
          <input type="number" className={inputClass} value={balance || ''} onChange={(e) => setBalance(Number(e.target.value))} />
        </Field>
        <Field label="연이자율 %">
          <input type="number" className={inputClass} value={rate || ''} onChange={(e) => setRate(Number(e.target.value))} />
        </Field>
        <Field label="월 상환">
          <input type="number" className={inputClass} value={payment || ''} onChange={(e) => setPayment(Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!name || balance <= 0}
          onClick={async () => {
            await onAdd({
              id: uid('dt-'),
              name,
              principal: balance,
              balance,
              interest_rate: rate,
              min_payment: payment,
              maturity: null,
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
