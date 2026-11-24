import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../lib/cn'

export type CardTone =
  'surface' | 'lavender' | 'lavender-soft' | 'apricot' | 'sky' | 'mint' | 'blush'

const TONE_CLASSES: Record<CardTone, string> = {
  surface: 'bg-surface',
  lavender: 'bg-lavender',
  'lavender-soft': 'bg-lavender-soft',
  apricot: 'bg-apricot',
  sky: 'bg-sky',
  mint: 'bg-mint',
  blush: 'bg-blush',
}

const TINTED_TONES = new Set<CardTone>([
  'lavender',
  'lavender-soft',
  'apricot',
  'sky',
  'mint',
  'blush',
])

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  flat?: boolean
}

export function Card({ tone = 'surface', flat = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-5',
        TONE_CLASSES[tone],
        flat ? 'shadow-none' : 'shadow-card',
        className,
      )}
      {...rest}
    >
      <div className={cn('flex flex-col gap-1', TINTED_TONES.has(tone) && 'text-ink')}>
        {children}
      </div>
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-headline-md">{children}</h3>
}

export function CardBody({ children }: { children: ReactNode }) {
  return <p className="text-body-md text-muted">{children}</p>
}
