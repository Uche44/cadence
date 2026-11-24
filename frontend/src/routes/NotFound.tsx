import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="card" aria-labelledby="not-found-heading">
      <p className="eyebrow">Nothing here</p>
      <h1 id="not-found-heading">Couldn&apos;t find that screen.</h1>
      <p className="body">The link may be out of date. Your plan is still where you left it.</p>
      <Link to="/" className="button">
        Back to today
      </Link>
    </section>
  )
}
