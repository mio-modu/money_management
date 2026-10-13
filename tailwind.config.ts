import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        line: 'hsl(var(--line))',
        fg: 'hsl(var(--fg))',
        muted: 'hsl(var(--muted))',
        faint: 'hsl(var(--faint))',
        accent: 'hsl(var(--accent))',
        'accent-fg': 'hsl(var(--accent-fg))',
        danger: 'hsl(var(--danger))',
        warn: 'hsl(var(--warn))',
        good: 'hsl(var(--good))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // 숫자는 자리수가 흔들리면 읽기 어렵다. 전부 tabular.
        num: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '14px',
        md: '10px',
        sm: '7px',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up .22s ease-out',
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
