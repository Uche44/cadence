import { Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthProvider'
import { PublicOnly, RequireAuth } from './auth/guards'
import { OnboardingProvider } from './onboarding/OnboardingProvider'
import { OnboardingIndex, RequireReady, StepGate } from './onboarding/guards'
import { AppShell } from './shell/AppShell'
import { Checkin } from './routes/Checkin'
import { DesignSystem } from './routes/DesignSystem'
import { LogIn } from './routes/LogIn'
import { NotFound } from './routes/NotFound'
import { Plan } from './routes/Plan'
import { Profile } from './routes/Profile'
import { Progress } from './routes/Progress'
import { SignUp } from './routes/SignUp'
import { Today } from './routes/Today'
import { Welcome } from './routes/Welcome'
import { ConsentStep } from './routes/onboarding/ConsentStep'
import { HealthStep } from './routes/onboarding/HealthStep'
import { InterestsStep } from './routes/onboarding/InterestsStep'
import { RoutineStep } from './routes/onboarding/RoutineStep'

export function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
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
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingIndex />
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding/health"
              element={
                <RequireAuth>
                  <StepGate step={1}>
                    <HealthStep />
                  </StepGate>
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding/interests"
              element={
                <RequireAuth>
                  <StepGate step={2}>
                    <InterestsStep />
                  </StepGate>
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding/routine"
              element={
                <RequireAuth>
                  <StepGate step={3}>
                    <RoutineStep />
                  </StepGate>
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding/consent"
              element={
                <RequireAuth>
                  <StepGate step={4}>
                    <ConsentStep />
                  </StepGate>
                </RequireAuth>
              }
            />
            <Route
              path="/today"
              element={
                <RequireAuth>
                  <RequireReady>
                    <Today />
                  </RequireReady>
                </RequireAuth>
              }
            />
            <Route
              path="/checkin"
              element={
                <RequireAuth>
                  <RequireReady>
                    <Checkin />
                  </RequireReady>
                </RequireAuth>
              }
            />
            <Route
              path="/plan"
              element={
                <RequireAuth>
                  <RequireReady>
                    <Plan />
                  </RequireReady>
                </RequireAuth>
              }
            />
            <Route
              path="/progress"
              element={
                <RequireAuth>
                  <RequireReady>
                    <Progress />
                  </RequireReady>
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <RequireReady>
                    <Profile />
                  </RequireReady>
                </RequireAuth>
              }
            />
            <Route path="/design" element={<DesignSystem />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </OnboardingProvider>
    </AuthProvider>
  )
}
