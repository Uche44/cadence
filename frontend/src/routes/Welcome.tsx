import { Link } from 'react-router-dom'

import pebbles from '../assets/cadence-pebbles.png'
import { Tag } from '../components/Chip'
import { pillButtonClasses } from '../components/buttonStyles'
import {
  BoltIcon,
  ChevronRightIcon,
  HeartIcon,
  LeafIcon,
  ShieldIcon,
  SparkleIcon,
} from '../components/icons'
import { cn } from '../lib/cn'

const FEATURES = [
  { label: 'Energy-smart', Icon: BoltIcon },
  { label: 'Gentle flows', Icon: SparkleIcon },
  { label: 'Safe habits', Icon: ShieldIcon },
]

export function Welcome() {
  return (
    <section
      className="flex flex-col items-center gap-5 py-5 text-center"
      aria-labelledby="welcome-heading"
    >
      <div className="inline-flex items-center gap-3 rounded-pill bg-surface px-6 py-2 shadow-card">
        <LeafIcon width={22} height={22} aria-hidden="true" />
        <span className="text-display-mobile text-ink-heading">Cadence</span>
      </div>

      <h1 id="welcome-heading" className="max-w-[18ch] text-headline-lg font-semibold text-ink">
        Exercise that keeps pace with your life.
      </h1>

      <p className="inline-flex w-fit max-w-full items-center gap-2 rounded-pill bg-lavender-soft px-4 py-2 text-label-lg text-accent-strong">
        <LeafIcon width={16} height={16} aria-hidden="true" /> Your gentle companion for chronic
        wellness
      </p>

      <div className="flex w-full justify-center">
        <img
          src={pebbles}
          alt=""
          width={256}
          height={256}
          loading="eager"
          decoding="async"
          className="h-auto w-[min(16rem,72%)]"
        />
      </div>

      <div className="-mt-8 flex w-full justify-between px-1">
        <Tag tone="lavender">
          <HeartIcon width={16} height={16} aria-hidden="true" /> At your pace
        </Tag>
        <Tag tone="apricot">Zero pressure</Tag>
      </div>

      <ul className="grid w-full grid-cols-3 gap-3">
        {FEATURES.map(({ label, Icon }) => (
          <li
            key={label}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg bg-surface px-1 py-4',
              'text-center text-label-md text-ink shadow-card',
            )}
          >
            <Icon width={22} height={22} className="text-accent-strong" aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex w-full flex-col gap-3">
        <Link
          to="/signup"
          className={pillButtonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}
        >
          Get started
          <ChevronRightIcon width={18} height={18} aria-hidden="true" />
        </Link>
        <Link
          to="/login"
          className={pillButtonClasses({ variant: 'secondary', size: 'lg', fullWidth: true })}
        >
          I already have an account
        </Link>
      </div>

      <p className="text-body-sm text-muted">
        Personalized daily rhythm · Designed for human bodies
      </p>
    </section>
  )
}
