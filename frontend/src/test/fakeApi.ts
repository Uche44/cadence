import { vi } from 'vitest'

import type { AuthUser } from '../api/auth'
import type {
  CheckinData,
  CheckinStop,
  CheckinWindow,
  Commitment,
  CommitmentInput,
  Energy,
  SymptomOption,
} from '../api/checkin'
import type { OnboardingData, OnboardingOption, OnboardingRules } from '../api/onboarding'

export const TEST_USER: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

const BASELINE_RULES: OnboardingRules = {
  pack_ids: ['baseline'],
  max_intensity: 'moderate',
  max_block_minutes: 30,
  min_block_minutes: 5,
  max_daily_minutes: 60,
  blocked_tags: [],
  red_flags: ['chest pain, pressure or tightness'],
  sources: ['WHO 2020 Guidelines on physical activity and sedentary behaviour'],
  guidance: [],
  requires_doctor_clearance: false,
  is_conservative: false,
  notices: [],
  fingerprint: 'baseline-fingerprint',
}

const CONDITION_OPTIONS: OnboardingOption[] = [
  {
    key: 'Type 2 diabetes',
    label: 'Type 2 Diabetes',
    description: 'Targeting glucose uptake after meals',
    emoji: '',
    icon: 'droplet',
  },
  {
    key: 'Hypertension',
    label: 'Hypertension',
    description: 'Lowers resting blood pressure',
    emoji: '',
    icon: 'heart',
  },
  {
    key: 'Chronic low back pain / mild arthritis',
    label: 'Chronic back pain / arthritis',
    description: 'Spine decompression & joint mobility',
    emoji: '',
    icon: 'back',
  },
  {
    key: 'Other chronic condition',
    label: 'Other chronic condition',
    description: 'Add auto-immune, respiratory, or other',
    emoji: '',
    icon: 'plus',
  },
  {
    key: 'none',
    label: 'No condition - just stay fit',
    description: 'General fitness guidance, no clearance needed',
    emoji: '',
    icon: 'leaf',
  },
]

const INTEREST_OPTIONS: OnboardingOption[] = [
  {
    key: 'Music & dancing',
    label: 'Music & dancing',
    description: 'Rhythm, joy, effortless cardio',
    emoji: '💃',
    icon: '',
  },
  {
    key: 'Walking in nature',
    label: 'Walking in nature',
    description: 'Fresh air, birdsong & calm strides',
    emoji: '🌿',
    icon: '',
  },
  {
    key: 'Gardening',
    label: 'Gardening',
    description: 'Potting, tending & gentle squats',
    emoji: '🌱',
    icon: '',
  },
  {
    key: 'Swimming & water aerobics',
    label: 'Swimming & water aerobics',
    description: 'Zero joint pressure, soothing float',
    emoji: '🏊‍♀️',
    icon: '',
  },
  {
    key: 'Phone calls with friends',
    label: 'Phone calls with friends',
    description: 'Walking laps while catching up',
    emoji: '📞',
    icon: '',
  },
  {
    key: 'Watching favorite TV / shows',
    label: 'Watching favorite TV / shows',
    description: 'Commercial break stretching',
    emoji: '📺',
    icon: '',
  },
  {
    key: 'Cooking & baking',
    label: 'Cooking & baking',
    description: 'Kitchen mobility & posture shifts',
    emoji: '🍲',
    icon: '',
  },
  {
    key: 'Prayer & quiet meditation',
    label: 'Prayer & quiet meditation',
    description: 'Deep diaphragm breathing & release',
    emoji: '🧘',
    icon: '',
  },
  {
    key: 'Gentle stretching in bed',
    label: 'Gentle stretching in bed',
    description: 'Morning waking & spine alignment',
    emoji: '🛏️',
    icon: '',
  },
]

const EQUIPMENT_OPTIONS: OnboardingOption[] = [
  {
    key: 'bodyweight',
    label: 'None / Bodyweight only',
    description: 'Gentle bed & floor-friendly flows',
    emoji: '',
    icon: 'bodyweight',
  },
  {
    key: 'resistance bands',
    label: 'Resistance loop bands',
    description: 'Low-impact joint stabilizing',
    emoji: '',
    icon: 'bands',
  },
  {
    key: 'light dumbbells',
    label: 'Light dumbbells (2-5 lbs)',
    description: 'Progressive bone density support',
    emoji: '',
    icon: 'dumbbell',
  },
  {
    key: 'walking pad',
    label: 'Walking pad / Gym access',
    description: 'Controlled micro-pacing options',
    emoji: '',
    icon: 'walk',
  },
]

