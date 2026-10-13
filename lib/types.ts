// 도메인 타입. Supabase 테이블과 1:1 로 맞춘다 (snake_case 컬럼 ↔ 아래 필드명).

export type AccountType = 'checking' | 'savings' | 'card' | 'cash' | 'invest' | 'loan'
export type Direction = 'in' | 'out'
/** 카테고리 등급 — 낭비 비중을 추적하는 축이다. */
export type Grade = 'need' | 'want' | 'waste'
export type SubStatus = 'active' | 'zombie' | 'cancelled'
export type SubCycle = 'monthly' | 'yearly' | 'weekly'
export type AssetKind = 'cash' | 'invest' | 'realestate' | 'other'
export type Severity = 'info' | 'warn' | 'danger' | 'praise'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  is_business: boolean
  interest_rate: number | null
  due_day: number | null
  archived?: boolean
}

export interface Category {
  id: string
  name: string
  parent_id: string | null
  grade: Grade
  icon: string
  direction: Direction
  /** 주거비·통신비처럼 매달 같은 금액이 나가는 축 */
  default_fixed?: boolean
  sort?: number
}

export interface Transaction {
  id: string
  account_id: string | null
  /** yyyy-MM-dd */
  date: string
  /** 항상 양수. 방향은 direction 이 가진다. */
  amount: number
  direction: Direction
  category_id: string | null
  merchant: string | null
  memo: string | null
  is_business: boolean
  is_fixed: boolean
  tags: string[]
  /** 심야 결제 패턴 탐지용. 0~23, 모르면 null */
  hour: number | null
  created_at: string
}

export interface Budget {
  id: string
  category_id: string
  /** yyyy-MM */
  month: string
  planned: number
  carryover_enabled: boolean
}

export interface Subscription {
  id: string
  name: string
  amount: number
  cycle: SubCycle
  /** yyyy-MM-dd */
  next_charge_at: string
  last_used_at: string | null
  /** 1~5. 낮을수록 먼저 해지 후보 */
  value_rating: number
  status: SubStatus
  category_id: string | null
  /** 금액 인상 추적용 이력 */
  price_history?: { date: string; amount: number }[]
}

export interface Asset {
  id: string
  name: string
  kind: AssetKind
  value: number
  /** yyyy-MM-dd */
  valued_at: string
}

export interface Debt {
  id: string
  name: string
  principal: number
  balance: number
  /** 연이자율 % */
  interest_rate: number
  min_payment: number
  /** yyyy-MM-dd */
  maturity: string | null
}

export interface Goal {
  id: string
  name: string
  target_amount: number
  /** yyyy-MM-dd */
  deadline: string
  current_amount: number
  priority: number
}

export interface TaxReserve {
  id: string
  /** yyyy-MM */
  month: string
  /** 그 달 사업 수입 */
  business_income: number
  /** 적립해야 할 금액 (부가세 + 종소세 예상) */
  required: number
  /** 실제로 떼어 둔 금액 */
  reserved: number
}

export interface Receivable {
  id: string
  client: string
  amount: number
  /** yyyy-MM-dd */
  due_at: string
  paid_at: string | null
  memo: string | null
}

export interface Alert {
  id: string
  type: string
  severity: Severity
  title: string
  message: string
  /** 그래서 뭘 해야 하는지 — 한 문장 */
  action_label: string | null
  action_href: string | null
  /** 우선순위 정렬용. 클수록 먼저 */
  weight: number
  action_taken: boolean
  dismissed_at: string | null
  created_at: string
}

export interface Rule {
  id: string
  /** 규칙 엔진의 규칙 코드 (ZOMBIE_SUB 등) */
  code: string
  enabled: boolean
  /** 규칙마다 다른 임계값. 예: { days: 60 } */
  params: Record<string, number>
}

export interface RoutineLog {
  id: string
  /** daily | weekly | monthly | quarterly | yearly */
  kind: string
  item: string
  /** yyyy-MM-dd — 해당 주기의 시작일 */
  period: string
  done_at: string
}

export interface Settings {
  /** 종합소득세 예상률 % (기본 15) */
  income_tax_rate: number
  /** 부가세율 % (기본 10) */
  vat_rate: number
  /** 사업자 모드 on/off */
  business_mode: boolean
  /** 앱 잠금 PIN (해시 아님 — 로컬 전용 가벼운 잠금) */
  pin: string | null
  hide_amounts: boolean
  theme: 'dark' | 'light'
  /** 고정 급여가 아니라 프리랜서 불규칙 수입인가 */
  irregular_income: boolean
  onboarded: boolean
}

export interface DB {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  subscriptions: Subscription[]
  assets: Asset[]
  debts: Debt[]
  goals: Goal[]
  tax_reserve: TaxReserve[]
  receivables: Receivable[]
  alerts: Alert[]
  rules: Rule[]
  routine_logs: RoutineLog[]
  settings: Settings
}

export type TableName = Exclude<keyof DB, 'settings'>
