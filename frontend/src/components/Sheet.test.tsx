import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Sheet } from './Sheet'

function Harness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Day didn't go as planned?">
        <button type="button">Inside A</button>
        <button type="button">Inside B</button>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(
      <Sheet open={false} onClose={() => undefined} title="Closed">
        <p>Body</p>
      </Sheet>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a modal dialog named by its title', () => {
    render(
      <Sheet open onClose={() => undefined} title="Day didn't go as planned?">
        <p>Body</p>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog', { name: "Day didn't go as planned?" })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Closable">
        <p>Body</p>
      </Sheet>,
    )

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes from the close button and the backdrop', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Closable">
        <p>Body</p>
      </Sheet>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Closable' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('moves focus inside when it opens', () => {
    render(
      <Sheet open onClose={() => undefined} title="Focused">
        <button type="button">Inside</button>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('keeps Tab inside the dialog', async () => {
    render(
      <Sheet open onClose={() => undefined} title="Trapped">
        <button type="button">Inside A</button>
        <button type="button">Inside B</button>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog')
    const insideB = screen.getByRole('button', { name: 'Inside B' })
    insideB.focus()

    await userEvent.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)

    await userEvent.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})

describe('Sheet focus restoration', () => {
  it('returns focus to whatever opened it', async () => {
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})
