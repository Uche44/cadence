import { NavLink } from 'react-router-dom'

import { cn } from '../lib/cn'
import { BOTTOM_NAV_DESTINATIONS } from './navigation'

interface BottomNavProps {
  variant?: 'floating' | 'inline'
}

const NAV_CLASSES =
  'mx-auto flex w-full max-w-app items-center justify-between gap-1 rounded-pill bg-ink p-1 shadow-nav'

export function BottomNav({ variant = 'floating' }: BottomNavProps) {
  const nav = (
    <nav className={NAV_CLASSES} aria-label="Primary">
      {BOTTOM_NAV_DESTINATIONS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={cn(
            'inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-pill no-underline',
            'text-lavender transition-colors duration-150',
            'aria-[current=page]:bg-surface aria-[current=page]:text-ink',
          )}
        >
          <Icon />
          <span className="sr-only">{label}</span>
        </NavLink>
      ))}
    </nav>
  )

  if (variant === 'inline') {
    return nav
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {nav}
    </div>
  )
}
