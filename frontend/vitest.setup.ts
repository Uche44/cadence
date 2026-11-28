import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The full suite renders several screens that each make a request before the
// first meaningful paint. Three seconds keeps a busy worker from turning a
// correct screen into a flaky failure.
configure({ asyncUtilTimeout: 3000 })

// Vitest runs without injected globals, so Testing Library's automatic cleanup
// does not register itself. Doing it explicitly keeps every test isolated.
afterEach(() => {
  cleanup()
})
