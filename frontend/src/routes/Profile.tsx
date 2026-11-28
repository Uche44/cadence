import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/context'
import { pillButtonClasses } from '../components/buttonStyles'
import { Card, CardBody, CardTitle } from '../components/Card'
import { PillButton } from '../components/PillButton'
import { useOnboarding } from '../onboarding/context'
import { RulesSummary } from '../onboarding/RulesSummary'
import { formatTime } from '../onboarding/time'

export function Profile() {
  const { user, signOut } = useAuth()
  const { data } = useOnboarding()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    navigate('/', { replace: true })
    await signOut()
  }

  const equipmentLabels =
    data?.profile.equipment.map(
      (key) => data.options.equipment.find((option) => option.key === key)?.label ?? key,
    ) ?? []

  return (
    <div className="flex flex-col gap-4 py-3">
      <p className="text-label-md text-accent-strong">Profile</p>
      <h1 className="text-display-mobile">Your setup</h1>

      {user ? (
        <Card tone="lavender">
          <CardTitle>{user.displayName}</CardTitle>
          <CardBody>{user.email}</CardBody>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardTitle>Health</CardTitle>
            <CardBody>
              {data.profile.conditions.length > 0
                ? data.profile.conditions.join(', ')
                : 'No conditions — general fitness guidance.'}
            </CardBody>
            <p className="mt-2 text-body-sm text-muted">
              Doctor clearance: {data.profile.doctor_clearance ? 'given' : 'not yet'}
            </p>
          </Card>

          <Card>
            <CardTitle>Your day</CardTitle>
            <CardBody>
              Awake {formatTime(data.profile.wake_minute)} to {formatTime(data.profile.bed_minute)}.
            </CardBody>
            <p className="mt-2 text-body-sm text-muted">
              {equipmentLabels.length > 0
                ? `Equipment: ${equipmentLabels.join(', ')}.`
                : 'No equipment selected.'}
            </p>
          </Card>

          <Card>
            <CardTitle>What you enjoy</CardTitle>
            <CardBody>{data.profile.interests.join(' · ')}</CardBody>
          </Card>

          <RulesSummary rules={data.rules} />

          <Link
            to="/onboarding/health"
            className={pillButtonClasses({ variant: 'secondary', fullWidth: true })}
          >
            Edit your setup
          </Link>
        </>
      ) : null}

      <PillButton variant="secondary" fullWidth onClick={() => void handleSignOut()}>
        Log out
      </PillButton>
    </div>
  )
}
