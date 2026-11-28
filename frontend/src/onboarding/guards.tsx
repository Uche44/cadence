import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { PillButton } from '../components/PillButton'
import { stepPath } from '../api/onboarding'
import { useOnboarding } from './context'

export function CheckingSetup() {
  return (
    <p className="py-8 text-center text-body-md text-muted" role="status">
      Loading your setup…
    </p>
  )
}

function SetupError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 py-6">
      <p className="text-body-md text-muted" role="alert">
        We could not load your setup. Check your connection and try again.
      </p>
      <PillButton variant="secondary" onClick={onRetry}>
        Try again
      </PillButton>
    </div>
  )
}

/** The app is closed until onboarding and consent are complete. */
export function RequireReady({ children }: { children: ReactNode }) {
  const { status, data, refresh } = useOnboarding()

  if (status === 'idle' || status === 'loading') {
    return <CheckingSetup />
  }

  if (status === 'error' || !data) {
    return <SetupError onRetry={() => void refresh()} />
  }

  if (!data.completed) {
    return <Navigate to={stepPath(data.resume_step)} replace />
  }

  return <>{children}</>
}

/**
 * A step is reachable only when the steps before it are done.
 *
 * Completed users may still open any step to edit their answers; a fresh user
 * is sent back to the first unfinished step instead.
 */
export function StepGate({ step, children }: { step: number; children: ReactNode }) {
  const { status, data, refresh } = useOnboarding()

  if (status === 'idle' || status === 'loading') {
    return <CheckingSetup />
  }

  if (status === 'error' || !data) {
    return <SetupError onRetry={() => void refresh()} />
  }

  if (!data.completed && step > data.resume_step) {
    return <Navigate to={stepPath(data.resume_step)} replace />
  }

  return <>{children}</>
}

/** `/onboarding` always lands on the right step. */
export function OnboardingIndex() {
  const { status, data, refresh } = useOnboarding()

  if (status === 'idle' || status === 'loading') {
    return <CheckingSetup />
  }

  if (status === 'error' || !data) {
    return <SetupError onRetry={() => void refresh()} />
  }

  return <Navigate to={data.completed ? '/today' : stepPath(data.resume_step)} replace />
}
