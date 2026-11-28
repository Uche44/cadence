import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ArrowLeftIcon } from '../components/icons'
import { cn } from '../lib/cn'

const TOTAL_STEPS = 4

interface OnboardingShellProps {
  step: number
  eyebrow: string
  title: string
  description: string
  backTo: string
  children: ReactNode
}

/**
 * The frame every onboarding step shares.
 *
 * The progress indicator is a real progressbar with a value, so assistive tech
 * announces the same step the screen shows.
 */
export function OnboardingShell({
  step,
  eyebrow,
  title,
  description,
  backTo,
  children,
}: OnboardingShellProps) {
  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backTo}
          aria-label="Go back"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface text-ink shadow-card"
        >
          <ArrowLeftIcon width={20} height={20} aria-hidden="true" />
        </Link>

        <div
          role="progressbar"
          aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
          className="flex items-center gap-1.5"
        >
          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((value) => (
            <span
              key={value}
              className={cn(
                'h-2 rounded-pill transition-all duration-200',
                value === step ? 'w-8 bg-ink' : 'w-2 bg-lavender',
              )}
            />
          ))}
        </div>

        <span className="w-14 shrink-0 text-right text-label-sm text-muted">
          {step} / {TOTAL_STEPS}
        </span>
      </div>

      <header className="flex flex-col gap-2">
        <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-lavender-soft px-3 py-1 text-label-sm uppercase tracking-wide text-accent-strong">
          {eyebrow}
        </p>
        <h1 className="text-display-mobile">{title}</h1>
        <p className="text-body-md text-muted">{description}</p>
      </header>

      {children}
    </div>
  )
}
