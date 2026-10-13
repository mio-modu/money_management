import type { SVGProps } from 'react'

// 아이콘 패키지를 쓰지 않는다. 쓰는 것만 직접 그려 두면 번들이 가볍고
// 선 굵기·크기를 화면 전체에서 똑같이 맞출 수 있다.
type P = SVGProps<SVGSVGElement>

function Svg({ children, ...p }: P) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20h14V9.8" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconFlow = (p: P) => (
  <Svg {...p}>
    <path d="M3 17l5-6 4 3 4-6 5 4" />
    <path d="M3 21h18" />
  </Svg>
)
export const IconPie = (p: P) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-9-9v9z" />
    <path d="M12 3a9 9 0 0 1 9 9h-9" />
  </Svg>
)
export const IconRepeat = (p: P) => (
  <Svg {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
)
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconBriefcase = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    <path d="M3 12.5h18" />
  </Svg>
)
export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconCheckSquare = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <path d="M8 12.5l2.8 2.8L16.5 9.5" />
  </Svg>
)
export const IconHeart = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20z" />
  </Svg>
)
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" />
  </Svg>
)
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M5 9l7 7 7-7" />
  </Svg>
)
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const IconWarn = (p: P) => (
  <Svg {...p}>
    <path d="M12 4l9 15.5H3L12 4z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
)
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
)
export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
  </Svg>
)
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
)
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.8 5.9A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a16 16 0 0 1-2.6 3.3" />
    <path d="M6.2 7.9A15.6 15.6 0 0 0 2.5 12S6 18.2 12 18.2c1 0 1.9-.2 2.7-.5" />
  </Svg>
)
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
)
export const IconArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
)
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
)
export const IconBackspace = (p: P) => (
  <Svg {...p}>
    <path d="M9 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L2.5 12 9 5z" />
    <path d="M13 9.5l5 5M18 9.5l-5 5" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
)
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12M7 11l5 5 5-5" />
    <path d="M4 21h16" />
  </Svg>
)
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20.5 11A8.5 8.5 0 1 0 12 20.5" />
    <path d="M20.5 4.5V11h-6.5" />
  </Svg>
)
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </Svg>
)
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)
export const IconSliders = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
)
