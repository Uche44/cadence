import { Link } from 'react-router-dom'

import { pillButtonClasses } from '../components/buttonStyles'

export function NotFound() {
  return (
    <div className="flex flex-col gap-4 py-3">
      <p className="text-label-md text-accent-strong">Nothing here</p>
      <h1 className="text-display-mobile">Couldn&apos;t find that screen.</h1>
      <p className="text-body-md text-muted">
        The link may be out of date. Your plan is still where you left it.
      </p>
      <Link to="/today" className={pillButtonClasses({ fullWidth: true })}>
        Back to today
      </Link>
    </div>
  )
}
