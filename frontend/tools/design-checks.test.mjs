import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkReferenceAnchors,
  checkReferencedTokens,
  contrastRatio,
  findRawColors,
  hexToRgb,
  parseTokens,
  runChecks,
} from './design-checks.mjs'

describe('token parsing', () => {
  it('reads custom properties into a map', () => {
    const tokens = parseTokens('@theme { --color-ink: #0f172a; --text-body-md: 0.875rem; }')

    expect(tokens.get('--color-ink')).toBe('#0f172a')
    expect(tokens.get('--text-body-md')).toBe('0.875rem')
  })

  it('reads Tailwind text modifiers', () => {
    const tokens = parseTokens('--text-display: 2.25rem; --text-display--line-height: 2.75rem;')

    expect(tokens.get('--text-display--line-height')).toBe('2.75rem')
  })
})

describe('raw colour detection', () => {
  it('flags a hex literal in markup', () => {
    expect(findRawColors(`<div className="bg-[#fff]" />`)).toContain('#fff')
  })

  it('flags rgb and hsl literals', () => {
    expect(findRawColors('background: rgb(0 0 0 / 10%);')).toContain('rgb(')
    expect(findRawColors('background: hsl(200 10% 10%);')).toContain('hsl(')
  })

  it('accepts token-based utilities', () => {
    expect(findRawColors('<div className="bg-canvas text-ink border-lavender" />')).toEqual([])
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

  it('rejects the reference muted tone on the canvas', () => {
    // #64748b on #f4f3ff is why the accessible slate exists.
    expect(contrastRatio('#64748b', '#f4f3ff')).toBeLessThan(4.5)
    expect(contrastRatio('#4b5563', '#f4f3ff')).toBeGreaterThan(4.5)
  })
})

describe('token reference checking', () => {
  const tokens = parseTokens('@theme { --color-ink: #0f172a; --text-body-md: 0.875rem; }')

  it('flags a quoted token that does not exist', () => {
    const source = "const NAMES = ['--color-ink', '--color-muted']"

    expect(checkReferencedTokens(source, tokens)).toEqual([
      'references undefined token --color-muted',
    ])
  })

  it('accepts every quoted token that exists', () => {
    const source = "const NAMES = ['--color-ink', '--text-body-md']"

    expect(checkReferencedTokens(source, tokens)).toEqual([])
  })

  it('does not treat a utility prefix as a token name', () => {
    expect(checkReferencedTokens("token.replace('--color-', '')", tokens)).toEqual([])
  })

  it('pins reference values and rejects drift', () => {
    const pinned = parseTokens(`
      --color-canvas: #f4f3ff;
      --color-ink: #0f172a;
      --color-ink-heading: #1e1b4b;
      --color-accent: #6d28d9;
    `)
    expect(checkReferenceAnchors(pinned)).toEqual([])

    const drifted = parseTokens(`
      --color-canvas: #000000;
      --color-ink: #0f172a;
      --color-ink-heading: #1e1b4b;
      --color-accent: #6d28d9;
    `)

    expect(checkReferenceAnchors(drifted)).toContain(
      '--color-canvas should be #f4f3ff (periwinkle canvas)',
    )
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
