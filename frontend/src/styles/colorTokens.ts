/**
 * The colour tokens shown on the design-system page.
 *
 * Kept out of the component so a test can verify every name here actually
 * exists in tokens.css. A typo would otherwise render as a blank swatch.
 */
export const COLOR_TOKENS = [
  '--color-canvas',
  '--color-canvas-sunken',
  '--color-surface',
  '--color-ink',
  '--color-ink-heading',
  '--color-ink-muted',
  '--color-ink-muted-strong',
  '--color-accent',
  '--color-accent-strong',
  '--color-tint-lavender',
  '--color-tint-lavender-soft',
  '--color-tint-apricot',
  '--color-tint-apricot-soft',
  '--color-tint-sky',
  '--color-tint-sky-soft',
  '--color-tint-mint',
  '--color-tint-mint-soft',
  '--color-tint-blush',
  '--color-tint-blush-soft',
  '--color-success-ink',
  '--color-warning-ink',
  '--color-danger',
  '--color-danger-soft',
  '--color-danger-ink',
] as const
