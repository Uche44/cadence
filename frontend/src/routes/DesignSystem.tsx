import { useState } from 'react'
import type { ReactNode } from 'react'

import { BottomNav } from '../components/BottomNav'
import { Card, CardBody, CardTitle } from '../components/Card'
import { Chip, Tag } from '../components/Chip'
import { Input } from '../components/Input'
import { PillButton } from '../components/PillButton'
import { Sheet } from '../components/Sheet'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { Toggle } from '../components/Toggle'
import { BoltIcon, HeartIcon, LeafIcon, PlusIcon, ShieldIcon } from '../components/icons'
import { cn } from '../lib/cn'
import { COLOR_TOKENS } from '../styles/colorTokens'

const TYPE_SCALE = [
  { className: 'text-display', name: 'display', meta: '36 / 44 · 700 · -0.02em' },
  { className: 'text-display-mobile', name: 'display-mobile', meta: '28 / 36 · 700' },
  { className: 'text-headline-lg', name: 'headline-lg', meta: '24 / 32 · 700' },
  { className: 'text-headline-md', name: 'headline-md', meta: '20 / 28 · 600' },
  { className: 'text-headline-sm', name: 'headline-sm', meta: '18 / 24 · 600' },
  { className: 'text-body-lg', name: 'body-lg', meta: '16 / 24 · 500' },
  { className: 'text-body-md', name: 'body-md', meta: '14 / 20 · 400' },
  { className: 'text-body-sm', name: 'body-sm', meta: '13 / 18 · 400' },
  { className: 'text-label-lg', name: 'label-lg', meta: '14 / 20 · 600' },
  { className: 'text-label-md', name: 'label-md', meta: '12 / 16 · 600 · 0.02em' },
  { className: 'text-label-sm', name: 'label-sm', meta: '11 / 14 · 500' },
] as const

const RADII = [
  { className: 'rounded-sm', name: 'sm · 0.5rem' },
  { className: 'rounded-md', name: 'md · 1rem' },
  { className: 'rounded-lg', name: 'lg · 1.5rem' },
  { className: 'rounded-xl', name: 'xl · 2rem' },
  { className: 'rounded-2xl', name: '2xl · 3rem' },
  { className: 'rounded-pill', name: 'pill' },
] as const

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-headline-md">{title}</h2>
        {note ? <span className="text-body-sm text-muted">{note}</span> : null}
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-label-md text-muted">Design system</p>
        <h1 className="text-display-mobile">Serene Pebble</h1>
        <p className="text-body-md text-muted">
          Every token and primitive this product uses, in every state.
        </p>
      </header>

      <Section title="Colour" note="Tailwind theme in index.css">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
          {COLOR_TOKENS.map((token) => (
            <div key={token} className="flex flex-col gap-1 rounded-md bg-surface p-2 shadow-card">
              <span
                className="h-10 rounded-sm border border-outline"
                style={{ background: `var(${token})` }}
              />
              <span className="text-label-sm text-ink">{token.replace('--color-', '')}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale" note="Nunito, self-hosted">
        <div className="flex flex-col gap-3">
          {TYPE_SCALE.map(({ className, name, meta }) => (
            <div
              key={name}
              className="flex flex-col gap-1 border-b border-canvas-sunken pb-3 last:border-0"
            >
              <span className={className}>Gentle movement, at your pace</span>
              <span className="text-label-sm text-muted">
                {name} · {meta}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii and elevation">
        <div className="flex flex-wrap items-end gap-3">
          {RADII.map(({ className, name }) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <span className={cn('block size-16 bg-lavender', className)} />
              <span className="text-label-sm text-muted">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex h-20 flex-1 items-center justify-center rounded-lg bg-surface text-label-md shadow-card">
            shadow-card
          </div>
          <div className="flex h-20 flex-1 items-center justify-center rounded-lg bg-ink text-label-md text-on-ink shadow-nav">
            shadow-nav
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <PillButton>Primary</PillButton>
            <PillButton variant="secondary">Secondary</PillButton>
            <PillButton variant="ghost">Ghost</PillButton>
            <PillButton variant="danger">Danger</PillButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge>Neutral</StatusBadge>
          <StatusBadge tone="success">Completed</StatusBadge>
          <StatusBadge tone="warning">Skipped gently</StatusBadge>
          <StatusBadge tone="danger">Stop</StatusBadge>
          <StatusBadge tone="info">Gentle pace</StatusBadge>
        </div>
      </Section>

      <Section title="Stat tiles">
        <div className="flex flex-wrap gap-3">
          <StatTile label="Active time" value="84 min" caption="This week" tone="mint" />
          <StatTile label="Sessions" value="11" caption="Completed gently" tone="lavender" />
          <StatTile label="Pacing" value="92%" caption="Honoured" tone="apricot" />
        </div>
      </Section>

      <Section title="Cards">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Surface card</CardTitle>
            <CardBody>Soft ambient shadow, no border.</CardBody>
          </Card>
          <Card tone="lavender">
            <CardTitle>Lavender</CardTitle>
            <CardBody>Mindfulness and daily focus.</CardBody>
          </Card>
          <Card tone="apricot">
            <CardTitle>Apricot</CardTitle>
            <CardBody>Energy and daytime sessions.</CardBody>
          </Card>
          <Card tone="mint">
            <CardTitle>Mint</CardTitle>
            <CardBody>Completed milestones.</CardBody>
          </Card>
          <Card tone="sky">
            <CardTitle>Sky</CardTitle>
            <CardBody>Balance and breathing.</CardBody>
          </Card>
          <Card tone="blush">
            <CardTitle>Blush</CardTitle>
            <CardBody>Restorative care.</CardBody>
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
          <p className="text-body-md text-muted">
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
