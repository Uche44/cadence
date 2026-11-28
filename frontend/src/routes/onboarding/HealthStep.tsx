import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/auth'
import { useOnboarding } from '../../onboarding/context'
import { ChoiceCard } from '../../onboarding/ChoiceCard'
import { OnboardingShell } from '../../onboarding/OnboardingShell'
import { OptionIcon } from '../../onboarding/OptionIcon'
import { RulesSummary } from '../../onboarding/RulesSummary'
import { Card, CardTitle } from '../../components/Card'
import { PillButton } from '../../components/PillButton'
import { ChevronRightIcon, ShieldCheckIcon } from '../../components/icons'
import { cn } from '../../lib/cn'

export function HealthStep() {
  const { data, saveHealth } = useOnboarding()
  const navigate = useNavigate()

  const [conditions, setConditions] = useState<string[]>(data?.profile.conditions ?? [])
  const [clearance, setClearance] = useState(data?.profile.doctor_clearance ?? false)
  const [answered, setAnswered] = useState((data?.completed_step ?? 0) >= 1)
  const [noneSelected, setNoneSelected] = useState(
    (data?.completed_step ?? 0) >= 1 && (data?.profile.conditions.length ?? 0) === 0,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!data) return null

  const backTo = data.completed ? '/profile' : '/'
  const otherSelected = conditions.includes('Other chronic condition')
  const conservative = otherSelected || data.rules.is_conservative
  const ready = (conditions.length > 0 || noneSelected) && answered && !pending

  const toggleCondition = (key: string) => {
    if (key === 'none') {
      setNoneSelected(true)
      setConditions([])
      return
    }
    setNoneSelected(false)
    setConditions((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    )
  }

  const chooseClearance = (value: boolean) => {
    setClearance(value)
    setAnswered(true)
  }

  const handleContinue = async () => {
    if (!ready) return
    setPending(true)
    setError(null)
    try {
      const next = await saveHealth({ conditions, doctor_clearance: clearance })
      navigate(next.completed ? '/profile' : '/onboarding/interests', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingShell
      step={1}
      eyebrow="Gentle & adaptive care"
      title="What conditions are we caring for?"
      description="Cadence tailors low-impact movement and exertion intensity to safeguard your health."
      backTo={backTo}
    >
      <div className="flex flex-col gap-2" role="group" aria-label="Selectable health conditions">
        {data.options.conditions.map((option) => (
          <ChoiceCard
            key={option.key}
            title={option.label}
            description={option.description}
            selected={option.key === 'none' ? noneSelected : conditions.includes(option.key)}
            onToggle={() => toggleCondition(option.key)}
            leading={<OptionIcon name={option.icon} />}
          />
        ))}
      </div>

      <Card tone="lavender-soft">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface text-accent-strong">
            <ShieldCheckIcon width={22} height={22} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle>Has your doctor cleared you for light exercise?</CardTitle>
            <p className="text-body-sm text-muted">
              Ensures we never recommend contraindicated exertion levels.
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Exercise clearance"
          className="mt-3 grid grid-cols-2 gap-1.5 rounded-pill bg-surface p-1.5"
        >
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'Not yet' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={answered && clearance === option.value}
              onClick={() => chooseClearance(option.value)}
              className={cn(
                'min-h-12 rounded-pill px-4 text-label-lg transition-colors duration-150',
                answered && clearance === option.value
                  ? 'bg-ink text-on-ink'
                  : 'bg-transparent text-accent-strong',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      {conservative ? (
        <div
          className="flex items-start gap-3 rounded-lg bg-apricot-soft p-4 text-warning-ink"
          role="note"
        >
          <span className="mt-0.5 shrink-0">
            <OptionIcon name="plus" size={20} />
          </span>
          <p className="text-body-sm">
            No condition-specific rules are authored for this yet, so conservative limits apply.
            Please confirm with your doctor before starting.
          </p>
        </div>
      ) : null}

      {data.completed_step >= 1 ? <RulesSummary rules={data.rules} /> : null}

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
          disabled={!ready}
          onClick={() => void handleContinue()}
          icon={<ChevronRightIcon width={18} height={18} aria-hidden="true" />}
        >
          {pending ? 'Saving…' : data.completed ? 'Save changes' : 'Continue to Step 2'}
        </PillButton>
      </div>
    </OnboardingShell>
  )
}
