import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Card } from './Card'
import { Chip, Tag } from './Chip'
import { Input } from './Input'
import { PillButton } from './PillButton'
import { StatTile } from './StatTile'
import { StatusBadge } from './StatusBadge'
import { Toggle } from './Toggle'

function expectNoConsoleErrors(element: React.ReactElement) {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  render(element)
  expect(spy).not.toHaveBeenCalled()
}

describe('PillButton', () => {
  it('fires exactly once per click', async () => {
    const onClick = vi.fn()
    render(<PillButton onClick={onClick}>Save</PillButton>)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a submit-safe button by default', () => {
    render(<PillButton>Save</PillButton>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <PillButton onClick={onClick} disabled>
        Save
      </PillButton>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('activates by keyboard', async () => {
    const onClick = vi.fn()
    render(<PillButton onClick={onClick}>Save</PillButton>)

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)

    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('renders without console errors in every variant', () => {
    expectNoConsoleErrors(
      <div>
        <PillButton>Primary</PillButton>
        <PillButton variant="secondary">Secondary</PillButton>
        <PillButton variant="ghost">Ghost</PillButton>
        <PillButton variant="danger">Danger</PillButton>
      </div>,
    )
  })
})

describe('Chip', () => {
  it('exposes selection as a pressed state', async () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <Chip selected={false} onClick={onClick}>
        Music
      </Chip>,
    )

    const chip = screen.getByRole('button', { name: 'Music' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Chip selected onClick={onClick}>
        Music
      </Chip>,
    )
    expect(screen.getByRole('button', { name: /music/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a non-interactive tag without a button role', () => {
    render(<Tag tone="mint">Gentle · 8 min</Tag>)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Gentle · 8 min')).toBeInTheDocument()
  })
})

describe('Toggle', () => {
  it('is a switch that reports state and asks for the opposite', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Toggle
        label="Gentle reminders"
        description="One nudge."
        checked={false}
        onChange={onChange}
      />,
    )

    const toggle = screen.getByRole('switch', { name: 'Gentle reminders' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(
      <Toggle label="Gentle reminders" description="One nudge." checked onChange={onChange} />,
    )
    expect(screen.getByRole('switch', { name: 'Gentle reminders' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('does not fire when disabled', async () => {
    const onChange = vi.fn()
    render(<Toggle label="Disabled" checked={false} onChange={onChange} disabled />)

    await userEvent.click(screen.getByRole('switch', { name: 'Disabled' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Input', () => {
  it('associates its label with the field', () => {
    render(<Input label="Full name" />)

    expect(screen.getByLabelText('Full name')).toBeInstanceOf(HTMLInputElement)
  })

  it('describes the field with the hint', () => {
    render(<Input label="Email" hint="We never share this." />)

    const field = screen.getByLabelText('Email')
    const describedBy = field.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent('We never share this.')
  })

  it('announces an error and marks itself invalid', () => {
    render(<Input label="Password" error="Use at least 8 characters." />)

    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters.')
  })

  it('accepts typing', async () => {
    render(<Input label="Full name" />)

    await userEvent.type(screen.getByLabelText('Full name'), 'Alex')

    expect(screen.getByLabelText('Full name')).toHaveValue('Alex')
  })
})

describe('StatusBadge and StatTile', () => {
  it('renders status text', () => {
    render(<StatusBadge tone="success">Completed</StatusBadge>)

    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders a metric with its caption', () => {
    render(<StatTile label="Active time" value="84 min" caption="This week" tone="mint" />)

    expect(screen.getByText('Active time')).toBeInTheDocument()
    expect(screen.getByText('84 min')).toBeInTheDocument()
    expect(screen.getByText('This week')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children without console errors', () => {
    expectNoConsoleErrors(
      <Card tone="lavender">
        <p>Inside</p>
      </Card>,
    )
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })
})
