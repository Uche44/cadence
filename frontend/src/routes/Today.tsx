export function Today() {
  return (
    <div className="flex flex-col gap-4 py-3">
      <p className="text-label-md text-accent-strong">Today</p>
      <h1 className="text-display-mobile">Your day, at your pace</h1>
      <p className="text-body-md text-muted">
        Your daily plan will appear here after your morning check-in.
      </p>
    </div>
  )
}
