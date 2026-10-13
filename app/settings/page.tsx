'use client'

import { useEffect, useRef, useState } from 'react'
import { IconBell, IconCheck, IconDownload, IconRefresh, IconTrash } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHead, Row } from '@/components/ui/card'
import { Field, Pill, inputClass } from '@/components/ui/bits'
import { blankDB } from '@/lib/data/local'
import { askNotifyPermission, notifyState } from '@/lib/notify'
import { demoDB } from '@/lib/demo'
import { RULES } from '@/lib/agent/rules'
import { useStore } from '@/lib/store'
import type { DB } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const db = useStore((s) => s.db)
  const mode = useStore((s) => s.mode)
  const setSettings = useStore((s) => s.setSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const patch = useStore((s) => s.patch)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState(db.settings.pin ?? '')
  const [notifyPerm, setNotifyPerm] = useState<string>('unsupported')

  useEffect(() => {
    setNotifyPerm(notifyState())
  }, [])
  const [note, setNote] = useState<string | null>(null)

  function flash(msg: string) {
    setNote(msg)
    setTimeout(() => setNote(null), 2400)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `moneyguard-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as DB
      if (!parsed.transactions || !parsed.categories) throw new Error('형식이 맞지 않는다')
      await replaceAll({ ...blankDB(), ...parsed })
      flash('가져왔다')
    } catch (e) {
      flash(e instanceof Error ? e.message : '가져오기 실패')
    }
  }

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="저장 위치"
          sub={
            mode === 'local'
              ? '이 기기 브라우저 안에만 저장된다. 서버로 아무것도 나가지 않는다.'
              : 'Supabase 에 저장된다. RLS 로 본인 행만 읽고 쓴다.'
          }
          right={<Pill tone={mode === 'local' ? 'muted' : 'accent'}>{mode === 'local' ? '로컬' : 'Supabase'}</Pill>}
        />
        <CardBody className="pt-2">
          <Row label="거래" value={`${db.transactions.length}건`} />
          <Row label="구독" value={`${db.subscriptions.length}개`} />
          <Row label="부채" value={`${db.debts.length}건`} />
          <Row label="알림" value={`${db.alerts.length}건`} />
        </CardBody>
      </Card>

      {/* ── 내 상황 ─────────────────────────────── */}
      <Card>
        <CardHead title="내 상황" sub="판정 기준이 여기서 갈린다" />
        <CardBody className="space-y-3 pt-2">
          <SwitchRow
            label="불규칙 수입 (프리랜서·사업)"
            desc="켜면 최근 6개월 수입 중앙값으로 안전 예산을 잡는다. 한 번의 큰 입금에 끌려가지 않는다."
            on={db.settings.irregular_income}
            onToggle={() => void setSettings({ irregular_income: !db.settings.irregular_income })}
          />
          <SwitchRow
            label="사업자 모드"
            desc="개인/사업 거래를 나누고, 사업 수입에서 세금 몫을 먼저 떼어 보여 준다."
            on={db.settings.business_mode}
            onToggle={() => void setSettings({ business_mode: !db.settings.business_mode })}
          />
          {db.settings.business_mode ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="부가세율 %">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass}
                  value={db.settings.vat_rate}
                  onChange={(e) => void setSettings({ vat_rate: Number(e.target.value) })}
                />
              </Field>
              <Field label="종합소득세 예상률 %" hint="소득 구간에 맞춰 조절">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass}
                  value={db.settings.income_tax_rate}
                  onChange={(e) => void setSettings({ income_tax_rate: Number(e.target.value) })}
                />
              </Field>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ── 화면·보안 ───────────────────────────── */}
      <Card>
        <CardHead title="화면과 잠금" sub="민감한 데이터다" />
        <CardBody className="space-y-3 pt-2">
          <SwitchRow
            label="금액 가리기"
            desc="켜면 모든 금액이 블러 처리된다. 상단 눈 아이콘으로도 바로 전환된다."
            on={db.settings.hide_amounts}
            onToggle={() => void setSettings({ hide_amounts: !db.settings.hide_amounts })}
          />
          <SwitchRow
            label="밝은 테마"
            desc="기본은 어두운 테마다."
            on={db.settings.theme === 'light'}
            onToggle={() => void setSettings({ theme: db.settings.theme === 'light' ? 'dark' : 'light' })}
          />
          <Field label="앱 잠금 PIN" hint="4~6자리. 비우면 잠금이 꺼진다. 이 기기 안에만 저장된다.">
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                className={inputClass}
                value={pin}
                placeholder="사용 안 함"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  await setSettings({ pin: pin.length >= 4 ? pin : null })
                  flash(pin.length >= 4 ? 'PIN 을 켰다' : 'PIN 을 껐다')
                }}
              >
                저장
              </Button>
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* ── 알림 ────────────────────────────────── */}
      <Card>
        <CardHead title="알림" sub="앱을 열었을 때 가장 급한 경고 하나만 띄운다" />
        <CardBody className="space-y-2 pt-2">
          <p className="text-[12px] leading-relaxed text-muted">
            권한 상태: <b className="text-fg">{NOTIFY_LABEL[notifyPerm] ?? notifyPerm}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={notifyPerm !== 'default'}
              onClick={async () => {
                const next = await askNotifyPermission()
                setNotifyPerm(next)
                flash(next === 'granted' ? '알림을 켰다' : '알림 권한이 없다')
              }}
            >
              <IconBell width={15} height={15} /> 알림 권한 요청
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            앱이 닫혀 있을 때 오는 진짜 푸시는 푸시 서버와 VAPID 키가 필요해서 아직 넣지 않았다.
            지금은 홈 화면에 설치한 앱을 열 때, 그리고 열어 둔 채 자정이 지날 때 규칙이 다시 돌고
            가장 급한 경고 하나를 알린다. 같은 경고는 두 번 띄우지 않는다.
          </p>
        </CardBody>
      </Card>

      {/* ── 규칙 ────────────────────────────────── */}
      <Card>
        <CardHead title="규칙 엔진" sub="끈 규칙은 평가하지 않는다. 임계값도 바꿀 수 있다." />
        <CardBody className="space-y-1 pt-2">
          {(['누수', '위험', '강화'] as const).map((group) => (
            <div key={group} className="pt-1.5">
              <p className="mb-1 text-[11px] font-semibold uppercase text-faint">{group}</p>
              {RULES.filter((r) => r.group === group).map((rule) => {
                const cfg = db.rules.find((r) => r.code === rule.code)
                const keys = Object.keys(rule.defaults)
                return (
                  <div key={rule.code} className="border-b border-line py-2 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{rule.label}</p>
                        <p className="text-[11px] leading-snug text-faint">{rule.about}</p>
                      </div>
                      <Switch
                        on={cfg?.enabled ?? true}
                        onToggle={() => {
                          if (cfg) void patch('rules', cfg.id, { enabled: !cfg.enabled })
                        }}
                      />
                    </div>
                    {keys.length > 0 && (cfg?.enabled ?? true) ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {keys.map((k) => (
                          <label key={k} className="flex items-center gap-1 text-[11px] text-faint">
                            {PARAM_LABEL[k] ?? k}
                            <input
                              type="number"
                              className="w-20 rounded-[7px] border border-line bg-surface-2 px-1.5 py-1 text-[12px] text-fg"
                              value={cfg?.params?.[k] ?? rule.defaults[k]}
                              onChange={(e) => {
                                if (!cfg) return
                                void patch('rules', cfg.id, {
                                  params: { ...cfg.params, [k]: Number(e.target.value) },
                                })
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </CardBody>
      </Card>

      {/* ── 데이터 ──────────────────────────────── */}
      <Card>
        <CardHead title="데이터" sub="더미 데이터로 화면을 먼저 볼 수 있다" />
        <CardBody className="space-y-2 pt-2">
          <p className="text-[12px] leading-relaxed text-muted">
            더미 데이터에는 좀비 구독·가격 인상·심야 결제·고금리 부채·세금 미적립을 일부러 심어 뒀다.
            규칙 15종이 실제로 무엇을 잡아내는지 바로 볼 수 있다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                await replaceAll(demoDB())
                flash('6개월치 더미 데이터를 넣었다')
              }}
            >
              <IconRefresh width={16} height={16} /> 더미 데이터 생성
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <IconDownload width={16} height={16} /> 내보내기
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              가져오기
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importJson(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm('모든 기록을 지운다. 되돌릴 수 없다. 계속할까?')) return
                await replaceAll(blankDB())
                flash('전부 지웠다')
              }}
            >
              <IconTrash width={16} height={16} /> 전체 삭제
            </Button>
          </div>
        </CardBody>
      </Card>

      {note ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-screen-sm px-3">
          <div className="flex items-center gap-2 rounded-lg border border-accent/35 bg-accent/[0.12] px-3.5 py-3 animate-slide-up">
            <IconCheck width={17} height={17} className="text-accent" />
            <p className="text-[13px] font-medium">{note}</p>
          </div>
        </div>
      ) : null}

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-faint">
        머니가드는 관리 도구다. 투자 종목 추천이나 수익률 예측은 넣지 않는다.
        세금 계산은 예상액이며 실제 신고액과 다를 수 있다. 신고는 세무 전문가와 확인해라.
      </p>
    </div>
  )
}

const NOTIFY_LABEL: Record<string, string> = {
  granted: '허용됨',
  denied: '차단됨 — 브라우저 설정에서 풀어야 한다',
  default: '아직 묻지 않음',
  unsupported: '이 브라우저는 알림을 지원하지 않는다',
}

const PARAM_LABEL: Record<string, string> = {
  days: '일수',
  min_pct: '최소 인상률 %',
  count: '건수',
  amount: '기준 금액',
  pct: '기준 %',
  gap_pp: '격차 %p',
  months: '개월',
  rate: '이자율 %',
  tolerance_pct: '적립률 %',
  min: '최소',
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-surface-2',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function SwitchRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] leading-snug text-faint">{desc}</p>
      </div>
      <Switch on={on} onToggle={onToggle} />
    </div>
  )
}
