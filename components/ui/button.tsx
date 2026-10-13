'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent/90',
        solid: 'bg-surface-2 text-fg hover:bg-line',
        ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
        outline: 'border border-line text-fg hover:bg-surface-2',
        danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-10 px-3.5 text-sm',
        lg: 'h-12 px-5 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
