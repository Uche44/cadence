import { useEffect, useState } from 'react'

/**
 * Browser connectivity.
 *
 * Deliberately optimistic on the server and in tests (where `navigator.onLine`
 * is true); the events then track the real state. This drives an honest
 * "offline" label rather than a spinner that never resolves.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
