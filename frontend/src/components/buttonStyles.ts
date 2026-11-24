export type PillButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type PillButtonSize = 'md' | 'lg'

interface PillButtonClassOptions {
  variant?: PillButtonVariant
  size?: PillButtonSize
  fullWidth?: boolean
  className?: string
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
  return [
    'pill-button',
    `pill-button--${variant}`,
    size === 'lg' ? 'pill-button--lg' : '',
    fullWidth ? 'pill-button--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}
