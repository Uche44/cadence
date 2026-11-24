import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../lib/cn'
import { CheckIcon } from './icons'

export type ChipTone = 'surface' | 'lavender' | 'apricot' | 'sky' | 'mint' | 'blush'

const TONE_CLASSES: Record<ChipTone, string> = {
  surface: 'bg-surface',
  lavender: 'bg-lavender-soft',
  apricot: 'bg-apricot-soft',
  sky: 'bg-sky-soft',
  mint: 'bg-mint-soft',
  blush: 'bg-blush-soft',
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  tone?: ChipTone
  icon?: ReactNode
}

/**
 * A selectable chip.
 *
 * Selection is a real toggle button with `aria-pressed`, so the state is
 * announced rather than only coloured in.
 */
export function Chip({
  selected = false,
  tone = 'surface',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-12 items-center gap-1 rounded-pill border-0 px-4',
        'text-label-lg text-ink transition duration-150 ease-out cursor-pointer',
        selected ? 'bg-ink text-on-ink' : TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {selected ? <CheckIcon width={16} height={16} className="ml-1" /> : null}
    </button>
  )
}

interface TagProps {
  tone?: ChipTone
  children: ReactNode
}

/** A non-interactive label, e.g. the intensity and duration on a plan block. */
export function Tag({ tone = 'surface', children }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-12 items-center gap-1 rounded-pill px-4 text-label-lg text-ink',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
