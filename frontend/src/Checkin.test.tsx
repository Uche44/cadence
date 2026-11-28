import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { TEST_USER, completeOnboarding, installFakeApi } from './test/fakeApi'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function setTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function addCommitment(label: string, start: string, end: string) {
  await userEvent.type(screen.getByLabelText(/what is it/i), label)
  setTime('Starts', start)
  setTime('Ends', end)
  await userEvent.click(screen.getByRole('button', { name: /add commitment/i }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('morning check-in', () => {
  it('requires an energy choice before the day can be saved', async () => {
    installFakeApi({ me: TEST_USER, onboarding: completeOnboarding() })
    renderAt('/checkin')

    expect(
      await screen.findByRole('heading', { level: 1, name: /good morning/i }),
    ).toBeInTheDocument()

    const save = screen.getByRole('button', { name: /save today's check-in/i })
    expect(save).toBeDisabled()
    expect(screen.getByText(/choose how your energy feels/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /steady/i }))

    expect(save).toBeEnabled()
    expect(screen.queryByText(/choose how your energy feels/i)).not.toBeInTheDocument()
  })

  it('shows the stop state as soon as a red-flag symptom is selected', async () => {
    installFakeApi({ me: TEST_USER, onboarding: completeOnboarding() })
    renderAt('/checkin')

    await userEvent.click(await screen.findByRole('button', { name: /chest pain or pressure/i }))

    expect(await screen.findByRole('heading', { name: /stop for today/i })).toBeInTheDocument()
    expect(screen.getByText(/no exercise will be suggested today/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save and rest today/i })).toBeInTheDocument()
    expect(screen.queryByText(/build my plan/i)).not.toBeInTheDocument()
  })

  it('updates the free-window preview when a commitment is added', async () => {
    installFakeApi({ me: TEST_USER, onboarding: completeOnboarding() })
    renderAt('/checkin')

    expect(await screen.findByText('6:30 AM – 10:15 PM')).toBeInTheDocument()

    await addCommitment('School run', '09:00', '10:00')

    expect(await screen.findByText('6:30 AM – 9:00 AM')).toBeInTheDocument()
    expect(screen.getByText('10:00 AM – 10:15 PM')).toBeInTheDocument()
  })

  it('lets a commitment be edited and deleted without reloading', async () => {
    installFakeApi({ me: TEST_USER, onboarding: completeOnboarding() })
    renderAt('/checkin')

    await screen.findByText('6:30 AM – 10:15 PM')
    await addCommitment('School run', '09:00', '10:00')
    expect(await screen.findByText('School run')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const label = screen.getByLabelText(/what is it/i)
    await userEvent.clear(label)
    await userEvent.type(label, 'School run and drop-off')
    await userEvent.click(screen.getByRole('button', { name: /save change/i }))

    expect(await screen.findByText('School run and drop-off')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/no fixed commitments yet/i)).toBeInTheDocument()
    expect(await screen.findByText('6:30 AM – 10:15 PM')).toBeInTheDocument()
  })

  it('saves the check-in and returns to today', async () => {
    installFakeApi({ me: TEST_USER, onboarding: completeOnboarding() })
    renderAt('/checkin')

    await screen.findByRole('heading', { level: 1, name: /good morning/i })
    await userEvent.click(screen.getByRole('radio', { name: /steady/i }))
    await userEvent.type(screen.getByLabelText(/notes \(optional\)/i), 'A late night.')
    await userEvent.click(screen.getByRole('button', { name: /save today's check-in/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /your day, at your pace/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /morning check-in/i })).toBeInTheDocument()
  })
})
