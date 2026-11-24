import { cn } from '../lib/cn'

export type PillButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type PillButtonSize = 'md' | 'lg'

interface PillButtonClassOptions {
  variant?: PillButtonVariant
  size?: PillButtonSize
  fullWidth?: boolean
  className?: string
}

const VARIANT_CLASSES: Record<PillButtonVariant, string> = {
  primary: 'bg-ink text-on-ink',
  secondary: 'bg-surface text-ink shadow-card',
  ghost: 'bg-transparent text-ink',
  danger: 'bg-danger text-on-ink',
}

/**
 * The single source of the pill-button class list.
 *
 * Navigation needs an anchor rather than a button, so links reuse this instead
 * of re-declaring the styling at each call site.
 */
export function pillButtonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: PillButtonClassOptions = {}): string {
  return cn(
    'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-pill border-0 px-6',
    'text-label-lg no-underline transition duration-150 ease-out',
    'cursor-pointer active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45',
    VARIANT_CLASSES[variant],
    size === 'lg' && 'min-h-13 px-8 text-body-lg',
    fullWidth && 'w-full',
    className,
  )
}
