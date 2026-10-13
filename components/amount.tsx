import { cn } from '@/lib/utils'
import { shortWon, signedShortWon, signedWon, won } from '@/lib/format'

/**
 * 모든 금액은 이 컴포넌트를 거친다. `.amount` 클래스가 붙어 있어서
 * 설정의 "금액 가리기"가 켜지면 CSS 한 줄로 전부 블러 처리된다.
 */
export function Amount({
  value,
  short = false,
  signed = false,
  suffix = '원',
  className,
}: {
  value: number
  short?: boolean
  signed?: boolean
  suffix?: string
  className?: string
}) {
  const text = signed
    ? short
      ? signedShortWon(value)
      : signedWon(value)
    : short
      ? shortWon(value)
      : won(value)
  return (
    <span className={cn('amount tnum', className)}>
      {text}
      {suffix}
    </span>
  )
}
