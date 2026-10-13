'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Amount } from '@/components/amount'
import { IconBackspace, IconCheck, IconChevronDown, IconX } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { inputClass } from '@/components/ui/bits'
import { QUICK_CATEGORY_IDS } from '@/lib/defaults'
import { today } from '@/lib/date'
import { shortWon } from '@/lib/format'
import { guessCategory, recentMerchants } from '@/lib/finance/selectors'
import { useStore } from '@/lib/store'
import type { Direction } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * 필수 입력은 금액·카테고리 둘뿐이다.
 * 카테고리를 누르는 순간 저장되고 끝난다 — 따로 저장 버튼을 누르게 하지 않는다.
 */
export default function QuickAdd() {
  const router = useRouter()
  const db = useStore((s) => s.db)
  const addTransaction = useStore((s) => s.addTransaction)

  const [raw, setRaw] = useState('')
  const [direction, setDirection] = useState<Direction>('out')
  const [merchant, setMerchant] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState(today())
  const [isBusiness, setIsBusiness] = useState(false)
  const [isFixed, setIsFixed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [detail, setDetail] = useState(false)
  const [saved, setSaved] = useState<{ amount: number; name: string } | null>(null)

  const amount = Number(raw || 0)
  const merchants = useMemo(() => recentMerchants(db, 10), [db])
  const guessed = useMemo(() => (merchant ? guessCategory(db, merchant) : null), [db, merchant])

  const categories = useMemo(() => {
    const all = db.categories.filter((c) => c.direction === direction)
    if (direction === 'in') return all
    const leaves = all.filter((c) => c.parent_id)
    if (showAll) {
      return [...leaves].sort(
        (a, b) =>
          (a.parent_id ?? '').localeCompare(b.parent_id ?? '') || (a.sort ?? 0) - (b.sort ?? 0),
      )
    }
    const quick = QUICK_CATEGORY_IDS.map((id) => leaves.find((c) => c.id === id)).filter(
      (c): c is NonNullable<typeof c> => Boolean(c),
    )
    // 추론된 카테고리가 빠른 목록에 없으면 맨 앞에 끼워 넣는다.
    if (guessed && !quick.some((c) => c.id === guessed)) {
      const g = leaves.find((c) => c.id === guessed)
      if (g) quick.unshift(g)
    }
    return quick
  }, [db.categories, direction, showAll, guessed])

  const press = (d: string) => {
    if (d === '00') return setRaw((p) => (p === '' ? '' : (p + '00').slice(0, 10)))
    setRaw((p) => (p === '' && d === '0' ? '' : (p + d).slice(0, 10)))
  }

  async function save(categoryId: string) {
    if (amount <= 0) return
    const cat = db.categories.find((c) => c.id === categoryId)
    await addTransaction({
      account_id: db.accounts[0]?.id ?? null,
      date,
      amount,
      direction,
      category_id: categoryId,
      merchant: merchant.trim() || null,
      memo: memo.trim() || null,
      is_business: isBusiness,
      is_fixed: isFixed || Boolean(cat?.default_fixed),
      tags: [],
      hour: date === today() ? new Date().getHours() : null,
    })
    setSaved({ amount, name: cat?.name ?? '' })
    setRaw('')
    setMerchant('')
    setMemo('')
    setIsFixed(false)
    setTimeout(() => setSaved(null), 2600)
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
          {(
            [
              { v: 'out', label: '지출' },
              { v: 'in', label: '수입' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setDirection(o.v)}
              className={cn(
                'rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                direction === o.v
                  ? o.v === 'out'
                    ? 'bg-surface-2 text-fg'
                    : 'bg-good/20 text-good'
                  : 'text-faint',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDetail((d) => !d)}
          className="inline-flex items-center gap-1 text-[12px] text-faint hover:text-muted"
        >
          상세
          <IconChevronDown
            width={14}
            height={14}
            className={cn('transition-transform', detail && 'rotate-180')}
          />
        </button>
      </div>

      {/* 금액 */}
      <Card className="px-4 py-5 text-center">
        <p className="amount tnum text-[40px] font-bold leading-none tracking-tight">
          {raw === '' ? <span className="text-faint">0</span> : Number(raw).toLocaleString('ko-KR')}
          <span className="ml-1 text-[20px] font-semibold text-muted">원</span>
        </p>
        <p className="mt-1.5 h-4 text-[12px] text-faint">{amount >= 10000 ? shortWon(amount) : ''}</p>
      </Card>

      {detail ? (
        <Card className="space-y-2.5 p-3">
          <input
            className={inputClass}
            placeholder="가맹점 (선택) — 같은 곳은 카테고리가 자동 추론된다"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
          {merchants.length > 0 ? (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {merchants.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMerchant(m)}
                  className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-muted hover:text-fg"
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}
          <input
            className={inputClass}
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex gap-1.5">
            <Toggle on={isFixed} onClick={() => setIsFixed((v) => !v)} label="고정지출" />
            {db.settings.business_mode ? (
              <Toggle on={isBusiness} onClick={() => setIsBusiness((v) => !v)} label="사업" />
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* 숫자패드 */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="h-14 rounded-md bg-surface text-[19px] font-semibold active:bg-surface-2"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRaw((p) => p.slice(0, -1))}
          onDoubleClick={() => setRaw('')}
          aria-label="지우기"
          className="grid h-14 place-items-center rounded-md bg-surface text-muted active:bg-surface-2"
        >
          <IconBackspace width={20} height={20} />
        </button>
      </div>

      {/* 카테고리 — 누르면 바로 저장된다 */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <p className="text-[13px] font-semibold">
            {amount > 0 ? '카테고리를 누르면 저장된다' : '금액을 먼저 입력'}
          </p>
          {direction === 'out' ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-faint hover:text-muted"
            >
              {showAll ? '자주 쓰는 것만' : '전체 보기'}
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={amount <= 0}
              onClick={() => void save(c.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border bg-surface px-1 py-2.5 transition-colors active:bg-surface-2 disabled:opacity-40',
                guessed === c.id ? 'border-accent/60' : 'border-line',
              )}
            >
              <span className="text-[20px] leading-none">{c.icon}</span>
              <span className="line-clamp-1 text-[11px] font-medium text-muted">{c.name}</span>
            </button>
          ))}
        </div>
        {guessed ? (
          <p className="mt-1.5 px-1 text-[11px] text-accent">
            {merchant} → 지난번과 같은 카테고리를 테두리로 표시했다
          </p>
        ) : null}
      </div>

      {/* 저장 토스트 */}
      {saved ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-screen-sm px-3">
          <div className="flex items-center gap-2 rounded-lg border border-good/35 bg-good/[0.12] px-3.5 py-3 animate-slide-up">
            <IconCheck width={17} height={17} className="text-good" />
            <p className="flex-1 text-[13px] font-medium">
              {saved.name} <Amount value={saved.amount} /> 저장
            </p>
            <Button variant="ghost" size="sm" onClick={() => router.push('/spending')}>
              분석 보기
            </Button>
            <button type="button" onClick={() => setSaved(null)} aria-label="닫기" className="text-faint">
              <IconX width={16} height={16} />
            </button>
          </div>
        </div>
      ) : null}

      <RecentList />
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
        on ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-faint',
      )}
    >
      {label}
    </button>
  )
}

function RecentList() {
  const db = useStore((s) => s.db)
  const drop = useStore((s) => s.drop)
  const refresh = useStore((s) => s.refreshAgent)
  const recent = [...db.transactions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)
  if (recent.length === 0) return null
  const map = Object.fromEntries(db.categories.map((c) => [c.id, c]))

  return (
    <Card className="divide-y divide-line">
      <p className="px-4 pt-3 text-[13px] font-semibold">방금 넣은 것</p>
      {recent.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5">
          <span className="text-[17px]">{map[t.category_id ?? '']?.icon ?? '❓'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">
              {t.merchant || map[t.category_id ?? '']?.name || '분류 안 됨'}
            </p>
            <p className="text-[11px] text-faint">
              {t.date.slice(5).replace('-', '/')}
              {t.is_fixed ? ' · 고정' : ''}
              {t.is_business ? ' · 사업' : ''}
            </p>
          </div>
          <Amount
            value={t.amount}
            className={cn('text-[13px]', t.direction === 'in' && 'text-good')}
            short
          />
          <button
            type="button"
            onClick={async () => {
              await drop('transactions', t.id)
              await refresh()
            }}
            aria-label="삭제"
            className="text-faint hover:text-danger"
          >
            <IconX width={15} height={15} />
          </button>
        </div>
      ))}
      {db.transactions.length > 6 ? (
        <p className="px-4 py-2 text-[11px] text-faint">
          전체 {db.transactions.length}건 · 지출 분석 화면에서 모두 볼 수 있다
        </p>
      ) : null}
    </Card>
  )
}
