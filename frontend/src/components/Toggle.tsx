import { useId } from 'react'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ label, description, checked, onChange, disabled = false }: ToggleProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__text">
        <span className="toggle__label" id={labelId}>
          {label}
        </span>
        {description ? (
          <span className="toggle__description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </button>
  )
}
