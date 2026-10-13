'use client'

import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { IconCheck, IconPlus, IconRefresh, IconTrash, IconX } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, Field, Pill, inputClass } from '@/components/ui/bits'
import { today, ymd } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import { CYCLE_LABEL, subSummary, subViews, advanceCharge } from '@/lib/finance/subs'
import { useStore } from '@/lib/store'
import type { SubCycle, Subscription } from '@/lib/types'
import { cn, uid } from '@/lib/utils'

export default function SubscriptionsPage() {
  const db = useStore((s) => s.db)
  const patch = useStore((s) => s.patch)
  const add = useStore((s) => s.add)
  const drop = useStore((s) => s.drop)
  const refresh = useStore((s) => s.refreshAgent)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const views = useMemo(() => subViews(db), [db])
  const s = useMemo(() => subSummary(views), [views])
  const zombieDays = db.rules.find((r) => r.code === 'ZOMBIE_SUB')?.params?.days ?? 60

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function cancel(id: string, name: string, yearly: number) {
    await patch('subscriptions', id, { status: 'cancelled' })
    await refresh()
    flash(`${name} 해지. 1년에 ${won(yearly)}원이 그대로 남는다.`)
  }

  return (
    <div className="space-y-3 p-3">
      {/* 연간 환산 — 이 화면이 존재하는 이유 */}
      <Card>
        <CardHead
          title="구독에 나가는 돈"
          sub={`${s.activeCount}개 · 월 ${won(s.monthlyTotal)}원`}
          right={
            <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
              <IconPlus width={15} height={15} /> 추가
            </Button>
          }
        />
        <CardBody className="pt-1">
          <p className="text-[11px] font-medium text-muted">1년으로 환산하면</p>
          <p className="amount tnum mt-0.5 text-[32px] font-bold leading-none tracking-tight">
            {shortWon(s.yearlyTotal)}
            <span className="ml-0.5 text-[18px] font-semibold">원</span>
          </p>
          <p className="amount tnum mt-1 text-[11px] text-faint">{won(s.yearlyTotal)}원 / 년</p>

          {s.zombies.length > 0 ? (
            <div className="mt-3 rounded-md border border-warn/30 bg-warn/[0.07] p-3">
              <p className="text-[13px] font-semibold text-warn">
                {zombieDays}일 넘게 안 쓴 구독 {s.zombies.length}개
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {s.zombies.map((z) => z.name).join(', ')} — 지금 해지하면 1년에{' '}
                <b className="text-fg">
                  <Amount value={s.zombieYearly} />
                </b>
                이 그대로 남는다.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.zombies.map((z) => (
                  <Button
                    key={z.id}
                    size="sm"
                    variant="outline"
                    onClick={() => void cancel(z.id, z.name, z.yearly)}
                  >
                    {z.name} 해지
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {s.lowValue.length > 0 ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              만족도 2점 이하가 {s.lowValue.length}개 있다. 전부 끊으면 연{' '}
              <b className="text-fg">
                <Amount value={s.lowValueYearly} short />
              </b>{' '}
              절약된다.
            </p>
          ) : null}

          {s.cancelledYearlySaved > 0 ? (
            <p className="mt-2 text-[12px] text-good">
              지금까지 해지로 아낀 돈 연 <Amount value={s.cancelledYearlySaved} />
            </p>
          ) : null}
        </CardBody>
      </Card>

      {adding ? <AddForm onDone={() => setAdding(false)} onAdd={add} categories={db.categories} /> : null}

      {views.length === 0 ? (
        <Card>
          <Empty
            title="등록된 구독이 없다"
            body="OTT·멤버십·업무 도구를 넣어 두면 연간 환산 합계가 나온다. 그 숫자를 보고 나서 끊을지 말지 정하게 된다."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                구독 추가
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {views.map((v) => (
            <Card
              key={v.id}
              className={cn(
                v.status === 'cancelled' && 'opacity-50',
                v.isZombie && 'border-warn/40',
              )}
            >
              <CardBody className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
                      {v.name}
                      {v.isZombie ? <Pill tone="warn">좀비</Pill> : null}
                      {v.status === 'cancelled' ? <Pill tone="muted">해지함</Pill> : null}
                      {v.raisePct ? <Pill tone="danger">+{pct(v.raisePct, 0)}</Pill> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {CYCLE_LABEL[v.cycle]} <Amount value={v.amount} className="text-muted" />
                      {v.cycle !== 'yearly' ? (
                        <>
                          {' · 연 '}
                          <Amount value={v.yearly} short className="text-muted" />
                        </>
                      ) : null}
                      {v.status !== 'cancelled'
                        ? v.daysToCharge >= 0
                          ? ` · ${v.daysToCharge}일 뒤 결제`
                          : ' · 결제일 지남'
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <Stars
                      value={v.value_rating}
                      onChange={(n) => void patch('subscriptions', v.id, { value_rating: n })}
                    />
                    <p className="mt-0.5 text-[10px] text-faint">만족도</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'text-[12px]',
                      v.isZombie ? 'text-warn' : v.unusedDays === null ? 'text-faint' : 'text-muted',
                    )}
                  >
                    {v.unusedDays === null
                      ? '사용 기록 없음'
                      : v.unusedDays === 0
                        ? '오늘 사용'
                        : `${v.unusedDays}일 전 사용`}
                  </span>
                  {v.status !== 'cancelled' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patch('subscriptions', v.id, { last_used_at: today() })}
                      >
                        <IconCheck width={14} height={14} /> 오늘 썼다
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await patch('subscriptions', v.id, { next_charge_at: advanceCharge(v) })
                        }}
                        title="다음 결제일을 주기만큼 미룬다"
                      >
                        <IconRefresh width={14} height={14} /> 결제됨
                      </Button>
                    </>
                  ) : null}
                </div>

                {v.status !== 'cancelled' ? (
                  <div className="flex items-center gap-2 border-t border-line pt-2.5">
                    <p className="flex-1 text-[12px] leading-snug text-faint">
                      해지하면 <b className="text-fg">연 {shortWon(v.yearly)}원</b>이 남는다
                      {v.isZombie ? ' · 최근에 쓴 적이 없다' : ''}
                    </p>
                    <Button size="sm" variant="danger" onClick={() => void cancel(v.id, v.name, v.yearly)}>
                      해지
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-t border-line pt-2.5">
                    <p className="flex-1 text-[12px] text-good">연 {shortWon(v.yearly)}원 절약 중</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void patch('subscriptions', v.id, { status: 'active' })}
                    >
                      되살리기
                    </Button>
                    <button
                      type="button"
                      onClick={() => void drop('subscriptions', v.id)}
                      aria-label="목록에서 지우기"
                      className="text-faint hover:text-danger"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {views.length > 0 ? (
        <Card>
          <CardHead title="해지 시뮬레이션" sub="만족도가 낮은 것부터 하나씩 끊어 보면" />
          <CardBody className="pt-2">
            {views
              .filter((v) => v.status !== 'cancelled')
              .slice(0, 5)
              .reduce<{ acc: number; rows: React.ReactNode[] }>(
                (state, v) => {
                  const acc = state.acc + v.yearly
                  state.rows.push(
                    <Row
                      key={v.id}
                      label={`${v.name}까지 끊으면`}
                      value={<Amount value={acc} />}
                      sub="연간"
                    />,
                  )
                  return { acc, rows: state.rows }
                },
                { acc: 0, rows: [] },
              ).rows}
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              위에서부터 끊을 후보 순서다 — 좀비 먼저, 그다음 만족도 낮은 순, 같으면 비싼 순.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-screen-sm px-3">
          <div className="flex items-center gap-2 rounded-lg border border-good/35 bg-good/[0.12] px-3.5 py-3 animate-slide-up">
            <IconCheck width={17} height={17} className="shrink-0 text-good" />
            <p className="flex-1 text-[13px] font-medium">{toast}</p>
            <button type="button" onClick={() => setToast(null)} aria-label="닫기" className="text-faint">
              <IconX width={16} height={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`만족도 ${n}점`}
          className={cn('text-[15px] leading-none', n <= value ? 'text-warn' : 'text-line')}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function AddForm({
  onDone,
  onAdd,
  categories,
}: {
  onDone: () => void
  onAdd: (table: 'subscriptions', row: Subscription) => Promise<void>
  categories: { id: string; name: string; direction: string; parent_id: string | null }[]
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [cycle, setCycle] = useState<SubCycle>('monthly')
  const [next, setNext] = useState(ymd(new Date(Date.now() + 7 * 86400000)))
  const [categoryId, setCategoryId] = useState('c-leisure-sub')

  return (
    <Card>
      <CardHead title="구독 추가" sub="이름과 금액만 넣으면 된다" />
      <CardBody className="space-y-2.5 pt-2">
        <Field label="이름">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="넷플릭스" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="금액">
            <input
              type="number"
              inputMode="numeric"
              className={inputClass}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="주기">
            <select className={inputClass} value={cycle} onChange={(e) => setCycle(e.target.value as SubCycle)}>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
              <option value="weekly">매주</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="다음 결제일">
            <input type="date" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="카테고리">
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories
                .filter((c) => c.direction === 'out' && c.parent_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={!name || amount <= 0}
            onClick={async () => {
              await onAdd('subscriptions', {
                id: uid('sb-'),
                name,
                amount,
                cycle,
                next_charge_at: next,
                last_used_at: today(),
                value_rating: 3,
                status: 'active',
                category_id: categoryId,
                price_history: [{ date: today(), amount }],
              })
              onDone()
            }}
          >
            추가
          </Button>
          <Button variant="ghost" onClick={onDone}>
            취소
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
