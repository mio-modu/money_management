/**
 * 더미 데이터 생성 스크립트.
 *
 *   npm run seed            — 규칙 엔진이 무엇을 잡아내는지 콘솔로 확인
 *   npm run seed -- --json  — 앱 "설정 → 데이터 → 가져오기"에 넣을 JSON 파일 생성
 *   npm run seed -- --sql   — Supabase 에 바로 붓는 INSERT 문 생성 (USER_ID 치환 필요)
 *
 * 브라우저에서는 설정 화면의 [더미 데이터 생성] 버튼이 같은 데이터를 만든다.
 */
import { writeFileSync } from 'node:fs'
import { demoDB } from '../lib/demo'
import { runRules } from '../lib/agent/engine'
import { healthScore } from '../lib/finance/score'
import { netWorth, spendable } from '../lib/finance/selectors'
import { won } from '../lib/format'
import { RULES } from '../lib/agent/rules'
import { EMPTY_TABLES } from '../lib/data/adapter'
import type { TableName } from '../lib/types'

const db = demoDB()
const args = process.argv.slice(2)

const findings = runRules(db)
const score = healthScore(db)
const sp = spendable(db)

console.log('\n── 더미 데이터 ─────────────────────────────')
console.log(`거래 ${db.transactions.length}건 · 구독 ${db.subscriptions.length}개 · 부채 ${db.debts.length}건`)
console.log(`순자산 ${won(netWorth(db))}원 · 남은 돈 ${won(sp.remain)}원 · 건강점수 ${score.total}/100 (${score.grade})`)

console.log('\n── 규칙 엔진이 잡아낸 것 ───────────────────')
const fired = new Set(findings.map((f) => f.key.split(':')[0]))
for (const f of findings.sort((a, b) => b.weight - a.weight)) {
  console.log(`[${f.severity.toUpperCase().padEnd(6)}] ${f.title}\n          ${f.message}\n          → ${f.action}`)
}

const silent = RULES.filter((r) => !fired.has(r.code)).map((r) => r.code)
console.log(`\n발동 ${fired.size}/${RULES.length}종${silent.length ? ` · 조용한 규칙: ${silent.join(', ')}` : ''}`)

console.log('\n── 건강 점수 근거 ──────────────────────────')
for (const p of score.parts) {
  console.log(`${p.label.padEnd(8)} ${p.score.toFixed(1).padStart(5)}/${p.max}  ${p.detail}`)
}

if (args.includes('--json')) {
  const out = 'moneyguard-demo.json'
  writeFileSync(out, JSON.stringify(db, null, 2))
  console.log(`\n${out} 생성 — 앱 설정 화면에서 가져오면 된다.`)
}

if (args.includes('--sql')) {
  const out = 'moneyguard-demo.sql'
  writeFileSync(out, toSql(db))
  console.log(`\n${out} 생성 — 파일 맨 위의 :user_id 를 본인 auth.users.id 로 바꿔 실행한다.`)
}

function toSql(data: ReturnType<typeof demoDB>) {
  const tables = Object.keys(EMPTY_TABLES) as TableName[]
  const lines: string[] = [
    '-- 생성: npm run seed -- --sql',
    "-- 아래 user_id 를 본인 계정의 auth.users.id 로 바꾼 뒤 실행한다.",
    "\\set user_id '00000000-0000-0000-0000-000000000000'\n",
  ]
  for (const t of tables) {
    const rows = data[t] as unknown as Record<string, unknown>[]
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    lines.push(`insert into public.${t} (user_id, ${cols.join(', ')}) values`)
    lines.push(
      rows
        .map((r) => `  (:'user_id', ${cols.map((c) => lit(r[c])).join(', ')})`)
        .join(',\n') + '\non conflict (user_id, id) do nothing;\n',
    )
  }
  lines.push(
    `insert into public.settings (user_id, data) values (:'user_id', ${lit(JSON.stringify(data.settings))}::jsonb)`,
    'on conflict (user_id) do update set data = excluded.data;',
  )
  return lines.join('\n')
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) {
    if (v.length === 0) return `'{}'`
    if (typeof v[0] === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
    return `'{${v.map((x) => `"${String(x)}"`).join(',')}}'`
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}
