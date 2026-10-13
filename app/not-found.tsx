import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-[15px] font-semibold">아직 열리지 않은 화면이다</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-faint">
        머니가드는 단계별로 열린다. 지금 열린 것은 홈 · 현금흐름 · 빠른 입력 · 지출 분석 · 예산 · 월간 결산 · 알림 기록 · 설정이다.
      </p>
      <Link
        href="/"
        className="mt-1 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg"
      >
        홈으로
      </Link>
    </div>
  )
}
