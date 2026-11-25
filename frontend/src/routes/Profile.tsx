import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/context'
import { Card, CardBody, CardTitle } from '../components/Card'
import { PillButton } from '../components/PillButton'

export function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    navigate('/', { replace: true })
    await signOut()
  }

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

      <p className="text-body-md text-muted">
        Your conditions, interests and routine live here once you have completed onboarding.
      </p>

      <PillButton variant="secondary" fullWidth onClick={handleSignOut}>
        Log out
      </PillButton>
    </div>
  )
}
