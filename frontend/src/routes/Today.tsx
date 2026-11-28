import { Link } from 'react-router-dom'

import { pillButtonClasses } from '../components/buttonStyles'
import { Card, CardTitle } from '../components/Card'
import { AlertTriangleIcon } from '../components/icons'
import { useOnboarding } from '../onboarding/context'
import { RulesSummary } from '../onboarding/RulesSummary'

export function Today() {
  const { data } = useOnboarding()
  const blocked = data?.planning.blocked_reason === 'doctor_clearance'

  return (
    <div className="flex flex-col gap-4 py-3">
      <p className="text-label-md text-accent-strong">Today</p>
      <h1 className="text-display-mobile">Your day, at your pace</h1>

      {blocked ? (
        <Card tone="apricot">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-warning-ink">
              <AlertTriangleIcon width={22} height={22} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle>We need your doctor&apos;s clearance first</CardTitle>
              <p className="text-body-md text-muted">{data?.planning.message}</p>
            </div>
          </div>
          <Link
            to="/onboarding/health"
            className={pillButtonClasses({
              variant: 'secondary',
              fullWidth: true,
              className: 'mt-3',
            })}
          >
            Update your health answers
          </Link>
        </Card>
      ) : (
        <p className="text-body-md text-muted">
          Your daily plan will appear here after your morning check-in.
        </p>
      )}

      {data ? <RulesSummary rules={data.rules} /> : null}
    </div>
  )
}
