import type { ComponentType, SVGProps } from 'react'
import {
  IconBell,
  IconCheckSquare,
  IconFlow,
  IconHome,
  IconPie,
  IconPlus,
  IconSettings,
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
  { href: '/monthly', label: '월간 결산', desc: '순자산 변동 · TOP5 · 다음 달 예산', Icon: IconCheckSquare },
  { href: '/alerts', label: '알림 기록', desc: '에이전트가 남긴 경고 전체', Icon: IconBell },
  { href: '/settings', label: '설정', desc: '세율 · 규칙 · PIN · 더미 데이터', Icon: IconSettings },
]
