'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Amount } from '@/components/amount'
import { GRADE_COLOR, GRADE_LABEL } from '@/components/charts'
import { IconCheck, IconPlus } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Empty, MonthNav, Pill, Progress, inputClass } from '@/components/ui/bits'
import { monthProgress, shiftMonth } from '@/lib/date'
import { pct, shortWon, won } from '@/lib/format'
import { budgetLines, safePlan, spendable, suggestBudgets } from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import { sum } from '@/lib/utils'

export default function BudgetPage() {
  const db = useStore((s) => s.db)
  const month = useStore((s) => s.month)
  const setMonth = useStore((s) => s.setMonth)
  const upsert = useStore((s) => s.upsertBudget)
  const drop = useStore((s) => s.drop)
  const [adding, setAdding] = useState(false)
  const [applied, setApplied] = useState(false)

  const v = useMemo(
    () => ({
      lines: budgetLines(db, month),
      sp: spendable(db, month),
      plan: safePlan(db, month),
      suggestions: suggestBudgets(db, month),
    }),
    [db, month],
  )
  const { lines, sp, plan, suggestions } = v

  const planned = sum(lines.map((l) => l.planned))
  const spentInBudget = sum(lines.map((l) => l.spent))
  // 예산을 잡지 않은 변동지출도 같은 지갑에서 나간다. 빼놓고 보면 안심하게 된다.
  const spent = sp.basedOn === 'budget' ? sp.spent : spentInBudget
  const outside = Math.max(0, spent - spentInBudget)
  const progress = monthProgress(month) * 100
  const unbudgeted = suggestions.filter((s) => s.current === null)

  async function applyAll() {
    for (const s of suggestions) {
      if (s.current === null) await upsert(s.categoryId, month, s.suggested)
    }
    setApplied(true)
    setTimeout(() => setApplied(false), 2400)
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <MonthNav month={month} onChange={setMonth} />
        <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
          <IconPlus width={15} height={15} /> 카테고리
        </Button>
      </div>

      {/* 전체 소진율 */}
      <Card>
        <CardHead
          title="이번 달 예산"
          sub={
            lines.length
              ? `${pct(progress, 0)} 지났고 ${pct(planned ? (spent / planned) * 100 : 0, 0)} 썼다`
              : '아직 예산이 없다 — 안전 예산으로만 판정하고 있다'
          }
          right={
            lines.length ? (
              <Pill tone={sp.paceGapPp > 20 ? 'danger' : sp.paceGapPp > 5 ? 'warn' : 'good'}>
                {sp.paceGapPp > 0 ? `${pct(sp.paceGapPp, 0)} 빠름` : '여유'}
              </Pill>
            ) : null
          }
        />
        <CardBody className="pt-2.5">
          {lines.length ? (
            <>
              <Progress
                value={planned ? (spent / planned) * 100 : 0}
                marker={progress}
                tone={sp.paceGapPp > 20 ? 'danger' : sp.paceGapPp > 5 ? 'warn' : 'accent'}
              />
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <Cell label="계획" value={planned} />
                <Cell label="변동지출" value={spent} />
                <Cell label="남음" value={planned - spent} tone={planned - spent < 0 ? 'danger' : 'good'} />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                세로선이 오늘까지의 경과율이다. 막대가 선보다 앞서 있으면 속도가 빠른 것이다.
                {outside > 0 ? (
                  <>
                    {' '}예산 잡은 카테고리에서 <b className="text-muted">{shortWon(spentInBudget)}원</b>,
                    예산 밖 변동지출이 <b className="text-muted">{shortWon(outside)}원</b> 더 있다.
                    자주 쓰는 것부터 몇 개 더 잡으면 판정이 정확해진다.
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted">
              예산이 없으면 최근 6개월 수입 중앙값에서 고정비·세금·목표 저축을 뺀{' '}
              <b className="text-fg">안전 예산 <Amount value={plan.safeBudget} short /></b>으로 판정한다.
              카테고리 예산을 잡으면 어디서 새는지까지 짚을 수 있다.
            </p>
          )}
        </CardBody>
      </Card>

      {/* 자동 제안 */}
      {unbudgeted.length > 0 ? (
        <Card className="border-accent/30">
          <CardHead
            title="예산 자동 제안"
            sub="최근 3개월 중앙값 기준. 한 달 크게 쓴 것이 예산을 부풀리지 않게 평균 대신 중앙값을 쓴다."
            right={
              <Button variant="primary" size="sm" onClick={applyAll}>
                {applied ? <IconCheck width={15} height={15} /> : null}
                {applied ? '적용함' : `${unbudgeted.length}개 전부 적용`}
              </Button>
            }
          />
          <CardBody className="space-y-1.5 pt-2">
            {unbudgeted.slice(0, 8).map((s) => (
              <div key={s.categoryId} className="flex items-center gap-2.5">
                <span className="w-5 text-center text-[15px]">{s.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                <span className="amount tnum text-[13px] font-medium">{won(s.suggested)}원</span>
                <Button size="sm" variant="outline" onClick={() => void upsert(s.categoryId, month, s.suggested)}>
                  적용
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {/* 카테고리 추가 */}
      {adding ? (
        <Card>
          <CardHead title="예산 추가" sub="소분류 단위로 잡는다" />
          <CardBody className="max-h-80 space-y-1.5 overflow-y-auto pt-2">
            {db.categories
              .filter((c) => c.direction === 'out' && c.parent_id)
              .filter((c) => !lines.some((l) => l.categoryId === c.id))
              .map((c) => (
                <AddRow
                  key={c.id}
                  icon={c.icon}
                  name={c.name}
                  suggested={suggestions.find((s) => s.categoryId === c.id)?.suggested ?? 0}
                  onAdd={(v) => void upsert(c.id, month, v)}
                />
              ))}
          </CardBody>
        </Card>
      ) : null}

      {/* 예산 라인 */}
      {lines.length === 0 ? (
        !adding ? (
          <Card>
            <Empty
              title="예산을 아직 안 잡았다"
              body="자주 쓰는 3~4개만 잡아도 충분하다. 전부 잡으려다 보면 한 달도 못 간다."
              action={
                <Button variant="primary" onClick={() => setAdding(true)}>
                  카테고리 고르기
                </Button>
              }
            />
          </Card>
        ) : null
      ) : (
        <Card className="divide-y divide-line">
          <CardHead title="카테고리별" sub="금액을 직접 고칠 수 있다" />
          {lines.map((l) => (
            <div key={l.categoryId} className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 text-center text-[15px]">{l.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium">
                    {l.name}
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{ background: GRADE_COLOR[l.grade] }}
                      title={GRADE_LABEL[l.grade]}
                    />
                  </p>
                  <p className="tnum text-[11px] text-faint">
                    {shortWon(l.spent)} / {shortWon(l.planned)}
                    {l.carryover > 0 ? ` · 이월 ${shortWon(l.carryover)}` : ''}
                  </p>
                </div>
                <span
                  className={
                    'amount tnum text-[13px] font-semibold ' + (l.remain < 0 ? 'text-danger' : 'text-muted')
                  }
                >
                  {l.remain < 0 ? `${shortWon(-l.remain)} 초과` : `${shortWon(l.remain)} 남음`}
                </span>
              </div>
              <Progress
                className="mt-2"
                value={l.usedPct}
                marker={progress}
                tone={l.usedPct > 100 ? 'danger' : l.usedPct > progress + 20 ? 'warn' : 'accent'}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  defaultValue={l.planned - l.carryover}
                  onBlur={(e) => {
                    const next = Number(e.target.value)
                    if (next !== l.planned - l.carryover) void upsert(l.categoryId, month, next)
                  }}
                  className="w-32 rounded-[7px] border border-line bg-surface-2 px-2 py-1.5 text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const b = db.budgets.find((x) => x.month === month && x.category_id === l.categoryId)
                    if (b) void drop('budgets', b.id)
                  }}
                  className="text-[12px] text-faint hover:text-danger"
                >
                  빼기
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {lines.length > 0 ? (
        <Card>
          <CardHead title="다음 달 미리 잡기" sub={`${shiftMonth(month, 1).slice(5)}월 예산을 지금 복사해 둔다`} />
          <CardBody className="pt-2">
            <Row label="이번 달 계획" value={<Amount value={planned} />} />
            <Row label="이번 달 실제" value={<Amount value={spent} />} />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={async () => {
                const next = shiftMonth(month, 1)
                for (const l of lines) await upsert(l.categoryId, next, l.planned)
                setMonth(next)
              }}
            >
              다음 달로 복사
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="px-1 pb-2">
        <Link href="/monthly" className="text-[12px] text-accent">
          월간 결산 보기 →
        </Link>
      </div>
    </div>
  )
}

function Cell({
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

function AddRow({
  icon,
  name,
  suggested,
  onAdd,
}: {
  icon: string
  name: string
  suggested: number
  onAdd: (v: number) => void
}) {
  const [value, setValue] = useState(suggested || 100000)
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 text-center text-[15px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className={inputClass.replace('w-full', 'w-28') + ' py-1.5'}
      />
      <Button size="sm" variant="outline" onClick={() => onAdd(value)}>
        추가
      </Button>
    </div>
  )
}
