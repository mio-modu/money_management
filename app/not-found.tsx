import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-[15px] font-semibold">없는 화면이다</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-faint">
        주소를 잘못 입력했거나, 지워진 화면이다. 홈으로 가면 오늘 할 일부터 다시 보인다.
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
