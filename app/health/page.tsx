'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { IconChevronDown } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead } from '@/components/ui/card'
import { Pill, Progress } from '@/components/ui/bits'
import { thisMonth } from '@/lib/date'
import { pct } from '@/lib/format'
import { healthScore } from '@/lib/finance/score'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const LINKS: Record<string, { href: string; label: string }> = {
  saving: { href: '/cashflow', label: '현금흐름 보기' },
  emergency: { href: '/assets', label: '자산 보기' },
  debt: { href: '/debts', label: '상환 시뮬레이터' },
  budget: { href: '/budget', label: '예산 보기' },
  waste: { href: '/spending', label: '지출 분석' },
  logging: { href: '/add', label: '지출 입력' },
}

export default function HealthPage() {
  const db = useStore((s) => s.db)
  const score = useMemo(() => healthScore(db, thisMonth()), [db])
  const [open, setOpen] = useState<string | null>(
    [...score.parts].sort((a, b) => a.score / a.max - b.score / b.max)[0]?.key ?? null,
  )

  const tone = score.total >= 65 ? 'good' : score.total >= 50 ? 'warn' : 'danger'

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardBody>
          <p className="text-[12px] font-medium text-muted">재정 건강 점수</p>
          {score.insufficient ? (
            <p className="mt-2 rounded-md bg-surface-2 p-2.5 text-[12px] leading-relaxed text-muted">
              거래가 {db.transactions.length}건뿐이라 아직 점수를 내놓지 않는다. 기록이 없으면
              &quot;부채 없음 = 만점&quot; 같은 항목만 점수를 올려 실제보다 좋게 나온다.
              아래 항목별 계산은 지금 데이터 기준이며, 5건이 쌓이면 총점이 붙는다.
            </p>
          ) : null}
          <div className="mt-1 flex items-end gap-2">
            <span
              className={cn(
                'tnum text-[40px] font-bold leading-none tracking-tight',
                score.insufficient && 'text-faint',
              )}
            >
              {score.insufficient ? '—' : score.total}
              <span className="ml-0.5 text-[18px] font-semibold text-faint">/100</span>
            </span>
            <Pill className="mb-1.5" tone={score.insufficient ? 'muted' : tone}>
              {score.insufficient ? '계산 전' : score.grade}
            </Pill>
          </div>
          <Progress className="mt-3" value={score.insufficient ? 0 : score.total} tone={tone} />
          <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
            점수만 보여 주면 아무 의미가 없다. 아래 여섯 항목이 각각 몇 점인지, 왜 그 점수인지,
            올리려면 뭘 해야 하는지까지 펼쳐 볼 수 있다.
          </p>
        </CardBody>
      </Card>

      {/* 배점 한눈에 */}
      <Card>
        <CardHead title="배점" sub="낮은 항목부터 손대는 게 가장 빠르다" />
        <CardBody className="space-y-2 pt-2">
          {[...score.parts]
            .sort((a, b) => a.score / a.max - b.score / b.max)
            .map((p) => (
              <div key={p.key} className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 text-[12px] text-muted">{p.label}</span>
                <Progress
                  className="flex-1"
                  value={(p.score / p.max) * 100}
                  tone={p.score / p.max >= 0.7 ? 'good' : p.score / p.max >= 0.4 ? 'warn' : 'danger'}
                />
                <span className="tnum w-14 text-right text-[12px] font-medium">
                  {p.score.toFixed(0)}/{p.max}
                </span>
              </div>
            ))}
        </CardBody>
      </Card>

      {/* 항목별 근거 */}
      <div className="space-y-2">
        {score.parts.map((p) => {
          const ratio = p.score / p.max
          const isOpen = open === p.key
          return (
            <Card key={p.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : p.key)}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                    ratio >= 0.7
                      ? 'bg-good/15 text-good'
                      : ratio >= 0.4
                        ? 'bg-warn/15 text-warn'
                        : 'bg-danger/15 text-danger',
                  )}
                >
                  {p.score.toFixed(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">
                    {p.label}
                    <span className="ml-1.5 text-[11px] font-normal text-faint">{p.max}점 만점</span>
                  </span>
                  <span className="block truncate text-[12px] text-muted">{p.detail}</span>
                </span>
                <IconChevronDown
                  width={16}
                  height={16}
                  className={cn('shrink-0 text-faint transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen ? (
                <CardBody className="border-t border-line pt-3">
                  <p className="text-[13px] leading-relaxed">{p.advice}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">{SCORING[p.key]}</p>
                  {LINKS[p.key] ? (
                    <Link href={LINKS[p.key].href} className="mt-2.5 inline-block">
                      <Button size="sm" variant="outline">
                        {LINKS[p.key].label}
                      </Button>
                    </Link>
                  ) : null}
                </CardBody>
              ) : null}
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHead title="등급" sub="점수 구간" />
        <CardBody className="pt-2">
          <div className="overflow-hidden rounded-md border border-line">
            <table className="w-full text-[12px]">
              <tbody>
                {[
                  ['0~34', '위험', 'danger'],
                  ['35~49', '주의', 'danger'],
                  ['50~64', '보통', 'warn'],
                  ['65~79', '양호', 'good'],
                  ['80~100', '우수', 'good'],
                ].map(([range, label, t]) => (
                  <tr
                    key={range}
                    className={cn('border-t border-line first:border-0', score.grade === label && 'bg-surface-2')}
                  >
                    <td className="tnum px-2 py-1.5 text-faint">{range}</td>
                    <td className="px-2 py-1.5">
                      <Pill tone={t as 'danger' | 'warn' | 'good'}>{label}</Pill>
                    </td>
                    <td className="px-2 py-1.5 text-right text-faint">
                      {score.grade === label ? '지금 여기' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            점수는 매일 다시 계산된다. 기록이 빠지면 나머지 항목의 정확도도 같이 떨어지므로,
            기록 성실도에 10점을 배정해 뒀다. {pct((score.parts.find((p) => p.key === 'logging')?.score ?? 0) * 10, 0)}{' '}
            채워져 있다.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

const SCORING: Record<string, string> = {
  saving: '최근 3개월 (수입 − 지출) / 수입. 30% 저축이면 만점, 0%면 0점.',
  emergency: '현금성 자산 ÷ 월 평균 지출. 6개월분이면 만점, 0이면 0점. 투자·부동산은 현금성에서 뺀다.',
  debt: '월 최소 상환액 ÷ 월 수입(DSR). 0%면 만점, 40% 이상이면 0점.',
  budget: '예산을 넘기지 않은 카테고리 비율. 예산이 없으면 안전 예산 기준으로 절반만 준다.',
  waste: '낭비 등급 지출 ÷ 전체 지출. 0%면 만점, 15% 이상이면 0점.',
  logging: '최근 7일 중 거래를 입력한 날 수 ÷ 7.',
}
