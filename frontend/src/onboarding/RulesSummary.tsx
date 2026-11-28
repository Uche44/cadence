import type { OnboardingRules } from '../api/onboarding'
import { Card, CardTitle } from '../components/Card'

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** The caps that actually apply, shown back to the user so they are auditable. */
export function RulesSummary({ rules }: { rules: OnboardingRules }) {
  return (
    <Card tone={rules.is_conservative ? 'apricot' : 'lavender-soft'}>
      <CardTitle>What this means for your plan</CardTitle>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-surface px-2 py-3">
          <dt className="text-label-sm text-muted">Intensity</dt>
          <dd className="text-label-lg text-ink">{titleCase(rules.max_intensity)}</dd>
        </div>
        <div className="rounded-md bg-surface px-2 py-3">
          <dt className="text-label-sm text-muted">Longest block</dt>
          <dd className="text-label-lg text-ink">{rules.max_block_minutes} min</dd>
        </div>
        <div className="rounded-md bg-surface px-2 py-3">
          <dt className="text-label-sm text-muted">Daily total</dt>
          <dd className="text-label-lg text-ink">{rules.max_daily_minutes} min</dd>
        </div>
      </dl>

      {rules.notices.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2" role="note">
          {rules.notices.map((notice) => (
            <p key={notice} className="text-body-sm text-warning-ink">
              {notice}
            </p>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
