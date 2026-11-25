import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  fetchMe,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
} from '../api/auth'
import type { AuthUser } from '../api/auth'
import { AuthContext } from './context'
import type { AuthContextValue, AuthStatus } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let live = true

    fetchMe()
      .then((found) => {
        if (!live) return
        setUser(found)
        setStatus(found ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        // A failed session check must not strand the app on a spinner.
        if (live) setStatus('anonymous')
      })

    return () => {
      live = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInRequest({ email, password })
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const signUp = useCallback(async (displayName: string, email: string, password: string) => {
    const result = await signUpRequest({ displayName, email, password })
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await signOutRequest()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
