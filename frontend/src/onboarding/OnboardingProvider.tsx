import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  acceptSafetyNotice,
  fetchOnboarding,
  saveHealthAnswers,
  saveInterests as saveInterestsRequest,
  saveRoutine as saveRoutineRequest,
  updateProfile,
} from '../api/onboarding'
import type {
  HealthAnswers,
  InterestAnswers,
  OnboardingData,
  ProfilePatch,
  RoutineAnswers,
} from '../api/onboarding'
import { useAuth } from '../auth/context'
import { OnboardingContext } from './context'
import type { OnboardingContextValue, OnboardingStatus } from './context'

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth()
  const [status, setStatus] = useState<OnboardingStatus>('idle')
  const [data, setData] = useState<OnboardingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const next = await fetchOnboarding()
      setData(next)
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('We could not load your setup. Please try again.')
    }
  }, [])

  useEffect(() => {
    if (authStatus !== 'authenticated') return

    // Load after the effect body rather than synchronously inside it: the state
    // updates belong to the response, not to the render that requested it.
    let live = true
    void (async () => {
      try {
        const next = await fetchOnboarding()
        if (!live) return
        setData(next)
        setStatus('ready')
        setError(null)
      } catch {
        if (!live) return
        setStatus('error')
        setError('We could not load your setup. Please try again.')
      }
    })()

    return () => {
      live = false
    }
  }, [authStatus])

  const apply = useCallback(
    async (call: () => Promise<OnboardingData>): Promise<OnboardingData> => {
      const next = await call()
      setData(next)
      setStatus('ready')
      setError(null)
      return next
    },
    [],
  )

  const saveHealth = useCallback(
    (input: HealthAnswers) => apply(() => saveHealthAnswers(input)),
    [apply],
  )
  const saveInterests = useCallback(
    (input: InterestAnswers) => apply(() => saveInterestsRequest(input)),
    [apply],
  )
  const saveRoutine = useCallback(
    (input: RoutineAnswers) => apply(() => saveRoutineRequest(input)),
    [apply],
  )
  const acceptConsent = useCallback(() => apply(() => acceptSafetyNotice()), [apply])
  const editProfile = useCallback(
    (patch: ProfilePatch) => apply(() => updateProfile(patch)),
    [apply],
  )

  const authenticated = authStatus === 'authenticated'
  const value = useMemo<OnboardingContextValue>(
    () => ({
      // Signed-out visitors see no setup state, even if a previous session left
      // some in memory.
      status: authenticated ? status : 'idle',
      data: authenticated ? data : null,
      error: authenticated ? error : null,
      refresh,
      saveHealth,
      saveInterests,
      saveRoutine,
      acceptConsent,
      editProfile,
    }),
    [
      authenticated,
      status,
      data,
      error,
      refresh,
      saveHealth,
      saveInterests,
      saveRoutine,
      acceptConsent,
      editProfile,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}
