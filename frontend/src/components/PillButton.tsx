import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../lib/cn'
import { pillButtonClasses } from './buttonStyles'
import type { PillButtonSize, PillButtonVariant } from './buttonStyles'

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant
  size?: PillButtonSize
  fullWidth?: boolean
  icon?: ReactNode
  iconPosition?: 'start' | 'end'
}

export function PillButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  iconPosition = 'end',
  className,
  children,
  type = 'button',
  ...rest
}: PillButtonProps) {
  const adornment = icon ? (
    <span aria-hidden="true" className="inline-flex">
      {icon}
    </span>
  ) : null

  return (
    <button
      type={type}
      className={cn(pillButtonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {iconPosition === 'start' ? adornment : null}
      <span>{children}</span>
      {iconPosition === 'end' ? adornment : null}
    </button>
  )
}