const COMPLETE_PROFILE: OnboardingData['profile'] = {
  conditions: [],
  interests: ['Music & dancing', 'Walking in nature', 'Gardening'],
  equipment: ['bodyweight'],
  wake_minute: 390,
  bed_minute: 1335,
  doctor_clearance: false,
}

export function completeOnboarding(
  overrides: Partial<OnboardingData> = {},
  profile: Partial<OnboardingData['profile']> = {},
): OnboardingData {
  return {
    completed_step: 4,
    resume_step: 4,
    completed: true,
    profile: { ...COMPLETE_PROFILE, ...profile },
    rules: BASELINE_RULES,
    eligible_exercises: [
      {
        id: 'chair_march',
        label: 'Seated or chair marching',
        tags: ['walking', 'mobility'],
        requires: [],
        floor_based: false,
      },
      {
        id: 'floor_bridge',
        label: 'Floor glute bridge',
        tags: ['floor', 'strength'],
        requires: ['bodyweight'],
        floor_based: true,
      },
    ],
    consent: {
      version: '2026-11',
      accepted: true,
      accepted_at: '2026-11-26T09:00:00Z',
    },
    planning: { ready: true, blocked_reason: null, message: null },
    options: {
      conditions: CONDITION_OPTIONS,
      interests: INTEREST_OPTIONS,
      equipment: EQUIPMENT_OPTIONS,
    },
    ...overrides,
  }
}

export function incompleteOnboarding(
  completedStep = 0,
  overrides: Partial<OnboardingData> = {},
  profile: Partial<OnboardingData['profile']> = {},
): OnboardingData {
  const base = completeOnboarding(overrides, profile)
  return {
    ...base,
    completed_step: completedStep,
    resume_step: Math.min(completedStep + 1, 4),
    completed: false,
    consent: { version: '2026-11', accepted: false, accepted_at: null },
    planning: {
      ready: false,
      blocked_reason: 'onboarding',
      message: 'Finish the four setup steps before we build a plan.',
    },
  }
}

interface FakeApiOptions {
  /** Who the session check should report. `null` means signed out. */
  me?: AuthUser | null
  /** The onboarding state to serve. Defaults to complete once signed in. */
  onboarding?: OnboardingData
  onLogin?: () => Response
  onSignup?: () => Response
}

const SYMPTOM_OPTIONS: SymptomOption[] = [
  {
    key: 'slept_badly',
    label: 'Slept badly',
    description: 'Rest was broken or short',
    red_flag: false,
  },
  {
    key: 'sore',
    label: 'Feeling sore',
    description: 'Muscles or joints are tender',
    red_flag: false,
  },
  { key: 'stiff', label: 'Stiff joints', description: 'Movement feels sticky', red_flag: false },
  {
    key: 'anxious',
    label: 'Feeling anxious',
    description: 'Stress is running high',
    red_flag: false,
  },
  {
    key: 'night_shift',
    label: 'Shift work / night shift',
    description: 'An odd start',
    red_flag: false,
  },
  { key: 'traveling', label: 'Traveling', description: 'Away from routine', red_flag: false },
  {
    key: 'dizziness',
    label: 'Dizziness / off-balance',
    description: 'Dizzy or unsteady',
    red_flag: true,
  },
  {
    key: 'chest_pain',
    label: 'Chest pain or pressure',
    description: 'Pain or tightness',
    red_flag: true,
  },
  {
    key: 'breathless',
    label: 'Shortness of breath',
    description: 'Breathless at rest',
    red_flag: true,
  },
  {
    key: 'faint',
    label: 'Fainting or near-fainting',
    description: 'You fainted or almost did',
    red_flag: true,
  },
  {
    key: 'leg_weakness',
    label: 'Numbness or weakness in legs',
    description: 'New numbness or weakness',
    red_flag: true,
  },
  {
    key: 'shaky',
    label: 'Shakiness or confusion',
    description: 'Shaky or confused',
    red_flag: true,
  },
  { key: 'vision', label: 'Blurred vision', description: 'New blurring', red_flag: true },
  {
    key: 'foot_wound',
    label: 'Foot wound getting worse',
    description: 'A worsening wound',
    red_flag: true,
  },
  { key: 'none', label: 'None / feeling good', description: 'Nothing unusual', red_flag: false },
]

