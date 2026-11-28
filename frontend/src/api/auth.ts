/** Account API client. */

export interface AuthUser {
  id: string
  email: string
  displayName: string
}

interface ApiUser {
  id: string
  email: string
  display_name: string
}

interface AuthPayload {
  user: ApiUser
  redirect_to: string
}

export interface AuthResult {
  user: AuthUser
  redirectTo: string
}

const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const VALIDATION_FAILURE = 'Please check the details above.'

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function toUser(user: ApiUser): AuthUser {
  return { id: user.id, email: user.email, displayName: user.display_name }
}

function cleanMessage(value: string): string {
  return value.replace(/^Value error,\s*/i, '')
}

/** Turn a FastAPI error body into a message plus per-field messages. */
export function describeError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail

    if (typeof detail === 'string') {
      return new ApiError(status, detail)
    }

    if (Array.isArray(detail)) {
      const fieldErrors: Record<string, string> = {}
      for (const item of detail) {
        if (!item || typeof item !== 'object') continue
        const entry = item as { loc?: unknown; msg?: unknown }
        const location = Array.isArray(entry.loc) ? entry.loc : []
        const field = location.length > 1 ? String(location[1]) : '_'
        const message = typeof entry.msg === 'string' ? cleanMessage(entry.msg) : GENERIC_FAILURE
        if (!fieldErrors[field]) fieldErrors[field] = message
      }
      return new ApiError(status, VALIDATION_FAILURE, fieldErrors)
    }
  }

  return new ApiError(status, GENERIC_FAILURE)
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw describeError(response.status, body)
  }

  return body as T
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return toUser(await request<ApiUser>('/api/auth/me'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export async function signUp(input: {
  displayName: string
  email: string
  password: string
}): Promise<AuthResult> {
  const payload = await request<AuthPayload>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      display_name: input.displayName,
      email: input.email,
      password: input.password,
    }),
  })

  return { user: toUser(payload.user), redirectTo: payload.redirect_to }
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const payload = await request<AuthPayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: input.email, password: input.password }),
  })

  return { user: toUser(payload.user), redirectTo: payload.redirect_to }
}

export async function signOut(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' })
}
