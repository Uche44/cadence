import { Link } from 'react-router-dom'

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
import pebbles from '../assets/cadence-pebbles.png'

const FEATURES = [
  { label: 'Energy-smart', Icon: BoltIcon },
  { label: 'Gentle flows', Icon: SparkleIcon },
  { label: 'Safe habits', Icon: ShieldIcon },
]

export function Welcome() {
  return (
    <section className="welcome" aria-labelledby="welcome-heading">
      <div className="welcome__wordmark">
        <LeafIcon width={22} height={22} aria-hidden="true" />
        <span className="welcome__wordmark-text">Cadence</span>
      </div>

      <h1 id="welcome-heading" className="welcome__tagline">
        Exercise that keeps pace with your life.
      </h1>

      <p className="welcome__note">
        <LeafIcon width={16} height={16} aria-hidden="true" /> Your gentle companion for chronic
        wellness
      </p>

      <div className="welcome__art">
        <img src={pebbles} alt="" width={256} height={256} loading="eager" decoding="async" />
      </div>

      <div className="welcome__floats">
        <Tag tone="lavender">
          <HeartIcon width={16} height={16} aria-hidden="true" /> At your pace
        </Tag>
        <Tag tone="apricot">Zero pressure</Tag>
      </div>

      <ul className="welcome__features">
        {FEATURES.map(({ label, Icon }) => (
          <li key={label} className="welcome__feature">
            <Icon width={22} height={22} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="welcome__actions">
        <Link
          to="/today"
          className={pillButtonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}
        >
          Get started
          <ChevronRightIcon width={18} height={18} aria-hidden="true" />
        </Link>
        <Link
          to="/today"
          className={pillButtonClasses({ variant: 'secondary', size: 'lg', fullWidth: true })}
        >
          I already have an account
        </Link>
      </div>

      <p className="welcome__fineprint">Personalized daily rhythm · Designed for human bodies</p>
    </section>
  )
}
