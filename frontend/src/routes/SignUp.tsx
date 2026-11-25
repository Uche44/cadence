import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/auth'
import { useAuth } from '../auth/context'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { PillButton } from '../components/PillButton'
import { pillButtonClasses } from '../components/buttonStyles'
import { ChevronRightIcon, LeafIcon } from '../components/icons'
import { cn } from '../lib/cn'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MINIMUM_PASSWORD_LENGTH = 8

interface Errors {
  display_name?: string
  email?: string
  password?: string
}

export function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const destination = (location.state as { from?: string } | null)?.from ?? '/today'

  const validate = (): Errors => {
    const found: Errors = {}
    if (displayName.trim().length < 2) {
      found.display_name = 'Please enter your name.'
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = 'Please enter a valid email address.'
    }
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      found.password = `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`
    }
    return found
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    const found = validate()
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    setPending(true)
    try {
      await signUp(displayName, email, password)
      navigate(destination, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors as Errors)
        setFormError(
          error.fieldErrors && Object.keys(error.fieldErrors).length > 0 ? null : error.message,
        )
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
        <p className="inline-flex items-center gap-2 text-label-md text-accent-strong">
          <LeafIcon width={16} height={16} aria-hidden="true" /> A gentle start
        </p>
        <h1 className="text-display-mobile">Let&apos;s build a plan that fits your life.</h1>
        <p className="text-body-md text-muted">
          One account keeps your conditions, your routine and what you enjoy in one place.
        </p>
      </header>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Input
            label="Full name"
            name="display_name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            error={errors.display_name}
            disabled={pending}
          />
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
            label="Create password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="8 or more characters. We keep health data private."
            error={errors.password}
            disabled={pending}
          />

          {formError ? (
            <p
              className={cn('rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink')}
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
            {pending ? 'Creating your account…' : 'Create account'}
          </PillButton>
        </form>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <p className="text-body-sm text-muted">Already have an account?</p>
        <Link to="/login" className={pillButtonClasses({ variant: 'secondary', fullWidth: true })}>
          Log in
        </Link>
      </div>
    </div>
  )
}
