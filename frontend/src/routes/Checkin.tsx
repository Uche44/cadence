import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/auth'
import { fetchCheckin, previewCheckin, saveCheckin } from '../api/checkin'
import type {
  CheckinData,
  CheckinStop,
  CheckinWindow,
  CommitmentInput,
  Energy,
  SymptomOption,
} from '../api/checkin'
import { useAuth } from '../auth/context'
import { Card, CardTitle } from '../components/Card'
import { Chip } from '../components/Chip'
import { Input } from '../components/Input'
import { PillButton } from '../components/PillButton'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BoltIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from '../components/icons'
import { cn } from '../lib/cn'
import { formatTime, minutesToTime, timeToMinutes } from '../onboarding/time'

interface DraftCommitment {
  key: string
  id: string | null
  label: string
  start_minute: number
  end_minute: number
}

const ENERGY_OPTIONS = [
  { value: 'low' as const, label: 'Low', hint: 'Gentle pace', Icon: MoonIcon },
  { value: 'steady' as const, label: 'Steady', hint: 'Balanced', Icon: SunIcon },
  { value: 'high' as const, label: 'High', hint: 'Energized', Icon: BoltIcon },
]

const MAX_NOTES = 1000

function toInput(commitment: DraftCommitment): CommitmentInput {
  return {
    id: commitment.id,
    label: commitment.label,
    start_minute: commitment.start_minute,
    end_minute: commitment.end_minute,
  }
}

function totalMinutes(windows: CheckinWindow[]): number {
  return windows.reduce((sum, window) => sum + window.duration_minutes, 0)
}

