import type { HTMLAttributes } from 'react'

export type CardTone =
  'surface' | 'lavender' | 'lavender-soft' | 'apricot' | 'sky' | 'mint' | 'blush'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  flat?: boolean
}

export function Card({ tone = 'surface', flat = false, className, children, ...rest }: CardProps) {
  const classes = [
    'card',
    tone === 'surface' ? '' : `card--${tone}`,
    flat ? 'card--flat' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
