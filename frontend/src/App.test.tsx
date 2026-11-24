import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on the welcome screen', () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { level: 1, name: /exercise that keeps pace/i }),
    ).toBeInTheDocument()
  })

  it('offers a skip link as the first focusable element', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
  })

  it('exposes exactly one level-one heading per screen', () => {
    renderAt('/today')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('shows primary navigation only on the four destinations', () => {
    renderAt('/')

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })

  it('shows primary navigation on a destination', async () => {
    renderAt('/')

    await userEvent.click(screen.getByRole('link', { name: /get started/i }))

    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('renders the shell around an unknown route instead of going blank', () => {
    renderAt('/this/route/does/not/exist')

    expect(screen.getByRole('link', { name: /cadence/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /couldn't find that screen/i }),
    ).toBeInTheDocument()
  })

  it('reports connected when the API answers', async () => {
    renderAt('/today')

    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('stays usable and says so when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    renderAt('/today')

    expect(await screen.findByText('Working offline')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('banners the app when the browser loses connectivity', async () => {
    renderAt('/today')

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(await screen.findByText(/you are offline/i)).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument()
  })
})
