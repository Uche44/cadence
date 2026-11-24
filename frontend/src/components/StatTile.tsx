import type { ReactNode } from 'react'

export type StatTone = 'surface' | 'lavender' | 'apricot' | 'mint' | 'sky'

interface StatTileProps {
  label: string
  value: ReactNode
  caption?: string
  tone?: StatTone
}

export function StatTile({ label, value, caption, tone = 'surface' }: StatTileProps) {
  const classes = ['stat-tile', tone === 'surface' ? '' : `stat-tile--${tone}`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value}</span>
      {caption ? <span className="stat-tile__caption">{caption}</span> : null}
    </div>
  )
}
