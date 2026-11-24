import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

export type StatTone = 'surface' | 'lavender' | 'apricot' | 'mint' | 'sky'

const TONE_CLASSES: Record<StatTone, string> = {
  surface: 'bg-surface',
  lavender: 'bg-lavender',
  apricot: 'bg-apricot',
  mint: 'bg-mint',
  sky: 'bg-sky',
}

interface StatTileProps {
  label: string
  value: ReactNode
  caption?: string
  tone?: StatTone
}

export function StatTile({ label, value, caption, tone = 'surface' }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-4', TONE_CLASSES[tone])}>
      <span className="text-label-md text-ink">{label}</span>
      <span className="text-headline-lg tabular-nums text-ink-heading">{value}</span>
      {caption ? (
        <span className={cn('text-body-sm', tone === 'surface' ? 'text-muted' : 'text-ink')}>
          {caption}
        </span>
      ) : null}
    </div>
  )
}
