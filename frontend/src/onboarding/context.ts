import { createContext, useContext } from 'react'

import type {
  HealthAnswers,
  InterestAnswers,
  OnboardingData,
  ProfilePatch,
  RoutineAnswers,
} from '../api/onboarding'

export type OnboardingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface OnboardingContextValue {
  status: OnboardingStatus
  data: OnboardingData | null
  error: string | null
  refresh: () => Promise<void>
  saveHealth: (input: HealthAnswers) => Promise<OnboardingData>
  saveInterests: (input: InterestAnswers) => Promise<OnboardingData>
  saveRoutine: (input: RoutineAnswers) => Promise<OnboardingData>
  acceptConsent: () => Promise<OnboardingData>
  editProfile: (patch: ProfilePatch) => Promise<OnboardingData>
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext)
  if (!value) {
    throw new Error('useOnboarding must be used inside an OnboardingProvider')
  }
  return value
}
