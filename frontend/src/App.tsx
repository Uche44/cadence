import { Route, Routes } from 'react-router-dom'

import { NotFound } from './routes/NotFound'
import { Today } from './routes/Today'
import { AppShell } from './shell/AppShell'

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
