import { CalendarIcon, ChartIcon, HomeIcon, PersonIcon } from './icons'

export const BOTTOM_NAV_DESTINATIONS = [
  { to: '/today', label: 'Today', Icon: HomeIcon },
  { to: '/plan', label: 'Plan', Icon: CalendarIcon },
  { to: '/progress', label: 'Progress', Icon: ChartIcon },
  { to: '/profile', label: 'Profile', Icon: PersonIcon },
] as const

export const DESTINATION_PATHS: ReadonlySet<string> = new Set(
  BOTTOM_NAV_DESTINATIONS.map((destination) => destination.to),
)
