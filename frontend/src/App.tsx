import { Route, Routes } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
import { DesignSystem } from './routes/DesignSystem'
import { NotFound } from './routes/NotFound'
import { Plan } from './routes/Plan'
import { Profile } from './routes/Profile'
import { Progress } from './routes/Progress'
import { Today } from './routes/Today'
import { Welcome } from './routes/Welcome'

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/today" element={<Today />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/design" element={<DesignSystem />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
