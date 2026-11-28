import type { ReactNode } from 'react'

import { CheckIcon } from '../components/icons'
import { cn } from '../lib/cn'

interface ChoiceCardProps {
  title: string
  description?: string
  selected: boolean
  onToggle: () => void
  leading?: ReactNode
  role?: 'checkbox' | 'radio'
  disabled?: boolean
}

/**
 * A large selectable row.
 *
 * It is a button with a real checked state, so Space and Enter work and the
 * selection is announced rather than only coloured in.
 */
export function ChoiceCard({
  title,
  description,
  selected,
  onToggle,
  leading,
  role = 'checkbox',
  disabled = false,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-lg p-4 text-left shadow-card',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45',
        selected ? 'bg-lavender-soft' : 'bg-surface',
      )}
    >
      {leading ? (
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface text-accent-strong"
        >
          {leading}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label-lg text-ink">{title}</span>
        {description ? <span className="text-body-sm text-muted">{description}</span> : null}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-pill',
          selected ? 'bg-ink text-on-ink' : 'bg-canvas-sunken text-outline',
        )}
      >
        {selected ? <CheckIcon width={16} height={16} /> : null}
      </span>
    </button>
  )
}
