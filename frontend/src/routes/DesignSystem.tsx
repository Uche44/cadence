import { useState } from 'react'

import { COLOR_TOKENS } from '../styles/colorTokens'

import { BottomNav } from '../components/BottomNav'
import { Card } from '../components/Card'
import { Chip, Tag } from '../components/Chip'
import { Input } from '../components/Input'
import { PillButton } from '../components/PillButton'
import { Sheet } from '../components/Sheet'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { Toggle } from '../components/Toggle'
import { BoltIcon, HeartIcon, LeafIcon, PlusIcon, ShieldIcon } from '../components/icons'

const TYPE_SCALE = [
  { className: 'type-display', name: 'display-lg', meta: '36 / 44 · 700 · -0.02em' },
  { className: 'type-display-mobile', name: 'display-lg-mobile', meta: '28 / 36 · 700' },
  { className: 'type-headline-lg', name: 'headline-lg', meta: '24 / 32 · 700' },
  { className: 'type-headline-md', name: 'headline-md', meta: '20 / 28 · 600' },
  { className: 'type-headline-sm', name: 'headline-sm', meta: '18 / 24 · 600' },
  { className: 'type-body-lg', name: 'body-lg', meta: '16 / 24 · 500' },
  { className: 'type-body-md', name: 'body-md', meta: '14 / 20 · 400' },
  { className: 'type-body-sm', name: 'body-sm', meta: '13 / 18 · 400' },
  { className: 'type-label-lg', name: 'label-lg', meta: '14 / 20 · 600' },
  { className: 'type-label-md', name: 'label-md', meta: '12 / 16 · 600 · 0.02em' },
  { className: 'type-label-sm', name: 'label-sm', meta: '11 / 14 · 500' },
] as const

function readTokenValues(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  const computed = getComputedStyle(document.documentElement)
  const resolved: Record<string, string> = {}
  for (const token of COLOR_TOKENS) {
    resolved[token] = computed.getPropertyValue(token).trim()
  }
  return resolved
}

function TokenSwatches() {
  // Read once, on mount. Stylesheets are render-blocking in the built app, so
  // the values are resolved by the time this runs.
  const [values] = useState(readTokenValues)

  return (
    <div className="design__swatches">
      {COLOR_TOKENS.map((token) => (
        <div key={token} className="swatch">
          <span className="swatch__chip" style={{ background: `var(${token})` }} />
          <span className="swatch__name">{token.replace('--color-', '')}</span>
          <span className="swatch__value">{values[token] || '—'}</span>
        </div>
      ))}
    </div>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="design__section">
      <div className="design__heading">
        <h2>{title}</h2>
        {note ? <span className="design__note">{note}</span> : null}
      </div>
      {children}
    </section>
  )
}

