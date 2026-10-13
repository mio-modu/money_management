import { format, startOfQuarter, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
import { thisMonth, ymd } from './date'

export type RoutineKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RoutineItem {
  id: string
  label: string
  /** 왜 하는지 — 체크박스만 있으면 의미 없이 체크하게 된다 */
  why: string
  href?: string
}

export interface RoutineDef {
  kind: RoutineKind
  title: string
  cadence: string
  items: RoutineItem[]
}

export const ROUTINES: RoutineDef[] = [
  {
    kind: 'daily',
    title: '매일',
    cadence: '하루 1분',
    items: [
      {
        id: 'yesterday',
        label: '어제 지출 한 줄 확인',
        why: '하루 지나면 뭘 썼는지 기억이 안 난다. 그때부터 기록이 끊긴다.',
        href: '/spending',
      },
      {
        id: 'nospend',
        label: '무지출일 체크',
        why: '안 쓴 날을 세는 것만으로 다음 날의 소비가 줄어든다.',
      },
    ],
  },
  {
    kind: 'weekly',
    title: '매주 일요일',
    cadence: '5분',
    items: [
      { id: 'pace', label: '예산 소진율 확인', why: '월말에 보면 늦다. 중간에 보면 아직 고칠 수 있다.', href: '/budget' },
      { id: 'waste', label: '낭비 비중 확인', why: '이번 주에 낭비로 분류된 지출이 얼마인지 본다.', href: '/spending' },
      { id: 'upcoming', label: '다음 주 고정지출 예고 확인', why: '빠져나갈 돈을 알고 있으면 주말 지출이 달라진다.', href: '/cashflow' },
    ],
  },
  {
    kind: 'monthly',
    title: '매월 1일',
    cadence: '15분',
    items: [
      { id: 'report', label: '월간 결산 읽기', why: '순자산이 늘었는지, 어디가 늘었는지 한 번은 봐야 한다.', href: '/monthly' },
      { id: 'top5', label: '카테고리 TOP5 확인', why: '상위 5개가 전체의 대부분이다. 거기만 손대면 된다.', href: '/spending' },
      { id: 'budget', label: '다음 달 예산 확정', why: '자동 제안을 그대로 쓰지 말고 한 번 고쳐라. 고친 예산만 지켜진다.', href: '/budget' },
      { id: 'tax', label: '세금 적립 이체', why: '사업 수입이 있었다면 세금 몫은 이번 달 안에 옮긴다.', href: '/business' },
    ],
  },
  {
    kind: 'quarterly',
    title: '분기',
    cadence: '30분',
    items: [
      { id: 'subs', label: '구독 전수 점검', why: '연간 환산 금액을 다시 본다. 3개월이면 안 쓰는 게 생긴다.', href: '/subscriptions' },
      { id: 'insurance', label: '보험·통신요금제 적정성', why: '고정지출은 한 번 손대면 매달 효과가 난다. 분기에 한 번은 따져 본다.', href: '/cashflow' },
      { id: 'debt', label: '부채 상환 전략 재검토', why: '잔액이 줄면 우선순위가 바뀐다. 시뮬레이터를 다시 돌린다.', href: '/debts' },
      { id: 'goal', label: '목표 기한·금액 조정', why: '못 지킬 목표를 들고 있으면 목표 자체를 안 보게 된다.', href: '/goals' },
    ],
  },
  {
    kind: 'yearly',
    title: '연간',
    cadence: '1~2시간',
    items: [
      { id: 'taxdoc', label: '세금 신고 대비 사업 지출 정리', why: '사업으로 표시한 지출을 한 해치 모아 본다.', href: '/business' },
      { id: 'yearspend', label: '연간 총지출 리뷰', why: '한 해 동안 어디로 갔는지는 1년에 한 번은 봐야 한다.', href: '/spending' },
      { id: 'networth', label: '순자산 1년 변동 확인', why: '한 해가 잘 굴러갔는지는 이 숫자 하나로 판정된다.', href: '/assets' },
    ],
  },
]

/** 주기별 "지금 기간" 키. 이 키가 같으면 같은 회차다. */
export function periodKey(kind: RoutineKind, now = new Date()): string {
  switch (kind) {
    case 'daily':
      return ymd(now)
    case 'weekly':
      return ymd(startOfWeek(now, { weekStartsOn: 0 }))
    case 'monthly':
      return `${thisMonth()}-01`
    case 'quarterly':
      return ymd(startOfQuarter(now))
    case 'yearly':
      return `${format(now, 'yyyy')}-01-01`
  }
}

/** 수행률을 재기 위한 과거 기간 키들 (최신 순). */
export function pastPeriods(kind: RoutineKind, count: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    if (kind === 'daily') out.push(ymd(subDays(now, i)))
    else if (kind === 'weekly') out.push(ymd(startOfWeek(subWeeks(now, i), { weekStartsOn: 0 })))
    else if (kind === 'monthly') out.push(`${format(subMonths(now, i), 'yyyy-MM')}-01`)
    else if (kind === 'quarterly') out.push(ymd(startOfQuarter(subMonths(now, i * 3))))
    else out.push(`${Number(format(now, 'yyyy')) - i}-01-01`)
  }
  return out
}

export const PERIOD_LABEL: Record<RoutineKind, string> = {
  daily: '일',
  weekly: '주',
  monthly: '달',
  quarterly: '분기',
  yearly: '해',
}
