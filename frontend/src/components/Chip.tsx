import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { CheckIcon } from './icons'

export type ChipTone = 'surface' | 'lavender' | 'apricot' | 'sky' | 'mint' | 'blush'

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
  const classes = [
    'chip',
    tone === 'surface' ? '' : `chip--${tone}`,
    selected ? 'chip--selected' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} aria-pressed={selected} {...rest}>
      {icon ? (
        <span aria-hidden="true" className="chip__icon">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {selected ? <CheckIcon width={16} height={16} className="chip__check" /> : null}
    </button>
  )
}

interface TagProps {
  tone?: ChipTone
  children: ReactNode
}

/** A non-interactive label, e.g. the intensity and duration on a plan block. */
export function Tag({ tone = 'surface', children }: TagProps) {
  const classes = ['chip', 'chip--static', tone === 'surface' ? '' : `chip--${tone}`]
    .filter(Boolean)
    .join(' ')

  return <span className={classes}>{children}</span>
}
