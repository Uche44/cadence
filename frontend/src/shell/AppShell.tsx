import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useHealth } from '../api/health'
import { BottomNav } from '../components/BottomNav'
import { DESTINATION_PATHS } from '../components/navigation'
import { StatusBadge } from '../components/StatusBadge'
import type { StatusTone } from '../components/StatusBadge'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { cn } from '../lib/cn'

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
    <div
      className={cn(
        'mx-auto flex min-h-dvh max-w-app flex-col gap-6 px-5',
        'pt-[calc(1.25rem+env(safe-area-inset-top))]',
        showNav
          ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
          : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
      )}
    >
      <a
        href="#main"
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
          'focus:rounded-pill focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-ink',
        )}
      >
        Skip to content
      </a>
      {isWelcome ? null : (
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center text-headline-lg text-ink-heading no-underline"
          >
            Cadence
          </Link>
          <StatusBadge tone={online ? HEALTH_TONE[health.state] : 'warning'}>
            {online ? health.label : 'Offline'}
          </StatusBadge>
        </header>
      )}
      {!online ? (
        <p
          className="flex items-center gap-3 rounded-md bg-apricot-soft px-4 py-3 text-body-sm text-warning-ink"
          role="status"
        >
          You are offline. Your last saved plan is still available.
        </p>
      ) : null}
      <main id="main" className="flex flex-1 flex-col gap-5">
        {children}
      </main>
      {isWelcome ? null : (
        <footer className="text-body-sm text-muted">
          <p>Exercise that keeps pace with your life.</p>
        </footer>
      )}
      {showNav ? <BottomNav /> : null}
    </div>
  )
}
