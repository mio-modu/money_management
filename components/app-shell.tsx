'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMenu,
  IconSliders,
  IconX,
} from '@/components/icons'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { LockScreen } from '@/components/lock-screen'
import { MORE, TABS } from '@/components/nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const init = useStore((s) => s.init)
  const ready = useStore((s) => s.ready)
  const locked = useStore((s) => s.locked)
  const settings = useStore((s) => s.db.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  // 테마와 금액 가리기는 body 클래스 하나로 끝낸다.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', settings.theme === 'light')
    document.body.classList.toggle('amounts-hidden', settings.hide_amounts)
  }, [settings.theme, settings.hide_amounts])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  if (locked) return <LockScreen />

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-accent text-[13px] font-black text-accent-fg">
            ₩
          </span>
          <span className="text-[15px] font-bold tracking-tight">머니가드</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void setSettings({ hide_amounts: !settings.hide_amounts })}
            aria-label={settings.hide_amounts ? '금액 보이기' : '금액 가리기'}
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            {settings.hide_amounts ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
          </button>
          {settings.pin ? (
            <button
              type="button"
              onClick={() => useStore.getState().lock()}
              aria-label="앱 잠그기"
              className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              <IconLock width={18} height={18} />
            </button>
          ) : null}
          <Link
            href="/settings"
            aria-label="설정"
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <IconSliders width={18} height={18} />
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-20">
        {ready ? children : <Booting />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-screen-sm border-t border-line bg-bg/95 backdrop-blur">
        <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map((t) => {
            const active = pathname === t.href
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-fg' : 'text-faint',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-full',
                    t.primary ? 'bg-accent text-accent-fg' : active ? 'bg-surface-2' : '',
                  )}
                >
                  <t.Icon width={19} height={19} />
                </span>
                {t.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-faint"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full">
              <IconMenu width={19} height={19} />
            </span>
            더보기
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 animate-fade-in" onClick={() => setMoreOpen(false)}>
          <div
            className="mx-auto w-full max-w-screen-sm rounded-t-2xl border-t border-line bg-surface p-3 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <h2 className="text-[15px] font-bold">전체 메뉴</h2>
              <Button variant="ghost" size="icon" onClick={() => setMoreOpen(false)} aria-label="닫기">
                <IconX width={18} height={18} />
              </Button>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto">
              {MORE.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
                    <m.Icon width={18} height={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-[11px] text-faint">{m.desc}</span>
                  </span>
                  <IconChevronRight width={16} height={16} className="shrink-0 text-faint" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Booting() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  )
}
