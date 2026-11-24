import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useHealth } from '../api/health'
import { BottomNav } from '../components/BottomNav'
import { DESTINATION_PATHS } from '../components/navigation'
import { StatusBadge } from '../components/StatusBadge'
import type { StatusTone } from '../components/StatusBadge'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const HEALTH_TONE: Record<string, StatusTone> = {
  checking: 'neutral',
  connected: 'success',
  unavailable: 'warning',
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const health = useHealth()
  const online = useOnlineStatus()
  const { pathname } = useLocation()
  const showNav = DESTINATION_PATHS.has(pathname)
  const isWelcome = pathname === '/'

  return (
    <div className={showNav ? 'app app--with-nav' : 'app'}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={isWelcome ? 'app__header app__header--end' : 'app__header'}>
        {isWelcome ? null : (
          <Link to="/" className="app__brand">
            Cadence
          </Link>
        )}
        <StatusBadge tone={online ? HEALTH_TONE[health.state] : 'warning'}>
          {online ? health.label : 'Offline'}
        </StatusBadge>
      </header>
      {!online ? (
        <p className="offline-banner" role="status">
          You are offline. Your last saved plan is still available.
        </p>
      ) : null}
      <main id="main" className="app__main">
        {children}
      </main>
      {isWelcome ? null : (
        <footer className="app__footer">
          <p>Exercise that keeps pace with your life.</p>
        </footer>
      )}
      {showNav ? <BottomNav /> : null}
    </div>
  )
}
