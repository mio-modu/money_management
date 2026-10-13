import type { ComponentType, SVGProps } from 'react'
import { IconBell, IconHome, IconPlus, IconSettings } from '@/components/icons'

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
  { href: '/add', label: '입력', Icon: IconPlus, primary: true },
  { href: '/alerts', label: '알림', Icon: IconBell },
]

/** "더보기" 시트. 구현된 화면만 올린다. */
export const MORE: NavItem[] = [
  { href: '/settings', label: '설정', desc: '세율 · 규칙 · PIN · 더미 데이터', Icon: IconSettings },
]
