import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './context'

function CheckingSession() {
  return (
    <p className="py-8 text-center text-body-md text-muted" role="status">
      Checking your session…
    </p>
  )
}

/** Only signed-in users get past this. Everyone else is sent to log in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <CheckingSession />
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  return <>{children}</>
}

/** Sign-in screens are pointless once you are already signed in. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <CheckingSession />
  }

  if (status === 'authenticated') {
    return <Navigate to="/today" replace />
  }

  return <>{children}</>
}
