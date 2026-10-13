import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/app-shell'

export const metadata: Metadata = {
  title: '머니가드 — 내 돈이 새는 곳을 먼저 찾는다',
  description:
    '가계부가 아니다. 지출을 기록하면 새는 지점을 스스로 찾아 경고하고, 그래서 뭘 해야 하는지까지 말해 주는 개인 재정 에이전트.',
  applicationName: '머니가드',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '머니가드' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#121214',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
