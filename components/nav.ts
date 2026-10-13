import type { ComponentType, SVGProps } from 'react'
import {
  IconBell,
  IconCheckSquare,
  IconFlow,
  IconHeart,
  IconHome,
  IconPie,
  IconPlus,
  IconRepeat,
  IconSettings,
  IconBriefcase,
  IconTarget,
  IconWallet,
} from '@/components/icons'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

export interface NavItem {
  href: string
  label: string
  Icon: Icon
  primary?: boolean
  desc?: string
}

/** 하단 탭 — 한 손으로 닿는 자리에는 매일 쓰는 것만 둔다. */
export const TABS: NavItem[] = [
  { href: '/', label: '홈', Icon: IconHome },
  { href: '/cashflow', label: '현금흐름', Icon: IconFlow },
  { href: '/add', label: '입력', Icon: IconPlus, primary: true },
  { href: '/spending', label: '지출', Icon: IconPie },
]

/** "더보기" 시트. 구현된 화면만 올린다. */
export const MORE: NavItem[] = [
  { href: '/budget', label: '예산', desc: '카테고리별 계획과 소진 속도', Icon: IconPie },
  { href: '/subscriptions', label: '구독 관리', desc: '연간 환산 · 좀비 구독 정리', Icon: IconRepeat },
  { href: '/assets', label: '자산 · 부채', desc: '순자산 추이 · 상환 시뮬레이터', Icon: IconWallet },
  { href: '/business', label: '사업 지갑', desc: '세금 적립 · 미수금 · 실제 내 돈', Icon: IconBriefcase },
  { href: '/goals', label: '목표', desc: '월 필요 저축액 역산 · 행동으로 연결', Icon: IconTarget },
  { href: '/monthly', label: '월간 결산', desc: '순자산 변동 · TOP5 · 다음 달 예산', Icon: IconFlow },
  { href: '/routines', label: '루틴', desc: '일 · 주 · 월 · 분기 체크리스트', Icon: IconCheckSquare },
  { href: '/health', label: '재정 건강 점수', desc: '항목별 근거와 다음 행동', Icon: IconHeart },
  { href: '/alerts', label: '알림 기록', desc: '에이전트가 남긴 경고 전체', Icon: IconBell },
  { href: '/settings', label: '설정', desc: '세율 · 규칙 · PIN · 더미 데이터', Icon: IconSettings },
]