const RED_FLAG_MATCHES: Record<string, string> = {
  'Chest pain or pressure': 'chest pain, pressure or tightness',
  'Dizziness / off-balance': 'sudden dizziness or lightheadedness',
  'Shortness of breath': 'severe shortness of breath at rest',
  'Fainting or near-fainting': 'fainting or near-fainting',
  'Numbness or weakness in legs': 'progressive weakness in one or both legs',
  'Shakiness or confusion': 'shakiness, sweating or confusion that could be low blood sugar',
  'Blurred vision': 'sudden blurred vision',
  'Foot wound getting worse': 'a foot wound or blister that is getting worse',
}

function stopFor(symptoms: string[]): CheckinStop | null {
  const matched = symptoms
    .map((symptom) => RED_FLAG_MATCHES[symptom])
    .filter((value): value is string => Boolean(value))
  if (matched.length === 0) return null
  return {
    matched: [...new Set(matched)],
    guidance:
      'Stop for today. If these symptoms are severe, or do not settle within a few minutes, seek medical help.',
  }
}

function freeWindows(
  commitments: CommitmentInput[],
  dayStart: number,
  dayEnd: number,
): CheckinWindow[] {
  const spans = commitments
    .filter((commitment) => commitment.end_minute > commitment.start_minute)
    .map(
      (commitment) =>
        [Math.max(dayStart, commitment.start_minute), Math.min(dayEnd, commitment.end_minute)] as [
          number,
          number,
        ],
    )
    .filter(([startMinute, endMinute]) => endMinute > startMinute)
    .sort((left, right) => left[0] - right[0])

  const merged: [number, number][] = []
  for (const [startMinute, endMinute] of spans) {
    const last = merged.at(-1)
    if (last && startMinute <= last[1]) {
      last[1] = Math.max(last[1], endMinute)
    } else {
      merged.push([startMinute, endMinute])
    }
  }

  const windows: CheckinWindow[] = []
  let cursor = dayStart
  for (const [startMinute, endMinute] of merged) {
    if (startMinute - cursor >= 5) {
      windows.push({
        start_minute: cursor,
        end_minute: startMinute,
        duration_minutes: startMinute - cursor,
      })
    }
    cursor = Math.max(cursor, endMinute)
  }
  if (dayEnd - cursor >= 5) {
    windows.push({
      start_minute: cursor,
      end_minute: dayEnd,
      duration_minutes: dayEnd - cursor,
    })
  }
  return windows
}

/**
 * A small stand-in for the API, so screen tests exercise real request shapes
 * instead of mocking the client module out of existence.
 */
