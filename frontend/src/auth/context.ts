import { createContext, useContext } from 'react'

import type { AuthUser } from '../api/auth'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  signIn: (email: string, password: string) => Promise<AuthUser>
  signUp: (displayName: string, email: string, password: string) => Promise<AuthUser>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
