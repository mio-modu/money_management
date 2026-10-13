import { thisMonth } from '../date'
import { pct, shortWon, won } from '../format'
import type { Alert, DB, Severity } from '../types'
import { gradeMix, loggingDays, monthFlow, noSpendStreak } from '../finance/selectors'
import { RULES, type Finding, type RuleContext } from './rules'

const WARN: Severity[] = ['warn', 'danger']

/** 규칙을 전부 돌려 Finding 을 모은다. 꺼진 규칙은 건너뛴다. */
export function runRules(db: DB, now = new Date()): Finding[] {
  const month = thisMonth()
  const out: Finding[] = []

  for (const rule of RULES) {
    const cfg = db.rules.find((r) => r.code === rule.code)
    if (cfg && !cfg.enabled) continue
    const ctx: RuleContext = {
      db,
      month,
      now,
      p: (key) => cfg?.params?.[key] ?? rule.defaults[key] ?? 0,
    }
    try {
      out.push(...rule.evaluate(ctx))
    } catch {
      // 한 규칙이 터져도 나머지는 돌아야 한다.
    }
  }
  return out
}

function toAlert(finding: Finding, now: Date): Alert {
  return {
    id: `a-${finding.key}`,
    type: finding.key.split(':')[0],
    severity: finding.severity,
    title: finding.title,
    message: finding.message,
    action_label: finding.action_label,
    action_href: finding.action_href,
    weight: finding.weight,
    action_taken: false,
    dismissed_at: null,
    created_at: now.toISOString(),
  }
}

/**
 * 규칙 평가 결과를 기존 알림과 합친다.
 * key 가 같으면 같은 상황이므로 새로 쌓지 않는다 — 같은 경고가 매일 늘어나면 읽지 않게 된다.
 */
export function mergeAlerts(db: DB, now = new Date()): { alerts: Alert[]; added: Alert[] } {
  const findings = runRules(db, now)
  const existing = new Map(db.alerts.map((a) => [a.id, a]))
  const added: Alert[] = []

  for (const finding of findings) {
    const alert = toAlert(finding, now)
    if (!existing.has(alert.id)) {
      existing.set(alert.id, alert)
      added.push(alert)
    } else {
      // 숫자는 바뀔 수 있으니 본문만 갱신하고 처리 여부는 유지한다.
      const prev = existing.get(alert.id)!
      existing.set(alert.id, { ...alert, action_taken: prev.action_taken, dismissed_at: prev.dismissed_at, created_at: prev.created_at })
    }
  }

  const liveKeys = new Set(findings.map((x) => `a-${x.key}`))
  const alerts = [...existing.values()]
    // 해결된 상황은 조용히 치운다. 손댄 기록은 남긴다.
    .filter((a) => liveKeys.has(a.id) || a.action_taken)
    .sort((a, b) => b.weight - a.weight || b.created_at.localeCompare(a.created_at))

  return { alerts, added }
}

export interface Briefing {
  /** 경고 1 · 제안 1 · 칭찬 1 — 한 화면에 3장을 넘기지 않는다 */
  warning: Alert | null
  suggestion: Alert | null
  praise: Alert | null
}

export function briefing(db: DB, now = new Date()): Briefing {
  const live = db.alerts.filter((a) => !a.dismissed_at)
  const pick = (fn: (a: Alert) => boolean) =>
    live.filter(fn).sort((a, b) => b.weight - a.weight)[0] ?? null

  return {
    warning: pick((a) => WARN.includes(a.severity)),
    suggestion: pick((a) => a.severity === 'info'),
    praise: pick((a) => a.severity === 'praise') ?? fallbackPraise(db, now),
  }
}

/**
 * 칭찬할 거리가 하나도 없는 날이 있다. 그래도 빈 칸으로 두지 않는다 —
 * 경고만 쌓이는 화면은 결국 안 열게 된다.
 */
export function fallbackPraise(db: DB, now = new Date()): Alert | null {
  const days = loggingDays(db, 7, now)
  const month = thisMonth()
  const mix = gradeMix(db, month)
  const total = mix.need + mix.want + mix.waste
  const base: Omit<Alert, 'id' | 'title' | 'message' | 'action_label' | 'action_href'> = {
    type: 'PRAISE_FALLBACK',
    severity: 'praise',
    weight: 10,
    action_taken: false,
    dismissed_at: null,
    created_at: now.toISOString(),
  }

  const streak = noSpendStreak(db, now)
  if (streak >= 1) {
    return {
      ...base,
      id: 'a-fallback-streak',
      title: `어제는 한 푼도 안 썼다`,
      message: `무지출 ${streak}일째. 작아 보여도 한 달에 ${won((mix.want + mix.waste) / 30)}원을 아끼는 습관이다.`,
      action_label: '오늘 입력하기',
      action_href: '/add',
    }
  }
  if (days >= 5) {
    return {
      ...base,
      id: 'a-fallback-logging',
      title: `최근 7일 중 ${days}일 기록했다`,
      message: `기록이 끊기지 않으면 판정이 정확해진다. 이 앱의 모든 경고는 이 입력 위에 서 있다.`,
      action_label: '점수 보기',
      action_href: '/health',
    }
  }
  if (total > 0 && mix.waste / total < 0.05) {
    return {
      ...base,
      id: 'a-fallback-waste',
      title: `낭비 등급이 전체의 ${pct((mix.waste / total) * 100, 1)}`,
      message: `이번 달 지출 ${shortWon(total)}원 중 낭비로 분류된 건 ${shortWon(mix.waste)}원뿐이다.`,
      action_label: '지출 분석',
      action_href: '/spending',
    }
  }
  const flow = monthFlow(db, month)
  if (flow.net > 0) {
    return {
      ...base,
      id: 'a-fallback-net',
      title: `이번 달 ${shortWon(flow.net)}원 남았다`,
      message: `수입 ${won(flow.income)}원, 지출 ${won(flow.expense)}원. 아직 플러스다.`,
      action_label: '현금흐름 보기',
      action_href: '/cashflow',
    }
  }
  return {
    ...base,
    id: 'a-fallback-start',
    title: `시작은 한 건이면 된다`,
    message: `오늘 쓴 돈 하나만 넣어 보자. 3초면 끝나고, 그 순간부터 판정이 돌기 시작한다.`,
    action_label: '지출 입력',
    action_href: '/add',
  }
}

/**
 * 알림 목록에 띄울 순서.
 * 칭찬:경고 비율을 1:2 이상으로 유지한다 — 경고 2개마다 칭찬이 최소 1개는 끼게 섞는다.
 */
export function balancedFeed(alerts: Alert[], limit = 12): Alert[] {
  const live = alerts.filter((a) => !a.dismissed_at)
  const warns = live.filter((a) => WARN.includes(a.severity)).sort((a, b) => b.weight - a.weight)
  const infos = live.filter((a) => a.severity === 'info').sort((a, b) => b.weight - a.weight)
  const praises = live.filter((a) => a.severity === 'praise').sort((a, b) => b.weight - a.weight)

  const out: Alert[] = []
  let w = 0
  let i = 0
  let p = 0
  while (out.length < limit && (w < warns.length || i < infos.length || p < praises.length)) {
    if (w < warns.length) out.push(warns[w++])
    if (w < warns.length) out.push(warns[w++])
    if (p < praises.length) out.push(praises[p++])
    else if (i < infos.length) out.push(infos[i++])
    if (i < infos.length) out.push(infos[i++])
  }
  return out.slice(0, limit)
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  danger: '위험',
  warn: '경고',
  info: '제안',
  praise: '칭찬',
}
