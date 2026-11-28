import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/auth'
import { useOnboarding } from '../../onboarding/context'
import { ChoiceCard } from '../../onboarding/ChoiceCard'
import { OnboardingShell } from '../../onboarding/OnboardingShell'
import { PillButton } from '../../components/PillButton'
import { ChevronRightIcon } from '../../components/icons'

const MINIMUM = 3

export function InterestsStep() {
  const { data, saveInterests } = useOnboarding()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<string[]>(data?.profile.interests ?? [])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!data) return null

  const backTo = data.completed ? '/profile' : '/onboarding/health'
  const enough = selected.length >= MINIMUM

  const toggle = (key: string) => {
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    )
  }

  const handleContinue = async () => {
    if (!enough || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await saveInterests({ interests: selected })
      navigate(next.completed ? '/profile' : '/onboarding/routine', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingShell
      step={2}
      eyebrow="Gentle discovery"
      title="What movement brings you joy?"
      description="We'll use these to make movement feel natural and uplifting, not like a medical chore."
      backTo={backTo}
    >
      <div className="flex items-center justify-between gap-3 rounded-lg bg-lavender-soft px-4 py-3">
        <div className="flex flex-col">
          <p className="text-label-md text-ink">Pick at least {MINIMUM} favorites</p>
          <p className="text-body-sm text-muted">Tap any card to select or adjust</p>
        </div>
        <span className="rounded-pill bg-surface px-3 py-1 text-label-md text-ink">
          {selected.length} selected
        </span>
      </div>

      <div className="flex flex-col gap-2" role="group" aria-label="Movement options">
        {data.options.interests.map((option) => (
          <ChoiceCard
            key={option.key}
            title={option.label}
            description={option.description}
            selected={selected.includes(option.key)}
            onToggle={() => toggle(option.key)}
            leading={<span className="text-xl">{option.emoji}</span>}
          />
        ))}
      </div>

      <p className="text-body-sm text-muted" role="status">
        {enough
          ? 'Lovely — that is enough to build around.'
          : `Choose ${MINIMUM - selected.length} more to continue.`}
      </p>

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
          disabled={!enough || pending}
          onClick={() => void handleContinue()}
          icon={<ChevronRightIcon width={18} height={18} aria-hidden="true" />}
        >
          {pending ? 'Saving…' : data.completed ? 'Save changes' : 'Continue to Step 3'}
        </PillButton>
      </div>
    </OnboardingShell>
  )
}
