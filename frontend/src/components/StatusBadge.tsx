import type { ReactNode } from 'react'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface StatusBadgeProps {
  tone?: StatusTone
  children: ReactNode
  dot?: boolean
}

export function StatusBadge({ tone = 'neutral', children, dot = true }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {dot ? <span className="status-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
