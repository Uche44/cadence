import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { TEST_USER, completeOnboarding, incompleteOnboarding, installFakeApi } from './test/fakeApi'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the onboarding gate', () => {
  it('sends a signed-in user who has not finished setup to step one', async () => {
    installFakeApi({ me: TEST_USER, onboarding: incompleteOnboarding(0) })
    renderAt('/today')

    expect(
      await screen.findByRole('heading', { level: 1, name: /what conditions are we caring for/i }),
    ).toBeInTheDocument()
  })

  it('resumes at the first unfinished step after a refresh', async () => {
    installFakeApi({
      me: TEST_USER,
      onboarding: incompleteOnboarding(
        1,
        {},
        { conditions: ['Type 2 diabetes'], doctor_clearance: true },
      ),
    })
    renderAt('/onboarding')

    expect(
      await screen.findByRole('heading', { level: 1, name: /what movement brings you joy/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /step 2 of 4/i })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
  })

  it('does not let a later step open before the earlier ones', async () => {
    installFakeApi({ me: TEST_USER, onboarding: incompleteOnboarding(0) })
    renderAt('/onboarding/routine')

    expect(
      await screen.findByRole('heading', { level: 1, name: /what conditions are we caring for/i }),
    ).toBeInTheDocument()
  })
})

describe('health step', () => {
  it('surfaces conservative mode when an unauthored condition is chosen', async () => {
    installFakeApi({ me: TEST_USER, onboarding: incompleteOnboarding(0) })
    renderAt('/onboarding/health')

    await userEvent.click(await screen.findByRole('checkbox', { name: /other chronic condition/i }))

    expect(await screen.findByText(/confirm with your doctor/i)).toBeInTheDocument()
  })

  it('needs a clearance answer before continuing', async () => {
    installFakeApi({ me: TEST_USER, onboarding: incompleteOnboarding(0) })
    renderAt('/onboarding/health')

    await userEvent.click(await screen.findByRole('checkbox', { name: /type 2 diabetes/i }))

    const continueButton = screen.getByRole('button', { name: /continue to step 2/i })
    expect(continueButton).toBeDisabled()

    await userEvent.click(screen.getByRole('radio', { name: 'Yes' }))
    expect(continueButton).toBeEnabled()

    await userEvent.click(continueButton)
    expect(
      await screen.findByRole('heading', { level: 1, name: /what movement brings you joy/i }),
    ).toBeInTheDocument()
  })
})

describe('interests step', () => {
  it('refuses to continue with fewer than three choices', async () => {
    installFakeApi({
      me: TEST_USER,
      onboarding: incompleteOnboarding(1, {}, { interests: [] }),
    })
    renderAt('/onboarding/interests')

    await userEvent.click(await screen.findByRole('checkbox', { name: /music & dancing/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /gardening/i }))

    expect(screen.getByText(/choose 1 more to continue/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to step 3/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /walking in nature/i }))
    expect(screen.getByRole('button', { name: /continue to step 3/i })).toBeEnabled()
  })
})

describe('consent step', () => {
  it('will not record agreement until the box is checked', async () => {
    installFakeApi({ me: TEST_USER, onboarding: incompleteOnboarding(3) })
    renderAt('/onboarding/consent')

    const agree = await screen.findByRole('button', { name: /i understand & agree/i })
    expect(agree).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /i understand cadence adapts/i }))
    expect(agree).toBeEnabled()

    await userEvent.click(agree)
    expect(
      await screen.findByRole('heading', { level: 1, name: /your day, at your pace/i }),
    ).toBeInTheDocument()
  })
})

describe('the clearance gate in the app', () => {
  it('shows an explanation instead of a plan when clearance is missing', async () => {
    installFakeApi({
      me: TEST_USER,
      onboarding: completeOnboarding(
        {
          planning: {
            ready: false,
            blocked_reason: 'doctor_clearance',
            message:
              'Your doctor has not cleared you for light exercise yet. This is not an error — it is a safety step.',
          },
        },
        { conditions: ['Hypertension'], doctor_clearance: false },
      ),
    })
    renderAt('/today')

    expect(
      await screen.findByRole('heading', { name: /we need your doctor's clearance first/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/not an error/i)).toBeInTheDocument()
    expect(screen.queryByText(/after your morning check-in/i)).not.toBeInTheDocument()
  })
})
