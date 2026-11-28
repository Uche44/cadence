/** Onboarding API client. */

import { request } from './auth'

export interface OnboardingOption {
  key: string
  label: string
  description: string
  emoji: string
  icon: string
}

export interface OnboardingProfile {
  conditions: string[]
  interests: string[]
  equipment: string[]
  wake_minute: number
  bed_minute: number
  doctor_clearance: boolean
}

export interface OnboardingRules {
  pack_ids: string[]
  max_intensity: string
  max_block_minutes: number
  min_block_minutes: number
  max_daily_minutes: number
  blocked_tags: string[]
  red_flags: string[]
  sources: string[]
  guidance: string[]
  requires_doctor_clearance: boolean
  is_conservative: boolean
  notices: string[]
  fingerprint: string
}

export interface EligibleExercise {
  id: string
  label: string
  tags: string[]
  requires: string[]
  floor_based: boolean
}

export interface OnboardingConsent {
  version: string
  accepted: boolean
  accepted_at: string | null
}

export interface PlanningState {
  ready: boolean
  blocked_reason: string | null
  message: string | null
}

export interface OnboardingData {
  completed_step: number
  resume_step: number
  completed: boolean
  profile: OnboardingProfile
  rules: OnboardingRules
  eligible_exercises: EligibleExercise[]
  consent: OnboardingConsent
  planning: PlanningState
  options: {
    conditions: OnboardingOption[]
    interests: OnboardingOption[]
    equipment: OnboardingOption[]
  }
}

export interface HealthAnswers {
  conditions: string[]
  doctor_clearance: boolean
}

export interface InterestAnswers {
  interests: string[]
}

export interface RoutineAnswers {
  wake_minute: number
  bed_minute: number
  equipment: string[]
}

export interface ProfilePatch {
  conditions?: string[]
  interests?: string[]
  equipment?: string[]
  wake_minute?: number
  bed_minute?: number
  doctor_clearance?: boolean
}

const STEP_PATHS = [
  '/onboarding/health',
  '/onboarding/interests',
  '/onboarding/routine',
  '/onboarding/consent',
] as const

export function stepPath(step: number): string {
  return STEP_PATHS[step - 1] ?? STEP_PATHS[0]
}

export async function fetchOnboarding(): Promise<OnboardingData> {
  return request<OnboardingData>('/api/onboarding')
}

export async function saveHealthAnswers(input: HealthAnswers): Promise<OnboardingData> {
  return request<OnboardingData>('/api/onboarding/steps/1', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function saveInterests(input: InterestAnswers): Promise<OnboardingData> {
  return request<OnboardingData>('/api/onboarding/steps/2', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function saveRoutine(input: RoutineAnswers): Promise<OnboardingData> {
  return request<OnboardingData>('/api/onboarding/steps/3', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function acceptSafetyNotice(): Promise<OnboardingData> {
  return request<OnboardingData>('/api/onboarding/consent', {
    method: 'POST',
    body: JSON.stringify({ accepted: true }),
  })
}

export async function updateProfile(patch: ProfilePatch): Promise<OnboardingData> {
  return request<OnboardingData>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}
