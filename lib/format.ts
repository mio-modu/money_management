// 금액 표기 규칙: 천단위 콤마를 기본으로, 큰 숫자는 만/억 축약을 병행한다.
// 숫자를 크게 보여주는 화면에서는 축약이 먼저 읽히고, 상세에서는 콤마가 정확하다.

export function won(n: number): string {
  const r = Math.round(n)
  return r.toLocaleString('ko-KR')
}

/** 1,250,000 → "125만" · 123,450,000 → "1억 2,345만" · 8,500 → "8,500" */
export function shortWon(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(Math.round(n))
  if (a < 10_000) return sign + a.toLocaleString('ko-KR')
  if (a < 100_000_000) {
    const man = a / 10_000
    const body = man >= 100 ? Math.round(man).toLocaleString('ko-KR') : trim1(man)
    return `${sign}${body}만`
  }
  const eok = Math.floor(a / 100_000_000)
  const man = Math.round((a % 100_000_000) / 10_000)
  return man > 0 ? `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만` : `${sign}${eok}억`
}

function trim1(n: number): string {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/** 상세 화면용. "1,250,000원 (125만)" */
export function wonBoth(n: number): string {
  const a = Math.abs(n)
  if (a < 10_000) return `${won(n)}원`
  return `${won(n)}원 (${shortWon(n)})`
}

export function signedWon(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + won(Math.abs(n))
}

export function signedShortWon(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + shortWon(Math.abs(n))
}

export function pct(n: number, digits = 0): string {
  if (!isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function ratioPct(part: number, whole: number, digits = 0): string {
  if (!whole) return '—'
  return pct((part / whole) * 100, digits)
}
