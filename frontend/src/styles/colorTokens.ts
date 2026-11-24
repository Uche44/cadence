/**
 * The colour tokens shown on the design-system page.
 *
 * Kept out of the component so a test can verify every name here actually
 * exists in the Tailwind theme. A typo would otherwise render as a blank swatch.
 */
export const COLOR_TOKENS = [
  '--color-canvas',
  '--color-canvas-sunken',
  '--color-surface',
  '--color-ink',
  '--color-ink-heading',
  '--color-muted',
  '--color-on-ink',
  '--color-accent',
  '--color-accent-strong',
  '--color-outline',
  '--color-lavender',
  '--color-lavender-soft',
  '--color-apricot',
  '--color-apricot-soft',
  '--color-sky',
  '--color-sky-soft',
  '--color-mint',
  '--color-mint-soft',
  '--color-blush',
  '--color-blush-soft',
  '--color-success-ink',
  '--color-warning-ink',
  '--color-danger',
  '--color-danger-soft',
  '--color-danger-ink',
] as const
