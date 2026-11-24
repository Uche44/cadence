import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../lib/cn'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, hint, error, icon, className, ...rest }: InputProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-label-lg text-ink" htmlFor={id}>
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-13 items-center gap-3 rounded-md border-[1.5px] border-transparent bg-lavender-soft px-4',
          'transition-colors duration-150',
          error && 'border-danger',
        )}
      >
        {icon ? (
          <span className="inline-flex text-muted" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            'min-h-12 min-w-0 flex-1 border-0 bg-transparent text-body-lg text-ink',
            'placeholder:text-muted focus:outline-none',
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-body-sm font-semibold text-danger-ink" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="text-body-sm text-muted" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
