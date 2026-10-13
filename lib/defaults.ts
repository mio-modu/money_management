import type { Category, Rule, Settings } from './types'

/**
 * 기본 카테고리. 대분류(parent_id=null) → 소분류 2단계.
 * grade 가 핵심이다 — 필수/선택/낭비 비율을 매월 추적하는 축이 여기서 나온다.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // ── 지출 대분류 ────────────────────────────────────────
  cat('housing', '주거·통신', null, 'need', '🏠', 1),
  cat('housing-rent', '월세·관리비', 'housing', 'need', '🏠', 1, true),
  cat('housing-util', '전기·가스·수도', 'housing', 'need', '💡', 2, true),
  cat('housing-comm', '통신비', 'housing', 'need', '📱', 3, true),

  cat('food', '식비', null, 'need', '🍚', 2),
  cat('food-grocery', '장보기', 'food', 'need', '🛒', 1),
  cat('food-dining', '외식', 'food', 'want', '🍽️', 2),
  cat('food-delivery', '배달', 'food', 'want', '🛵', 3),
  cat('food-cafe', '카페·간식', 'food', 'want', '☕', 4),

  cat('transport', '교통', null, 'need', '🚌', 3),
  cat('transport-public', '대중교통', 'transport', 'need', '🚇', 1),
  cat('transport-taxi', '택시', 'transport', 'want', '🚕', 2),
  cat('transport-car', '주유·주차', 'transport', 'need', '⛽', 3),

  cat('health', '의료·건강', null, 'need', '💊', 4),
  cat('health-clinic', '병원·약', 'health', 'need', '🏥', 1),
  cat('health-fitness', '운동·건강관리', 'health', 'need', '🏋️', 2),

  cat('living', '생활', null, 'need', '🧺', 5),
  cat('living-goods', '생활용품', 'living', 'need', '🧼', 1),
  cat('living-beauty', '미용·이발', 'living', 'want', '✂️', 2),
  cat('living-pet', '반려동물', 'living', 'need', '🐾', 3),

  cat('shopping', '쇼핑', null, 'want', '🛍️', 6),
  cat('shopping-clothes', '의류·잡화', 'shopping', 'want', '👕', 1),
  cat('shopping-digital', '전자기기', 'shopping', 'want', '💻', 2),
  cat('shopping-impulse', '충동구매', 'shopping', 'waste', '😵', 3),

  cat('leisure', '문화·여가', null, 'want', '🎬', 7),
  cat('leisure-sub', '구독서비스', 'leisure', 'want', '📺', 1, true),
  cat('leisure-travel', '여행', 'leisure', 'want', '✈️', 2),
  cat('leisure-hobby', '취미', 'leisure', 'want', '🎸', 3),
  cat('leisure-drink', '술·유흥', 'leisure', 'waste', '🍻', 4),

  cat('finance', '금융·세금', null, 'need', '🏦', 8),
  cat('finance-insurance', '보험', 'finance', 'need', '🛡️', 1, true),
  cat('finance-interest', '대출이자', 'finance', 'need', '📉', 2, true),
  cat('finance-tax', '세금', 'finance', 'need', '🧾', 3),
  cat('finance-fee', '수수료·지연이자', 'finance', 'waste', '⚠️', 4),

  cat('edu', '교육', null, 'need', '📚', 9),
  cat('edu-course', '강의·도서', 'edu', 'need', '📖', 1),

  cat('biz', '사업비용', null, 'need', '💼', 10),
  cat('biz-outsource', '외주비', 'biz', 'need', '🤝', 1),
  cat('biz-ads', '광고비', 'biz', 'need', '📣', 2),
  cat('biz-tool', '업무 도구·구독', 'biz', 'need', '🧰', 3, true),
  cat('biz-etc', '기타 사업비', 'biz', 'need', '📎', 4),

  cat('etc', '기타', null, 'want', '🔖', 11),
  cat('etc-gift', '경조사·선물', 'etc', 'need', '🎁', 1),
  cat('etc-smoke', '담배', 'etc', 'waste', '🚬', 2),
  cat('etc-lottery', '복권·도박', 'etc', 'waste', '🎰', 3),
  cat('etc-unknown', '분류 안 됨', 'etc', 'want', '❓', 9),

  // ── 수입 ──────────────────────────────────────────────
  inc('in-salary', '급여', '💰', 1),
  inc('in-biz', '사업수입', '💼', 2),
  inc('in-side', '부수입', '🧩', 3),
  inc('in-interest', '이자·배당', '📈', 4),
  inc('in-etc', '환급·기타', '↩️', 5),
]

function cat(
  id: string,
  name: string,
  parent: string | null,
  grade: Category['grade'],
  icon: string,
  sort: number,
  fixed = false,
): Category {
  return {
    id: `c-${id}`,
    name,
    parent_id: parent ? `c-${parent}` : null,
    grade,
    icon,
    direction: 'out',
    default_fixed: fixed,
    sort,
  }
}

function inc(id: string, name: string, icon: string, sort: number): Category {
  return {
    id: `c-${id}`,
    name,
    parent_id: null,
    grade: 'need',
    icon,
    direction: 'in',
    sort,
  }
}

/** 빠른 입력 첫 화면에 띄울 소분류 — 실제로 자주 쓰는 것만. */
export const QUICK_CATEGORY_IDS = [
  'c-food-grocery',
  'c-food-dining',
  'c-food-delivery',
  'c-food-cafe',
  'c-transport-public',
  'c-transport-taxi',
  'c-living-goods',
  'c-shopping-clothes',
  'c-health-clinic',
  'c-leisure-hobby',
  'c-etc-gift',
  'c-leisure-sub',
]

