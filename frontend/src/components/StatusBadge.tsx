import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface text-muted',
  success: 'bg-mint-soft text-success-ink',
  warning: 'bg-apricot-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-sky-soft text-accent-strong',
}

interface StatusBadgeProps {
  tone?: StatusTone
  children: ReactNode
  dot?: boolean
}

export function StatusBadge({ tone = 'neutral', children, dot = true }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-2 whitespace-nowrap rounded-pill px-3',
        'text-label-md',
        TONE_CLASSES[tone],
      )}
    >
      {dot ? <span className="size-2 rounded-pill bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
