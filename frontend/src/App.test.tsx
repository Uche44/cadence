import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { TEST_USER, installFakeApi, json, signedInPayload } from './test/fakeApi'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('application shell', () => {
  it('opens on the welcome screen for a signed-out visitor', async () => {
    installFakeApi({ me: null })
    renderAt('/')

    expect(
      screen.getByRole('heading', { level: 1, name: /exercise that keeps pace/i }),
    ).toBeInTheDocument()
  })

  it('offers a skip link as the first focusable element', async () => {
    installFakeApi({ me: null })
    renderAt('/')

    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
  })

  it('shows no connection badge on the welcome screen', async () => {
    installFakeApi({ me: null })
    renderAt('/')

    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
    expect(screen.queryByText('Checking connection…')).not.toBeInTheDocument()
  })

  it('renders the shell around an unknown route instead of going blank', async () => {
    installFakeApi({ me: null })
    renderAt('/this/route/does/not/exist')

    expect(screen.getByRole('link', { name: /cadence/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /couldn't find that screen/i }),
    ).toBeInTheDocument()
  })

  it('exposes exactly one level-one heading per screen', async () => {
    installFakeApi({ me: TEST_USER })
    renderAt('/today')

    expect(await screen.findByRole('heading', { level: 1, name: /your day/i })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('reports a lost connection without breaking the screen', async () => {
    installFakeApi({ me: TEST_USER })
    renderAt('/today')
    await screen.findByText('Connected')

    const { act } = await import('@testing-library/react')
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(await screen.findByText(/you are offline/i)).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument()
  })

  it('sends a signed-out visitor nowhere near the app tabs', async () => {
    installFakeApi({ me: null })
    renderAt('/')

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: /get started/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /build a plan/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })
})

describe('sign-up screen', () => {
  it('creates the account and lands on today', async () => {
    const fetchMock = installFakeApi({ me: null, onSignup: () => signedInPayload() })
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Create password'), 'correct horse battery')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /your day/i })).toBeInTheDocument()

    const signupCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/signup'))
    expect(signupCall).toBeDefined()
    expect(JSON.parse(String(signupCall?.[1]?.body))).toMatchObject({
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('submits once even when the button is tapped twice', async () => {
    const fetchMock = installFakeApi({ me: null, onSignup: () => signedInPayload() })
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Create password'), 'correct horse battery')

    const submit = screen.getByRole('button', { name: /create account/i })
    await userEvent.dblClick(submit)

    await screen.findByRole('heading', { level: 1, name: /your day/i })

    const signupCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/signup'))
    expect(signupCalls).toHaveLength(1)
  })

  it('shows per-field messages without calling the API when the form is wrong', async () => {
    const fetchMock = installFakeApi({ me: null })
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Email address'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument()
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/signup'))).toBe(false)
  })

  it('maps a server validation error onto the right field', async () => {
    installFakeApi({
      me: null,
      onSignup: () =>
        json(
          {
            detail: [
              { loc: ['body', 'email'], msg: 'Value error, please enter a valid email address' },
            ],
          },
          422,
        ),
    })
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Create password'), 'correct horse battery')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('please enter a valid email address')).toBeInTheDocument()
  })

  it('reports a taken email without a stack trace', async () => {
    installFakeApi({ me: null })
    renderAt('/signup')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Create password'), 'correct horse battery')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText(/an account with that email already exists/i),
    ).toBeInTheDocument()
  })
})

describe('log-in screen', () => {
  it('signs in and lands on today', async () => {
    installFakeApi({ me: null, onLogin: () => signedInPayload() })
    renderAt('/login')

    await userEvent.type(await screen.findByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery')
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /your day/i })).toBeInTheDocument()
  })

  it('shows a single, non-revealing message for bad credentials', async () => {
    installFakeApi({ me: null })
    renderAt('/login')

    await userEvent.type(await screen.findByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password')
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }))

    expect(await screen.findByText(/that email and password do not match/i)).toBeInTheDocument()
  })

  it('requires both fields before calling the API', async () => {
    const fetchMock = installFakeApi({ me: null })
    renderAt('/login')

    await userEvent.click(await screen.findByRole('button', { name: /^log in$/i }))

    expect(await screen.findByText(/please enter your email address/i)).toBeInTheDocument()
    expect(screen.getByText(/please enter your password/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/login'))).toBe(false)
  })
})

describe('the auth gate', () => {
  it('sends a signed-out visitor from an app route to the log-in screen', async () => {
    installFakeApi({ me: null })
    renderAt('/progress')

    expect(
      await screen.findByRole('heading', { level: 1, name: /pick up where you left off/i }),
    ).toBeInTheDocument()
  })

  it('returns a signed-in visitor from the log-in screen to the app', async () => {
    installFakeApi({ me: TEST_USER })
    renderAt('/login')

    expect(await screen.findByRole('heading', { level: 1, name: /your day/i })).toBeInTheDocument()
  })

  it('shows the primary navigation only for signed-in users', async () => {
    installFakeApi({ me: TEST_USER })
    renderAt('/today')

    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })

  it('signs out from the profile screen and returns to the welcome screen', async () => {
    installFakeApi({ me: TEST_USER })
    renderAt('/profile')

    await userEvent.click(await screen.findByRole('button', { name: /log out/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /exercise that keeps pace/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })
})
