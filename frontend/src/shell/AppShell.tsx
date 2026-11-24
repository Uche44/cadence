import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useHealth } from '../api/health'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const health = useHealth()

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="shell__header">
        <Link to="/" className="shell__brand">
          Cadence
        </Link>
        <span className={`status status--${health.state}`} role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          {health.label}
        </span>
      </header>
      <main id="main" className="shell__main">
        {children}
      </main>
      <footer className="shell__footer">
        <p>Exercise that keeps pace with your life.</p>
      </footer>
    </div>
  )
}