export function Checkin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [data, setData] = useState<CheckinData | null>(null)
  const [energy, setEnergy] = useState<Energy | null>(null)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [commitments, setCommitments] = useState<DraftCommitment[]>([])
  const [windows, setWindows] = useState<CheckinWindow[]>([])
  const [redFlag, setRedFlag] = useState<CheckinStop | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [commitmentError, setCommitmentError] = useState<string | null>(null)

  const nextKey = useRef(0)
  const previewSeq = useRef(0)

  useEffect(() => {
    let live = true
    fetchCheckin()
      .then((next) => {
        if (!live) return
        setData(next)
        setEnergy(next.energy)
        setSymptoms(next.symptoms)
        setNotes(next.notes ?? '')
        setCommitments(
          next.commitments.map((commitment) => ({
            key: commitment.id,
            id: commitment.id,
            label: commitment.label,
            start_minute: commitment.start_minute,
            end_minute: commitment.end_minute,
          })),
        )
        setWindows(next.windows)
        setRedFlag(next.red_flag)
        setStatus('ready')
      })
      .catch(() => {
        if (live) setStatus('error')
      })

    return () => {
      live = false
    }
  }, [reloadKey])

  const applyDraft = (nextSymptoms: string[], nextCommitments: DraftCommitment[]) => {
    setSymptoms(nextSymptoms)
    setCommitments(nextCommitments)

    const sequence = previewSeq.current + 1
    previewSeq.current = sequence
    setPreviewing(true)
    setError(null)

    previewCheckin({
      symptoms: nextSymptoms,
      commitments: nextCommitments.map(toInput),
    })
      .then((preview) => {
        if (sequence !== previewSeq.current) return
        setWindows(preview.windows)
        setRedFlag(preview.red_flag)
      })
      .catch(() => {
        if (sequence === previewSeq.current) {
          setError('We could not refresh your free time. Please try again.')
        }
      })
      .finally(() => {
        if (sequence === previewSeq.current) setPreviewing(false)
      })
  }

  const toggleSymptom = (option: SymptomOption) => {
    if (option.key === 'none') {
      applyDraft([], commitments)
      return
    }
    const withoutNone = symptoms.filter((value) => value !== 'None / feeling good')
    const next = withoutNone.includes(option.label)
      ? withoutNone.filter((value) => value !== option.label)
      : [...withoutNone, option.label]
    applyDraft(next, commitments)
  }

  const resetCommitmentForm = () => {
    setEditingKey(null)
    setLabel('')
    setStart('09:00')
    setEnd('10:00')
    setCommitmentError(null)
  }

  const beginEdit = (commitment: DraftCommitment) => {
    setEditingKey(commitment.key)
    setLabel(commitment.label)
    setStart(minutesToTime(commitment.start_minute))
    setEnd(minutesToTime(commitment.end_minute))
    setCommitmentError(null)
  }

  const submitCommitment = () => {
    const startMinute = timeToMinutes(start)
    const endMinute = timeToMinutes(end)
    const cleaned = label.trim()

    if (!cleaned) {
      setCommitmentError('Every commitment needs a name.')
      return
    }
    if (startMinute === null || endMinute === null) {
      setCommitmentError('Enter a start and end time.')
      return
    }
    if (endMinute <= startMinute) {
      setCommitmentError(`"${cleaned}" must end after it starts.`)
      return
    }

    if (editingKey) {
      applyDraft(
        symptoms,
        commitments.map((commitment) =>
          commitment.key === editingKey
            ? {
                ...commitment,
                label: cleaned,
                start_minute: startMinute,
                end_minute: endMinute,
              }
            : commitment,
        ),
      )
    } else {
      nextKey.current += 1
      applyDraft(symptoms, [
        ...commitments,
        {
          key: `new-${nextKey.current}`,
          id: null,
          label: cleaned,
          start_minute: startMinute,
          end_minute: endMinute,
        },
      ])
    }

    resetCommitmentForm()
  }

  const removeCommitment = (commitment: DraftCommitment) => {
    applyDraft(
      symptoms,
      commitments.filter((value) => value.key !== commitment.key),
    )
    if (editingKey === commitment.key) resetCommitmentForm()
  }

  const handleSave = async () => {
    if (!energy || saving) return
    setSaving(true)
    setError(null)
    try {
      const next = await saveCheckin({
        energy,
        symptoms,
        notes: notes.trim() ? notes.trim() : null,
        commitments: commitments.map(toInput),
      })
      setData(next)
      setWindows(next.windows)
      setRedFlag(next.red_flag)
      if (!next.red_flag) {
        navigate('/today', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <p className="py-8 text-center text-body-md text-muted" role="status">
        Reading your day…
      </p>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-body-md text-muted" role="alert">
          We could not load your check-in. Check your connection and try again.
        </p>
        <PillButton variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
          Try again
        </PillButton>
      </div>
    )
  }

  const canSave = energy !== null && !saving

  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/today"
          aria-label="Go back"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface text-ink shadow-card"
        >
          <ArrowLeftIcon width={20} height={20} aria-hidden="true" />
        </Link>
        <span className="text-label-sm uppercase tracking-wide text-muted">Check in</span>
        <span className="w-12 shrink-0" aria-hidden="true" />
      </div>

      <header className="flex flex-col gap-2">
        <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-lavender-soft px-3 py-1 text-label-sm uppercase tracking-wide text-accent-strong">
          Daily calibration
        </p>
        <h1 className="text-display-mobile">Good morning{user ? `, ${user.displayName}` : ''}</h1>
        <p className="text-body-md text-muted">
          Let&apos;s check your energy and the shape of today before building a gentle rhythm.
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="energy-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="energy-heading" className="text-headline-sm">
            How&apos;s your energy today?
          </h2>
          <span className="text-label-sm text-muted">Tap to adjust</span>
        </div>

        <div
          role="radiogroup"
          aria-label="Energy level"
          aria-required="true"
          className="grid grid-cols-3 gap-2"
        >
          {ENERGY_OPTIONS.map((option) => {
            const selected = energy === option.value
            const Icon = option.Icon
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setEnergy(option.value)}
                className={cn(
                  'flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors duration-150',
                  selected ? 'bg-ink text-on-ink shadow-card' : 'bg-surface text-ink shadow-card',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex size-11 items-center justify-center rounded-pill',
                    selected ? 'bg-ink-heading text-on-ink' : 'bg-lavender-soft text-accent-strong',
                  )}
                >
                  <Icon width={22} height={22} />
                </span>
                <span className="text-label-lg">{option.label}</span>
                <span className={cn('text-body-sm', selected ? 'text-on-ink' : 'text-muted')}>
                  {option.hint}
                </span>
              </button>
            )
          })}
        </div>

        {energy === null ? (
          <p className="text-body-sm text-warning-ink" role="status">
            Choose how your energy feels before saving.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="symptoms-heading">
        <div>
          <h2 id="symptoms-heading" className="text-headline-sm">
            Anything off today?
          </h2>
          <p className="text-body-sm text-muted">We adjust movement prompts accordingly.</p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Symptoms">
          {data.options.symptoms.map((option) => (
            <Chip
              key={option.key}
              selected={
                option.key === 'none' ? symptoms.length === 0 : symptoms.includes(option.label)
              }
              onClick={() => toggleSymptom(option)}
              tone={option.red_flag ? 'blush' : 'surface'}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </section>

      {redFlag ? (
        <div
          className="flex flex-col gap-2 rounded-lg bg-danger-soft p-4 text-danger-ink"
          role="alert"
        >
          <h2 className="inline-flex items-center gap-2 text-label-lg font-bold">
            <AlertTriangleIcon width={20} height={20} aria-hidden="true" />
            Stop for today
          </h2>
          <p className="text-body-sm">{redFlag.guidance}</p>
          <ul className="flex flex-col gap-1">
            {redFlag.matched.map((item) => (
              <li key={item} className="flex items-start gap-2 text-body-sm">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-danger"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm">
            No exercise will be suggested today. If symptoms are severe, contact local emergency
            services.
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="commitments-heading">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 id="commitments-heading" className="text-headline-sm">
              Today&apos;s fixed commitments
            </h2>
            <p className="text-body-sm text-muted">Work, classes, appointments, the school run.</p>
          </div>
        </div>

        {commitments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {commitments.map((commitment) => (
              <li
                key={commitment.key}
                className="flex items-start gap-3 rounded-lg bg-surface p-4 shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-10 w-1.5 shrink-0 rounded-pill bg-ink"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-label-md text-ink">
                    {formatTime(commitment.start_minute)} – {formatTime(commitment.end_minute)}
                  </p>
                  <p className="truncate text-body-md text-ink">{commitment.label}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => beginEdit(commitment)}
                    className="min-h-12 rounded-pill px-3 text-label-sm text-accent-strong"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCommitment(commitment)}
                    className="min-h-12 rounded-pill px-3 text-label-sm text-danger-ink"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted">No fixed commitments yet.</p>
        )}

        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <h3 className="text-label-lg text-ink">
            {editingKey ? 'Edit commitment' : 'Add a commitment'}
          </h3>
          <Input
            label="What is it?"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Hospital ward shift"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Starts"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
            <Input
              label="Ends"
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </div>

          {commitmentError ? (
            <p className="text-body-sm text-danger-ink" role="alert">
              {commitmentError}
            </p>
          ) : null}

          <div className="flex gap-2">
            <PillButton
              variant="secondary"
              onClick={submitCommitment}
              icon={<PlusIcon width={18} height={18} />}
            >
              {editingKey ? 'Save change' : 'Add commitment'}
            </PillButton>
            {editingKey ? (
              <PillButton variant="ghost" onClick={resetCommitmentForm}>
                Cancel
              </PillButton>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-headline-sm">
          Anything else we should know?
        </h2>
        <label className="flex flex-col gap-2">
          <span className="text-label-lg text-ink">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={MAX_NOTES}
            rows={3}
            placeholder="A late night, a big meeting, a sore knee…"
            className="min-h-24 rounded-md border-[1.5px] border-transparent bg-lavender-soft px-4 py-3 text-body-md text-ink"
          />
          <span className="text-right text-label-sm text-muted">
            {notes.length} / {MAX_NOTES}
          </span>
        </label>
      </section>

      <Card tone="lavender-soft">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>Your free windows</CardTitle>
          <span className="text-label-sm text-muted">{totalMinutes(windows)} min free</span>
        </div>
        <div aria-live="polite" className="mt-2 flex flex-col gap-2">
          {windows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {windows.map((window) => (
                <li
                  key={`${window.start_minute}-${window.end_minute}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                >
                  <span className="text-label-md text-ink">
                    {formatTime(window.start_minute)} – {formatTime(window.end_minute)}
                  </span>
                  <span className="text-label-sm text-muted">{window.duration_minutes} min</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-warning-ink">
              Today is fully committed. We will keep the plan gentle and short.
            </p>
          )}
          {previewing ? (
            <p className="text-label-sm text-muted" role="status">
              Updating your free time…
            </p>
          ) : null}
        </div>
      </Card>

      {data.planning.blocked_reason === 'doctor_clearance' ? (
        <p className="rounded-lg bg-apricot-soft p-4 text-body-sm text-warning-ink" role="note">
          Your doctor has not cleared you for light exercise yet. We will save today&apos;s
          check-in, but we will not build a plan until that clearance is in place.
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

      <div className="flex flex-col items-center gap-2 pb-4">
        <PillButton fullWidth size="lg" disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : redFlag ? 'Save and rest today' : "Save today's check-in"}
        </PillButton>
        <p className="text-center text-label-sm text-muted">
          Cadence adapts rest breaks around your commitments.
        </p>
      </div>
    </div>
  )
}
