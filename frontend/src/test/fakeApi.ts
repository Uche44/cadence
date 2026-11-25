import { vi } from 'vitest'

import type { AuthUser } from '../api/auth'

export const TEST_USER: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

interface FakeApiOptions {
  /** Who the session check should report. `null` means signed out. */
  me?: AuthUser | null
  onLogin?: () => Response
  onSignup?: () => Response
}

/**
 * A small stand-in for the API, so screen tests exercise real request shapes
 * instead of mocking the client module out of existence.
 */
export function installFakeApi({ me = null, onLogin, onSignup }: FakeApiOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (url.includes('/api/health')) {
      return json({ status: 'ok', version: '0.1.0', server_time: 'now' })
    }

    if (url.includes('/api/auth/me')) {
      return me
        ? json({ id: me.id, email: me.email, display_name: me.displayName })
        : json({ detail: 'Sign in to continue.' }, 401)
    }

    if (url.includes('/api/auth/login') && method === 'POST') {
      return onLogin ? onLogin() : json({ detail: 'That email and password do not match.' }, 401)
    }

    if (url.includes('/api/auth/signup') && method === 'POST') {
      return onSignup
        ? onSignup()
        : json({ detail: 'An account with that email already exists.' }, 409)
    }

    if (url.includes('/api/auth/logout') && method === 'POST') {
      return noContent()
    }

    return json({ detail: 'not found' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function signedInPayload(user: AuthUser = TEST_USER): Response {
  return json({
    user: { id: user.id, email: user.email, display_name: user.displayName },
    redirect_to: '/today',
  })
}
