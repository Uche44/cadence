import type { ComponentType, SVGProps } from 'react'

import {
  BandIcon,
  BodyIcon,
  DropletIcon,
  DumbbellIcon,
  HeartIcon,
  LeafIcon,
  PlusIcon,
  SparkleIcon,
  SpineIcon,
  WalkIcon,
} from '../components/icons'

type IconComponent = ComponentType<Omit<SVGProps<SVGSVGElement>, 'children'>>

const ICONS: Record<string, IconComponent> = {
  droplet: DropletIcon,
  heart: HeartIcon,
  back: SpineIcon,
  plus: PlusIcon,
  leaf: LeafIcon,
  bodyweight: BodyIcon,
  bands: BandIcon,
  dumbbell: DumbbellIcon,
  walk: WalkIcon,
}

export function OptionIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? SparkleIcon
  return <Icon width={size} height={size} aria-hidden="true" />
}