export function installFakeApi({ me = null, onboarding, onLogin, onSignup }: FakeApiOptions = {}) {
  let signedIn = me !== null
  let state: OnboardingData | null = onboarding ?? null
  let checkin: CheckinData | null = null
  let commitmentCounter = 0

  const current = (): OnboardingData => {
    if (!state) state = completeOnboarding()
    return state
  }

  const checkinState = (): CheckinData => {
    if (checkin) return { ...checkin, planning: current().planning }
    const onboardingState = current()
    return {
      date: '2026-11-28',
      exists: false,
      energy: null,
      symptoms: [],
      notes: null,
      commitments: [],
      windows: freeWindows(
        [],
        onboardingState.profile.wake_minute,
        onboardingState.profile.bed_minute,
      ),
      day_start_minute: onboardingState.profile.wake_minute,
      day_end_minute: onboardingState.profile.bed_minute,
      red_flag: null,
      red_flag_symptoms: onboardingState.rules.red_flags,
      options: { symptoms: SYMPTOM_OPTIONS },
      planning: onboardingState.planning,
    }
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (url.includes('/api/health')) {
      return json({ status: 'ok', version: '0.1.0', server_time: 'now' })
    }

    if (url.includes('/api/auth/me')) {
      return me
        ? json({ id: me.id, email: me.email, display_name: me.displayName })
        : json({ detail: 'Sign in to continue.' }, 401)
    }

    if (url.includes('/api/auth/login') && method === 'POST') {
      const response = onLogin
        ? onLogin()
        : json({ detail: 'That email and password do not match.' }, 401)
      if (response.ok) signedIn = true
      return response
    }

    if (url.includes('/api/auth/signup') && method === 'POST') {
      const response = onSignup
        ? onSignup()
        : json({ detail: 'An account with that email already exists.' }, 409)
      if (response.ok) signedIn = true
      return response
    }

    if (url.includes('/api/auth/logout') && method === 'POST') {
      signedIn = false
      state = null
      checkin = null
      commitmentCounter = 0
      return noContent()
    }

    if (url.includes('/api/onboarding') && method === 'GET') {
      return signedIn ? json(current()) : json({ detail: 'Sign in to continue.' }, 401)
    }

    if (/\/api\/onboarding\/steps\/\d+/.test(url) && method === 'PUT') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      const step = Number(url.slice(url.lastIndexOf('/') + 1))
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const previous = current()
      const profile = { ...previous.profile, ...body }
      state = {
        ...previous,
        profile,
        completed_step: Math.max(previous.completed_step, step),
        resume_step: Math.min(Math.max(previous.completed_step, step) + 1, 4),
      }
      return json(state)
    }

    if (url.includes('/api/onboarding/consent') && method === 'POST') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      const previous = current()
      const needsClearance =
        previous.rules.requires_doctor_clearance && !previous.profile.doctor_clearance
      state = {
        ...previous,
        completed_step: 4,
        resume_step: 4,
        completed: true,
        consent: {
          version: '2026-11',
          accepted: true,
          accepted_at: '2026-11-26T10:00:00Z',
        },
        planning: needsClearance
          ? {
              ready: false,
              blocked_reason: 'doctor_clearance',
              message:
                'Your doctor has not cleared you for light exercise yet. This is not an error — it is a safety step.',
            }
          : { ready: true, blocked_reason: null, message: null },
      }
      return json(state)
    }

    if (url.includes('/api/home') && method === 'GET') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      const home = current()
      if (!home.consent.accepted) {
        return json({ detail: 'Accept the current safety notice to continue.' }, 403)
      }
      return json({
        display_name: me?.displayName ?? 'Ada Lovelace',
        planning: home.planning,
        rules: home.rules,
        stale_plans: 0,
      })
    }

    if (url.includes('/api/checkin/preview') && method === 'POST') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const previous = checkinState()
      const incoming: CommitmentInput[] = body.commitments ?? []
      return json({
        commitments: incoming.map((commitment) => ({
          id: commitment.id ?? null,
          label: commitment.label,
          start_minute: commitment.start_minute,
          end_minute: commitment.end_minute,
        })),
        windows: freeWindows(incoming, previous.day_start_minute, previous.day_end_minute),
        day_start_minute: previous.day_start_minute,
        day_end_minute: previous.day_end_minute,
        red_flag: stopFor(body.symptoms ?? []),
        red_flag_symptoms: previous.red_flag_symptoms,
      })
    }

    if (url.includes('/api/checkin') && method === 'GET') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      return json(checkinState())
    }

    if (url.includes('/api/checkin') && method === 'PUT') {
      if (!signedIn) return json({ detail: 'Sign in to continue.' }, 401)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const previous = checkinState()
      const incoming: CommitmentInput[] = body.commitments ?? []
      const commitments: Commitment[] = incoming.map((commitment) => {
        const existing = previous.commitments.find((item) => item.id === commitment.id)
        if (existing) {
          return {
            ...existing,
            label: commitment.label,
            start_minute: commitment.start_minute,
            end_minute: commitment.end_minute,
          }
        }
        commitmentCounter += 1
        return {
          id: `commit-${commitmentCounter}`,
          label: commitment.label,
          start_minute: commitment.start_minute,
          end_minute: commitment.end_minute,
        }
      })
      const symptoms: string[] = body.symptoms ?? []
      checkin = {
        ...previous,
        exists: true,
        energy: (body.energy ?? 'steady') as Energy,
        symptoms,
        notes: body.notes ?? null,
        commitments,
        windows: freeWindows(commitments, previous.day_start_minute, previous.day_end_minute),
        red_flag: stopFor(symptoms),
        planning: current().planning,
      }
      return json(checkin)
    }

    return json({ detail: 'not found' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function signedInPayload(user: AuthUser = TEST_USER): Response {
  return json({
    user: { id: user.id, email: user.email, display_name: user.displayName },
    redirect_to: '/today',
  })
}
