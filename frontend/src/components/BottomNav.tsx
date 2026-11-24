import { NavLink } from 'react-router-dom'

import { BOTTOM_NAV_DESTINATIONS } from './navigation'

interface BottomNavProps {
  variant?: 'floating' | 'inline'
}

export function BottomNav({ variant = 'floating' }: BottomNavProps) {
  return (
    <nav
      className={variant === 'inline' ? 'bottom-nav bottom-nav--inline' : 'bottom-nav'}
      aria-label="Primary"
    >
      {BOTTOM_NAV_DESTINATIONS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className="bottom-nav__item">
          <Icon />
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
