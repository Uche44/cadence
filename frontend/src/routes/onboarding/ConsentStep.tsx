import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/auth'
import { useOnboarding } from '../../onboarding/context'
import { OnboardingShell } from '../../onboarding/OnboardingShell'
import { Card, CardTitle } from '../../components/Card'
import { PillButton } from '../../components/PillButton'
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from '../../components/icons'
import { cn } from '../../lib/cn'

const EMERGENCIES = [
  'Chest tightness, radiating pain, or intense pressure',
  'Sudden dizziness, fainting spells, or acute confusion',
  'Severe shortness of breath that does not ease with rest',
]

export function ConsentStep() {
  const { data, acceptConsent } = useOnboarding()
  const navigate = useNavigate()

  const [accepted, setAccepted] = useState(data?.consent.accepted ?? false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!data) return null

  const backTo = data.completed ? '/profile' : '/onboarding/routine'

  const handleAgree = async () => {
    if (!accepted || pending) return
    setPending(true)
    setError(null)
    try {
      await acceptConsent()
      navigate('/today', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingShell
      step={4}
      eyebrow="Safety protocol"
      title="Your safety is our primary metric"
      description="A thoughtful pause to ensure our rhythms remain supportive, gentle, and aligned."
      backTo={backTo}
    >
      <div className="flex justify-center">
        <span className="inline-flex size-16 items-center justify-center rounded-pill bg-lavender-soft text-accent-strong">
          <ShieldCheckIcon width={32} height={32} aria-hidden="true" />
        </span>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-lavender-soft text-accent-strong">
            <ShieldCheckIcon width={20} height={20} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-label-md uppercase tracking-wide text-muted">
              A gentle clarification
            </p>
            <CardTitle>
              Cadence is an encouraging wellness companion, not a replacement for your physician,
              endocrinologist, or cardiologist.
            </CardTitle>
          </div>
        </div>
      </Card>

      <div
        className="flex flex-col gap-2 rounded-lg bg-danger-soft p-4 text-danger-ink"
        role="note"
      >
        <p className="inline-flex items-center gap-2 text-label-lg font-bold">
          <AlertTriangleIcon width={20} height={20} aria-hidden="true" />
          Seek emergency care
        </p>
        <p className="text-body-sm">
          Immediately stop your current activity and contact emergency medical services if you
          experience:
        </p>
        <ul className="flex flex-col gap-1">
          {EMERGENCIES.map((item) => (
            <li key={item} className="flex items-start gap-2 text-body-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-danger"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={accepted}
        onClick={() => setAccepted((value) => !value)}
        className="flex min-h-12 w-full items-start gap-3 rounded-lg bg-surface p-4 text-left shadow-card"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm',
            accepted ? 'bg-ink text-on-ink' : 'bg-canvas-sunken text-outline',
          )}
        >
          {accepted ? <CheckIcon width={16} height={16} /> : null}
        </span>
        <span className="text-body-md text-ink">
          I understand Cadence adapts to my energy and I will stop if my body feels unwell.
        </span>
      </button>

      {data.consent.accepted && data.consent.accepted_at ? (
        <p className="text-body-sm text-muted" role="status">
          Safety notice {data.consent.version} accepted. You can review it any time.
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="pt-1">
        <PillButton
          fullWidth
          size="lg"
          disabled={!accepted || pending}
          onClick={() => void handleAgree()}
          icon={<ChevronRightIcon width={18} height={18} aria-hidden="true" />}
        >
          {pending
            ? 'Saving…'
            : data.consent.accepted
              ? 'Continue to today'
              : 'I understand & agree'}
        </PillButton>
      </div>
    </OnboardingShell>
  )
}
