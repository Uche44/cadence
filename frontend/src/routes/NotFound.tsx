import { Link } from 'react-router-dom'

import { pillButtonClasses } from '../components/buttonStyles'

export function NotFound() {
  return (
    <div className="page">
      <p className="page__eyebrow type-label-md">Nothing here</p>
      <h1 className="type-display-mobile">Couldn&apos;t find that screen.</h1>
      <p className="type-body-md muted">
        The link may be out of date. Your plan is still where you left it.
      </p>
      <Link to="/today" className={pillButtonClasses({ fullWidth: true })}>
        Back to today
      </Link>
    </div>
  )
}
