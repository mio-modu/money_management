'use client'

import { useState } from 'react'
import { IconLock } from '@/components/icons'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** 민감한 데이터라 홈 화면에서 바로 열리면 안 되는 경우를 위한 가벼운 잠금. */
export function LockScreen() {
  const unlock = useStore((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  const press = (d: string) => {
    const next = (pin + d).slice(0, 6)
    setPin(next)
    setWrong(false)
    if (next.length >= 4 && !unlock(next)) {
      // 4자리에서 바로 틀렸다고 하지 않는다. 6자리까지 받아 본다.
      if (next.length === 6) {
        setWrong(true)
        setPin('')
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
          <IconLock width={22} height={22} />
        </span>
        <p className="text-[15px] font-semibold">PIN 입력</p>
        <p className="text-[12px] text-faint">설정에서 끌 수 있다. 이 PIN 은 이 기기 안에만 있다.</p>
      </div>

      <div className="flex gap-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-colors',
              i < pin.length ? 'bg-accent' : 'bg-surface-2',
              wrong && 'bg-danger',
            )}
          />
        ))}
      </div>
      {wrong ? <p className="text-[13px] text-danger">PIN 이 맞지 않다.</p> : null}

      <div className="grid w-full grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (k === '←' ? setPin((p) => p.slice(0, -1)) : press(k))}
              className="h-14 rounded-md bg-surface text-lg font-semibold active:bg-surface-2"
            >
              {k}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => unlock(pin)}
        className="h-11 w-full rounded-md bg-accent text-sm font-semibold text-accent-fg"
      >
        확인
      </button>
    </div>
  )
}
