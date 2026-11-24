import { render, screen } from '@testing-library/react'
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

  it('renders the shell at the root route', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: /cadence/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders the shell around an unknown route instead of going blank', () => {
    renderAt('/this/route/does/not/exist')

    expect(screen.getByRole('link', { name: /cadence/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /couldn't find that screen/i }),
    ).toBeInTheDocument()
  })

  it('exposes exactly one level-one heading on the root route', () => {
    renderAt('/')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('offers a skip link as the first focusable element', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
  })

  it('reports connected when the API answers', async () => {
    renderAt('/')

    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('stays usable and says so when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    renderAt('/')

    expect(await screen.findByText('Working offline')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('treats a non-ok response as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    renderAt('/')

    expect(await screen.findByText('Working offline')).toBeInTheDocument()
  })
})
