import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import { CloseIcon } from './icons'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  closeLabel?: string
}

/**
 * A bottom sheet dialog.
 *
 * Holds focus while open, closes on Escape and on backdrop press, and returns
 * focus to whatever opened it. The close callback is read through a ref so a
 * new function identity on every render cannot restart the effect and steal
 * focus back to the first element.
 */
export function Sheet({ open, onClose, title, children, closeLabel = 'Close' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const initial = panel ? (focusableWithin(panel)[0] ?? panel) : null
    initial?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }

      if (event.key !== 'Tab' || !panel) {
        return
      }

      const items = focusableWithin(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        return
      }

      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="sheet">
      <button
        type="button"
        className="sheet__backdrop"
        aria-label={`Dismiss ${title}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="sheet__handle" aria-hidden="true" />
        <div className="sheet__header">
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="sheet__close" aria-label={closeLabel} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  )
}
