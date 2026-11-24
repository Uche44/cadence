import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BottomNav } from './BottomNav'

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <BottomNav />
      <Routes>
        <Route path="/today" element={<p>Today page</p>} />
        <Route path="/plan" element={<p>Plan page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('offers exactly four destinations', () => {
    renderNav()

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.textContent)).toEqual(['Today', 'Plan', 'Progress', 'Profile'])
  })

  it('marks the current destination for assistive technology', () => {
    renderNav()

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Plan' })).not.toHaveAttribute('aria-current')
  })

  it('moves the current marker when the route changes', async () => {
    renderNav()

    await userEvent.click(screen.getByRole('link', { name: 'Plan' }))

    expect(await screen.findByText('Plan page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  it('is named as primary navigation', () => {
    renderNav()

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })
})
