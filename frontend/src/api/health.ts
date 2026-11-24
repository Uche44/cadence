import { useEffect, useState } from 'react'

export type HealthState = 'checking' | 'connected' | 'unavailable'

const LABELS: Record<HealthState, string> = {
  checking: 'Checking connection…',
  connected: 'Connected',
  unavailable: 'Working offline',
}

export interface Health {
  state: HealthState
  label: string
}

/**
 * Reports whether the API is reachable.
 *
 * The shell must never depend on the API being up: this exists so that an
 * unreachable backend shows an honest label instead of an empty screen.
 */
export function useHealth(): Health {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    let live = true

    const settle = (next: HealthState) => {
      if (live) {
        setState(next)
      }
    }

    fetch('/api/health', { signal: controller.signal })
      .then((response) => settle(response.ok ? 'connected' : 'unavailable'))
      .catch(() => settle('unavailable'))

    return () => {
      live = false
      controller.abort()
    }
  }, [])

  return { state, label: LABELS[state] }
}