/** 규칙 엔진 기본값. params 는 설정에서 조절할 수 있다. */
export const DEFAULT_RULES: Rule[] = [
  { id: 'r-zombie', code: 'ZOMBIE_SUB', enabled: true, params: { days: 60 } },
  { id: 'r-creep', code: 'PRICE_CREEP', enabled: true, params: { min_pct: 5 } },
  { id: 'r-dup', code: 'DUPLICATE_SERVICE', enabled: true, params: { count: 2 } },
  { id: 'r-leak', code: 'SMALL_LEAK', enabled: true, params: { amount: 10000, count: 15 } },
  { id: 'r-impulse', code: 'IMPULSE_PATTERN', enabled: true, params: { count: 3 } },
  { id: 'r-spike', code: 'CATEGORY_SPIKE', enabled: true, params: { pct: 150 } },
  { id: 'r-pace', code: 'BUDGET_PACE', enabled: true, params: { gap_pp: 20 } },
  { id: 'r-fixed', code: 'FIXED_RATIO_HIGH', enabled: true, params: { pct: 50 } },
  { id: 'r-emerg', code: 'EMERGENCY_FUND_LOW', enabled: true, params: { months: 3 } },
  { id: 'r-hidebt', code: 'HIGH_INTEREST_DEBT', enabled: true, params: { rate: 15 } },
  { id: 'r-tax', code: 'TAX_UNRESERVED', enabled: true, params: { tolerance_pct: 90 } },
  { id: 'r-incdrop', code: 'INCOME_DROP', enabled: true, params: { pct: 30 } },
  { id: 'r-streak', code: 'STREAK', enabled: true, params: { min: 2 } },
  { id: 'r-under', code: 'UNDER_BUDGET', enabled: true, params: {} },
  { id: 'r-nw', code: 'NET_WORTH_UP', enabled: true, params: {} },
]

export const DEFAULT_SETTINGS: Settings = {
  income_tax_rate: 15,
  vat_rate: 10,
  business_mode: true,
  pin: null,
  hide_amounts: false,
  theme: 'dark',
  irregular_income: true,
  onboarded: false,
}
