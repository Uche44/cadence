import { useId } from 'react'

import { cn } from '../lib/cn'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}: ToggleProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex min-h-12 w-full items-center justify-between gap-4 border-0 bg-transparent p-0 text-left',
        'cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="text-body-lg font-semibold" id={labelId}>
          {label}
        </span>
        {description ? (
          <span className="text-body-sm text-muted" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'relative h-8 w-13 shrink-0 rounded-pill bg-lavender',
          'transition-colors duration-200 group-aria-checked:bg-accent',
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute top-1 left-1 size-6 rounded-pill bg-surface shadow-card',
            'transition-transform duration-200 group-aria-checked:translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
