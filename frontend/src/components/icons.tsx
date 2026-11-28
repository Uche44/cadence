import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Icon({ ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </Icon>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </Icon>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19V9M9.5 19V5M15 19v-6M20.5 19V8" />
    </Icon>
  )
}

export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 5.5 4.5 12l6.5 6.5" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Icon>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Icon>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 21 20H3z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </Icon>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v6.2c0 4.2-3 7.2-7 8.8-4-1.6-7-4.6-7-8.8V6z" />
      <path d="M9 12l2 2 4-4.5" />
    </Icon>
  )
}

export function DropletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z" />
    </Icon>
  )
}

export function SpineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v18" />
      <path d="M9 6h6M8.5 10h7M9 14h6M8.5 18h7" />
    </Icon>
  )
}

export function BandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 8.5c-3 1.5-3 5.5 0 7s5.5-1 7-2.5 4-4 7-2.5 3 5.5 0 7" />
    </Icon>
  )
}

export function DumbbellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 8v8M4 10v4M17 8v8M20 10v4M7 12h10" />
    </Icon>
  )
}

export function WalkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M13 8 10 11l1.5 3.5L9 20M13 8l3 2 2 1M11.5 14.5 15 16l1 4" />
    </Icon>
  )
}

export function BodyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M12 7v6M8 9.5 12 8l4 1.5M9 20l3-7 3 7" />
    </Icon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5 18.5 12 8 18.5z" />
    </Icon>
  )
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />
    </Icon>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.9 9 19.5 11l-5.6 2L12 18.5 10.1 13 4.5 11 10.1 9z" />
    </Icon>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20.5S4.5 15.8 4.5 10.6A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4c0 5.2-7.5 9.9-7.5 9.9z" />
    </Icon>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v6.2c0 4.2-3 7.2-7 8.8-4-1.6-7-4.6-7-8.8V6z" />
    </Icon>
  )
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20.5v-6.2M12 14.3c0-4.6 3.6-7.8 8-7.8 0 4.3-3.4 7.8-8 7.8zM12 14.3c0-3.6-2.8-6.2-7-6.2 0 3.4 2.6 6.2 7 6.2z" />
    </Icon>
  )
}
