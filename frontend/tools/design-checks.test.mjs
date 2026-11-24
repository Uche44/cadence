import { describe, expect, it } from 'vitest'
import { join } from 'node:path'

import {
  checkMutedText,
  checkReferenceAnchors,
  checkReferencedTokens,
  checkTapTargets,
  contrastRatio,
  findRawColors,
  hexToRgb,
  isAtLeastTapTarget,
  parseRules,
  parseTokens,
  runChecks,
} from './design-checks.mjs'

describe('token parsing', () => {
  it('reads custom properties into a map', () => {
    const tokens = parseTokens(':root { --color-ink: #0f172a; --space-md: 1rem; }')

    expect(tokens.get('--color-ink')).toBe('#0f172a')
    expect(tokens.get('--space-md')).toBe('1rem')
  })
})

describe('raw colour detection', () => {
  it('flags hex values', () => {
    expect(findRawColors('.x { color: #fff; }')).toContain('#fff')
  })

  it('flags rgb and hsl literals', () => {
    expect(findRawColors('background: rgb(0 0 0 / 10%);')).toContain('rgb(')
    expect(findRawColors('background: hsl(200 10% 10%);')).toContain('hsl(')
  })

  it('accepts token references', () => {
    expect(
      findRawColors('.x { color: var(--color-ink); background: var(--color-canvas); }'),
    ).toEqual([])
  })

  it('does not mistake an anchor href for a colour', () => {
    expect(findRawColors('<a href="#main">Skip</a>')).toEqual([])
  })
})

describe('contrast maths', () => {
  it('gives 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('gives 1:1 for a colour against itself', () => {
    expect(contrastRatio('#6d28d9', '#6d28d9')).toBeCloseTo(1, 5)
  })

  it('expands three-digit hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('rejects a value that is not a colour', () => {
    expect(() => hexToRgb('rebeccapurple')).toThrow()
  })
})

describe('touch target checking', () => {
  const goodCss = `
    .pill-button { min-height: var(--tap-target); min-width: var(--tap-target); }
    .chip { min-height: var(--tap-target); }
    .toggle { min-height: 3rem; }
    .field__input { min-height: 48px; }
    .sheet__close { min-height: var(--tap-target); min-width: var(--tap-target); }
    .bottom-nav__item { min-height: var(--tap-target); min-width: var(--tap-target); }
  `

  it('passes when every interactive root declares the floor', () => {
    expect(checkTapTargets(goodCss)).toEqual([])
  })

  it('flags a missing minimum height', () => {
    const broken = goodCss.replace(
      '.chip { min-height: var(--tap-target); }',
      '.chip { padding: 4px; }',
    )

    expect(checkTapTargets(broken)).toContain('.chip does not declare a 48px minimum height')
  })

  it('flags a height below the floor', () => {
    expect(isAtLeastTapTarget('2.5rem')).toBe(false)
    expect(isAtLeastTapTarget('40px')).toBe(false)
    expect(isAtLeastTapTarget('3rem')).toBe(true)
    expect(isAtLeastTapTarget('var(--tap-target)')).toBe(true)
  })

  it('flags an icon-only control with no minimum width', () => {
    const broken = goodCss.replace(
      '.sheet__close { min-height: var(--tap-target); min-width: var(--tap-target); }',
      '.sheet__close { min-height: var(--tap-target); }',
    )

    expect(checkTapTargets(broken)).toContain('.sheet__close does not declare a 48px minimum width')
  })

  it('flags a component that is not styled at all', () => {
    expect(checkTapTargets('.chip { min-height: var(--tap-target); }')).toContain(
      '.pill-button is not styled at all',
    )
  })
})

describe('muted text token discipline', () => {
  it('flags the lighter muted tone used for text', () => {
    expect(checkMutedText('.field__hint { color: var(--color-ink-muted); }')).toContain(
      '.field__hint uses --color-ink-muted for text; use --color-ink-muted-strong so it passes 4.5:1',
    )
  })

  it('allows the lighter tone for non-text icons', () => {
    expect(checkMutedText('.field__icon { color: var(--color-ink-muted); }')).toEqual([])
  })

  it('accepts the stronger tone for text', () => {
    expect(checkMutedText('.field__hint { color: var(--color-ink-muted-strong); }')).toEqual([])
  })
})

describe('token reference checking', () => {
  const tokens = parseTokens(':root { --color-ink: #0f172a; --space-md: 1rem; }')

  it('flags a quoted token that does not exist', () => {
    const source = "const NAMES = ['--color-ink', '--color-muted']"

    expect(checkReferencedTokens(source, tokens)).toEqual([
      'references undefined token --color-muted',
    ])
  })

  it('accepts every quoted token that exists', () => {
    const source = "const NAMES = ['--color-ink', '--space-md']"

    expect(checkReferencedTokens(source, tokens)).toEqual([])
  })

  it('pins reference values and rejects drift', () => {
    const pinned = parseTokens(`
      :root {
        --color-canvas: #f4f3ff;
        --color-ink: #0f172a;
        --color-ink-heading: #1e1b4b;
        --color-accent: #6d28d9;
        --tap-target: 3rem;
      }
    `)
    expect(checkReferenceAnchors(pinned)).toEqual([])

    const drifted = parseTokens(`
      :root {
        --color-canvas: #000000;
        --color-ink: #0f172a;
        --color-ink-heading: #1e1b4b;
        --color-accent: #6d28d9;
        --tap-target: 3rem;
      }
    `)

    expect(checkReferenceAnchors(drifted)).toContain(
      '--color-canvas should be #f4f3ff (periwinkle canvas)',
    )
  })
})

describe('rule parsing', () => {
  it('ignores keyframes so animation steps are not mistaken for selectors', () => {
    const rules = parseRules(
      '@keyframes rise { from { opacity: 0; } to { opacity: 1; } } .chip { color: red; }',
    )

    expect(rules.map((rule) => rule.selector)).toEqual(['.chip'])
  })
})

describe('the repository contract', () => {
  it('satisfies every check', () => {
    // Vitest does not expose a file:// URL for import.meta.url, so resolve from
    // the working directory instead (vitest runs with the frontend as root).
    const root = process.cwd().endsWith('frontend')
      ? process.cwd()
      : join(process.cwd(), 'frontend')

    expect(runChecks(root)).toEqual([])
  })
})
