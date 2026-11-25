import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/auth'
import { useAuth } from '../auth/context'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { PillButton } from '../components/PillButton'
import { pillButtonClasses } from '../components/buttonStyles'
import { ChevronRightIcon } from '../components/icons'

interface Errors {
  email?: string
  password?: string
}

export function LogIn() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const destination = (location.state as { from?: string } | null)?.from ?? '/today'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    const found: Errors = {}
    if (!email.trim()) found.email = 'Please enter your email address.'
    if (!password) found.password = 'Please enter your password.'
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    setPending(true)
    try {
      await signIn(email, password)
      navigate(destination, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-3">
      <header className="flex flex-col gap-2">
        <p className="text-label-md text-accent-strong">Welcome back</p>
        <h1 className="text-display-mobile">Pick up where you left off.</h1>
        <p className="text-body-md text-muted">
          Your plan, your routine and your pace are exactly where you left them.
        </p>
      </header>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            disabled={pending}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            disabled={pending}
          />

          {formError ? (
            <p
              className="rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <PillButton
            type="submit"
            fullWidth
            size="lg"
            disabled={pending}
            icon={<ChevronRightIcon width={18} height={18} aria-hidden="true" />}
          >
            {pending ? 'Signing in…' : 'Log in'}
          </PillButton>
        </form>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <p className="text-body-sm text-muted">Don&apos;t have an account?</p>
        <Link to="/signup" className={pillButtonClasses({ variant: 'secondary', fullWidth: true })}>
          Sign up
        </Link>
      </div>
    </div>
  )
}
