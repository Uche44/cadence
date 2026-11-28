/** Morning check-in API client. */

import { request } from './auth'
import type { PlanningState } from './onboarding'

export type Energy = 'low' | 'steady' | 'high'

export interface Commitment {
  id: string
  label: string
  start_minute: number
  end_minute: number
}

export interface CommitmentInput {
  id?: string | null
  label: string
  start_minute: number
  end_minute: number
}

export interface PreviewCommitment {
  id: string | null
  label: string
  start_minute: number
  end_minute: number
}

export interface CheckinWindow {
  start_minute: number
  end_minute: number
  duration_minutes: number
}

export interface CheckinStop {
  matched: string[]
  guidance: string
}

export interface SymptomOption {
  key: string
  label: string
  description: string
  red_flag: boolean
}

export interface CheckinData {
  date: string
  exists: boolean
  energy: Energy | null
  symptoms: string[]
  notes: string | null
  commitments: Commitment[]
  windows: CheckinWindow[]
  day_start_minute: number
  day_end_minute: number
  red_flag: CheckinStop | null
  red_flag_symptoms: string[]
  options: { symptoms: SymptomOption[] }
  planning: PlanningState
}

export interface CheckinDraft {
  symptoms: string[]
  commitments: CommitmentInput[]
}

export interface CheckinPayload extends CheckinDraft {
  energy: Energy
  notes: string | null
}

export interface CheckinPreview {
  commitments: PreviewCommitment[]
  windows: CheckinWindow[]
  day_start_minute: number
  day_end_minute: number
  red_flag: CheckinStop | null
  red_flag_symptoms: string[]
}

/** The browser's offset east of UTC, which is what the server expects. */
export function localOffsetMinutes(): number {
  return -new Date().getTimezoneOffset()
}

export async function fetchCheckin(offset = localOffsetMinutes()): Promise<CheckinData> {
  return request<CheckinData>(`/api/checkin?utc_offset_minutes=${offset}`)
}

export async function previewCheckin(draft: CheckinDraft): Promise<CheckinPreview> {
  return request<CheckinPreview>('/api/checkin/preview', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export async function saveCheckin(
  payload: CheckinPayload,
  offset = localOffsetMinutes(),
): Promise<CheckinData> {
  return request<CheckinData>(`/api/checkin?utc_offset_minutes=${offset}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
