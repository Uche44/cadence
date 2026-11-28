import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/auth'
import { useOnboarding } from '../../onboarding/context'
import { ChoiceCard } from '../../onboarding/ChoiceCard'
import { OnboardingShell } from '../../onboarding/OnboardingShell'
import { OptionIcon } from '../../onboarding/OptionIcon'
import { minutesToTime, timeToMinutes } from '../../onboarding/time'
import { Input } from '../../components/Input'
import { PillButton } from '../../components/PillButton'
import { AlertTriangleIcon, ChevronRightIcon } from '../../components/icons'

interface Errors {
  wake?: string
  bed?: string
}

export function RoutineStep() {
  const { data, saveRoutine } = useOnboarding()
  const navigate = useNavigate()

  const [wake, setWake] = useState(minutesToTime(data?.profile.wake_minute ?? 390))
  const [bed, setBed] = useState(minutesToTime(data?.profile.bed_minute ?? 1335))
  const [equipment, setEquipment] = useState<string[]>(data?.profile.equipment ?? [])
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!data) return null

  const backTo = data.completed ? '/profile' : '/onboarding/interests'
  const needsClearance = data.rules.requires_doctor_clearance && !data.profile.doctor_clearance

  const toggleEquipment = (key: string) => {
    setEquipment((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    )
  }

  const handleContinue = async () => {
    if (pending) return

    const wakeMinute = timeToMinutes(wake)
    const bedMinute = timeToMinutes(bed)
    const found: Errors = {}
    if (wakeMinute === null) found.wake = 'Enter your usual wake-up time.'
    if (bedMinute === null) found.bed = 'Enter your usual bedtime.'
    if (wakeMinute !== null && bedMinute !== null && bedMinute <= wakeMinute) {
      found.bed = 'Bedtime must be after your wake-up time.'
    }
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0 || wakeMinute === null || bedMinute === null) return

    setPending(true)
    try {
      const next = await saveRoutine({
        wake_minute: wakeMinute,
        bed_minute: bedMinute,
        equipment,
      })
      navigate(next.completed ? '/profile' : '/onboarding/consent', { replace: true })
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingShell
      step={3}
      eyebrow="Your daily rhythm"
      title="Your daily rhythm & tools"
      description="Tell us your approximate sleep rhythm so workouts never disrupt your rest."
      backTo={backTo}
    >
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
        <h2 className="text-headline-sm">Rest &amp; wake rhythm</h2>
        <Input
          label="Typical wake-up"
          type="time"
          name="wake_minute"
          value={wake}
          onChange={(event) => setWake(event.target.value)}
          error={errors.wake}
          disabled={pending}
        />
        <Input
          label="Typical bedtime"
          type="time"
          name="bed_minute"
          value={bed}
          onChange={(event) => setBed(event.target.value)}
          error={errors.bed}
          hint="Bedtimes after midnight are treated as 11:59 PM."
          disabled={pending}
        />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="equipment-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="equipment-heading" className="text-headline-sm">
            Available equipment at home
          </h2>
          <span className="text-label-sm text-muted">Select all that apply</span>
        </div>

        {data.options.equipment.map((option) => (
          <ChoiceCard
            key={option.key}
            title={option.label}
            description={option.description}
            selected={equipment.includes(option.key)}
            onToggle={() => toggleEquipment(option.key)}
            leading={<OptionIcon name={option.icon} />}
          />
        ))}

        {equipment.length === 0 ? (
          <p className="text-body-sm text-muted" role="status">
            Nothing selected — only standing and seated movement will be offered.
          </p>
        ) : null}
      </section>

      {needsClearance ? (
        <div
          className="flex items-start gap-3 rounded-lg bg-apricot-soft p-4 text-warning-ink"
          role="note"
        >
          <span className="mt-0.5 shrink-0">
            <AlertTriangleIcon width={20} height={20} aria-hidden="true" />
          </span>
          <p className="text-body-sm">
            Your doctor has not cleared you for light exercise yet. You can finish setup, but we
            will not build a plan until that clearance is in place.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg bg-surface p-4 shadow-card">
        <p className="text-body-sm text-muted">
          <strong className="text-ink">Don&apos;t worry:</strong> your morning check-ins adapt each
          day based on your schedule and energy level.
        </p>
      </div>

      {formError ? (
        <p
          className="rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <div className="pt-1">
        <PillButton
          fullWidth
          size="lg"
          disabled={pending}
          onClick={() => void handleContinue()}
          icon={<ChevronRightIcon width={18} height={18} aria-hidden="true" />}
        >
          {pending ? 'Saving…' : data.completed ? 'Save changes' : 'Review safety agreement'}
        </PillButton>
      </div>
    </OnboardingShell>
  )
}
