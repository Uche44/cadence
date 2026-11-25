import { Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthProvider'
import { PublicOnly, RequireAuth } from './auth/guards'
import { AppShell } from './shell/AppShell'
import { DesignSystem } from './routes/DesignSystem'
import { LogIn } from './routes/LogIn'
import { NotFound } from './routes/NotFound'
import { Plan } from './routes/Plan'
import { Profile } from './routes/Profile'
import { Progress } from './routes/Progress'
import { SignUp } from './routes/SignUp'
import { Today } from './routes/Today'
import { Welcome } from './routes/Welcome'

export function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route
            path="/signup"
            element={
              <PublicOnly>
                <SignUp />
              </PublicOnly>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LogIn />
              </PublicOnly>
            }
          />
          <Route
            path="/today"
            element={
              <RequireAuth>
                <Today />
              </RequireAuth>
            }
          />
          <Route
            path="/plan"
            element={
              <RequireAuth>
                <Plan />
              </RequireAuth>
            }
          />
          <Route
            path="/progress"
            element={
              <RequireAuth>
                <Progress />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="/design" element={<DesignSystem />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </AuthProvider>
  )
}