export function DesignSystem() {
  const [selected, setSelected] = useState<readonly string[]>(['Gentle', 'Music'])
  const [reminders, setReminders] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const toggleSelection = (label: string) => {
    setSelected((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    )
  }

  return (
    <div className="design">
      <header>
        <p className="type-label-md muted">Design system</p>
        <h1 className="type-display-mobile">Serene Pebble</h1>
        <p className="type-body-md muted">
          Every token and primitive this product uses, in every state.
        </p>
      </header>

      <Section title="Colour" note="tokens.css is the only home for literal values">
        <TokenSwatches />
      </Section>

      <Section title="Type scale" note="Nunito, self-hosted">
        <div className="design__stack">
          {TYPE_SCALE.map(({ className, name, meta }) => (
            <div key={name} className="design__type-row">
              <span className={className}>Gentle movement, at your pace</span>
              <span className="design__type-meta">
                {name} · {meta}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="design__stack">
          <div className="design__row">
            <PillButton>Primary</PillButton>
            <PillButton variant="secondary">Secondary</PillButton>
            <PillButton variant="ghost">Ghost</PillButton>
            <PillButton variant="danger">Danger</PillButton>
          </div>
          <div className="design__row">
            <PillButton size="lg" icon={<BoltIcon width={18} height={18} />}>
              Large with icon
            </PillButton>
            <PillButton disabled>Disabled</PillButton>
            <PillButton variant="secondary" disabled icon={<PlusIcon width={18} height={18} />}>
              Disabled with icon
            </PillButton>
          </div>
          <PillButton fullWidth>Full width</PillButton>
        </div>
      </Section>

      <Section title="Chips and tags" note="selection is aria-pressed, not just colour">
        <div className="design__stack">
          <div className="design__row">
            {['Gentle', 'Music', 'Walking', 'Seated'].map((label) => (
              <Chip
                key={label}
                selected={selected.includes(label)}
                onClick={() => toggleSelection(label)}
              >
                {label}
              </Chip>
            ))}
          </div>
          <div className="design__row">
            <Tag tone="lavender">
              <HeartIcon width={16} height={16} aria-hidden="true" /> Lavender
            </Tag>
            <Tag tone="apricot">Apricot</Tag>
            <Tag tone="sky">Sky</Tag>
            <Tag tone="mint">Mint</Tag>
            <Tag tone="blush">Blush</Tag>
          </div>
        </div>
      </Section>

      <Section title="Fields">
        <div className="design__stack">
          <Input label="Full name" placeholder="e.g. Alex Rivera" icon={<LeafIcon />} />
          <Input
            label="Email address"
            type="email"
            defaultValue="alex@example.com"
            hint="We never share this."
          />
          <Input
            label="Password"
            type="password"
            defaultValue="short"
            error="Use at least 8 characters."
          />
          <Input label="Disabled" defaultValue="Not editable" disabled />
        </div>
      </Section>

      <Section title="Toggle">
        <div className="design__stack">
          <Toggle
            label="Gentle reminders"
            description="One nudge, never a nag."
            checked={reminders}
            onChange={setReminders}
          />
          <Toggle label="Disabled" checked={false} onChange={() => undefined} disabled />
        </div>
      </Section>

      <Section title="Status badges">
        <div className="design__row">
          <StatusBadge>Neutral</StatusBadge>
          <StatusBadge tone="success">Completed</StatusBadge>
          <StatusBadge tone="warning">Skipped gently</StatusBadge>
          <StatusBadge tone="danger">Stop</StatusBadge>
          <StatusBadge tone="info">Gentle pace</StatusBadge>
        </div>
      </Section>

      <Section title="Stat tiles">
        <div className="design__row">
          <StatTile label="Active time" value="84 min" caption="This week" tone="mint" />
          <StatTile label="Sessions" value="11" caption="Completed gently" tone="lavender" />
          <StatTile label="Pacing" value="92%" caption="Honoured" tone="apricot" />
        </div>
      </Section>

      <Section title="Cards">
        <div className="design__stack">
          <Card>
            <h3 className="card__title">Surface card</h3>
            <p className="card__body">Soft ambient shadow, no border.</p>
          </Card>
          <Card tone="lavender">
            <h3 className="card__title">Lavender</h3>
            <p className="card__body">Mindfulness and daily focus.</p>
          </Card>
          <Card tone="apricot">
            <h3 className="card__title">Apricot</h3>
            <p className="card__body">Energy and daytime sessions.</p>
          </Card>
          <Card tone="mint">
            <h3 className="card__title">Mint</h3>
            <p className="card__body">Completed milestones.</p>
          </Card>
          <Card tone="sky">
            <h3 className="card__title">Sky</h3>
            <p className="card__body">Balance and breathing.</p>
          </Card>
          <Card tone="blush">
            <h3 className="card__title">Blush</h3>
            <p className="card__body">Restorative care.</p>
          </Card>
        </div>
      </Section>

      <Section title="Bottom navigation" note="inline preview">
        <BottomNav variant="inline" />
      </Section>

      <Section title="Sheet" note="Escape closes, focus returns">
        <PillButton onClick={() => setSheetOpen(true)} icon={<ShieldIcon width={18} height={18} />}>
          Open sheet
        </PillButton>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Day didn't go as planned?"
        >
          <p className="type-body-md muted">
            No stress at all. Cadence recalibrates in seconds so your routine never feels like a
            burden.
          </p>
          <PillButton fullWidth onClick={() => setSheetOpen(false)}>
            Re-plan my day
          </PillButton>
        </Sheet>
      </Section>
    </div>
  )
}
