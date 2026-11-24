import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom token names collide with tailwind-merge's built-in heuristics: it
 * cannot tell that `text-label-lg` is a font size while `text-on-ink` is a
 * colour, so it treats them as one group and drops one of them — which
 * silently produced dark-on-dark button labels.
 *
 * Declaring both groups explicitly keeps the merge smart for everything else
 * while making our tokens unambiguous.
 */
const TYPE_SIZES = [
  'display',
  'display-mobile',
  'headline-lg',
  'headline-md',
  'headline-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'label-lg',
  'label-md',
  'label-sm',
]

const COLORS = [
  'canvas',
  'canvas-sunken',
  'surface',
  'ink',
  'ink-heading',
  'muted',
  'on-ink',
  'accent',
  'accent-strong',
  'outline',
  'lavender',
  'lavender-soft',
  'apricot',
  'apricot-soft',
  'sky',
  'sky-soft',
  'mint',
  'mint-soft',
  'blush',
  'blush-soft',
  'success-ink',
  'warning-ink',
  'danger',
  'danger-soft',
  'danger-ink',
  'backdrop',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPE_SIZES }],
      'text-color': [{ text: COLORS }],
      'bg-color': [{ bg: COLORS }],
      'border-color': [{ border: COLORS }],
    },
  },
})

/** Merge conditional class lists, letting later utilities win a conflict. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
