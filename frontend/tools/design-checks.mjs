/**
 * Design-contract checks.
 *
 * Tailwind makes the styling decisions inline, which is good for velocity and
 * bad for consistency: a one-off hex value or a mistyped token compiles happily
 * and looks wrong only by eye. These checks fail the build instead.
 *
 * Everything is exported so the checks themselves can be tested — a check that
 * cannot fail is not a check.
 *
 * Computed layout (touch targets, overflow, resolved fonts) is verified in a
 * real browser by `tools/layout-check.mjs`, not here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const STYLE_ENTRY = ['src', 'styles', 'index.css']

export const REQUIRED_TOKENS = [
  // Surfaces
  '--color-canvas',
  '--color-canvas-sunken',
  '--color-surface',
  // Ink
  '--color-ink',
  '--color-ink-heading',
  '--color-muted',
  '--color-on-ink',
  // Accent
  '--color-accent',
  '--color-accent-strong',
  '--color-outline',
  // Pastel tiers
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
  // Semantic
  '--color-success-ink',
  '--color-warning-ink',
  '--color-danger',
  '--color-danger-soft',
  '--color-danger-ink',
  '--color-backdrop',
  // Radii
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-pill',
  // Type scale
  '--text-display',
  '--text-display-mobile',
  '--text-headline-lg',
  '--text-headline-md',
  '--text-headline-sm',
  '--text-body-lg',
  '--text-body-md',
  '--text-body-sm',
  '--text-label-lg',
  '--text-label-md',
  '--text-label-sm',
  // Everything else
  '--font-sans',
  '--shadow-card',
  '--shadow-nav',
  '--container-app',
  '--animate-sheet',
]

/** Text pairs that are actually rendered, with the ratio each must clear. */
export const CONTRAST_PAIRS = [
  { fg: '--color-ink', bg: '--color-canvas', min: 4.5, usage: 'body text on canvas' },
  { fg: '--color-ink', bg: '--color-surface', min: 4.5, usage: 'body text on cards' },
  { fg: '--color-ink-heading', bg: '--color-surface', min: 3, usage: 'headlines on cards' },
  { fg: '--color-muted', bg: '--color-surface', min: 4.5, usage: 'muted text on cards' },
  { fg: '--color-muted', bg: '--color-canvas', min: 4.5, usage: 'muted text on canvas' },
  {
    fg: '--color-muted',
    bg: '--color-lavender-soft',
    min: 4.5,
    usage: 'input placeholder on field background',
  },
  { fg: '--color-on-ink', bg: '--color-ink', min: 4.5, usage: 'button label on primary ink' },
  {
    fg: '--color-accent-strong',
    bg: '--color-canvas',
    min: 4.5,
    usage: 'eyebrow and links on canvas',
  },
  { fg: '--color-accent', bg: '--color-surface', min: 4.5, usage: 'accent text on cards' },
  {
    fg: '--color-success-ink',
    bg: '--color-mint-soft',
    min: 4.5,
    usage: 'completed badge',
  },
  {
    fg: '--color-warning-ink',
    bg: '--color-apricot-soft',
    min: 4.5,
    usage: 'skipped badge and offline banner',
  },
  { fg: '--color-danger-ink', bg: '--color-danger-soft', min: 4.5, usage: 'stop badge' },
  { fg: '--color-ink', bg: '--color-lavender', min: 4.5, usage: 'lavender card' },
  { fg: '--color-ink', bg: '--color-apricot', min: 4.5, usage: 'apricot card' },
  { fg: '--color-ink', bg: '--color-sky', min: 4.5, usage: 'sky card' },
  { fg: '--color-ink', bg: '--color-mint', min: 4.5, usage: 'mint card' },
  { fg: '--color-ink', bg: '--color-blush', min: 4.5, usage: 'blush card' },
]

/** Values that come straight from the reference and should not drift silently. */
export const REFERENCE_ANCHORS = [
  { token: '--color-canvas', value: '#f4f3ff', note: 'periwinkle canvas' },
  { token: '--color-ink', value: '#0f172a', note: 'obsidian ink' },
  { token: '--color-ink-heading', value: '#1e1b4b', note: 'indigo headline ink' },
  { token: '--color-accent', value: '#6d28d9', note: 'violet accent' },
]

const TOKEN_PATTERN = /(--[a-z0-9-]+(?:-[a-z0-9-]+)*)\s*:\s*([^;]+);/gi
const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/g

export function parseTokens(cssText) {
  const tokens = new Map()
  for (const match of cssText.matchAll(TOKEN_PATTERN)) {
    tokens.set(match[1], match[2].trim())
  }
  return tokens
}

export function findRawColors(text) {
  return [...text.matchAll(RAW_COLOR_PATTERN)].map((match) => match[0])
}

/**
 * Every token name a source file quotes must exist in the theme.
 *
 * This catches the most common real bug in a token-driven UI: a renamed or
 * mistyped custom property that renders as an invisible blank rather than
 * throwing.
 */
export function checkReferencedTokens(sourceText, tokens) {
  const referenced = new Set(
    [...sourceText.matchAll(/['"](--[a-z0-9]+(?:-[a-z0-9]+)*)['"]/g)].map((match) => match[1]),
  )

  return [...referenced]
    .filter((token) => !tokens.has(token))
    .map((token) => `references undefined token ${token}`)
}

export function checkReferenceAnchors(tokens) {
  return REFERENCE_ANCHORS.filter(({ token, value }) => {
    const actual = tokens.get(token)
    return actual === undefined || actual.toLowerCase() !== value.toLowerCase()
  }).map(({ token, value, note }) => `${token} should be ${value} (${note})`)
}

export function hexToRgb(hex) {
  const normalized = hex.trim().replace(/^#/, '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized

  if (expanded.length !== 6) {
    throw new Error(`not a 6-digit hex colour: ${hex}`)
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

export function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const scaled = value / 255
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(fgHex, bgHex) {
  const light = Math.max(relativeLuminance(hexToRgb(fgHex)), relativeLuminance(hexToRgb(bgHex)))
  const dark = Math.min(relativeLuminance(hexToRgb(fgHex)), relativeLuminance(hexToRgb(bgHex)))
  return (light + 0.05) / (dark + 0.05)
}

function walk(directory, extensions, skip = []) {
  const found = []
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (skip.includes(entry)) continue
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, extensions, skip))
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(full)
    }
  }
  return found
}

export function runChecks(root) {
  const styleEntry = join(root, ...STYLE_ENTRY)
  const problems = []
  const tokens = parseTokens(readFileSync(styleEntry, 'utf8'))

  for (const token of REQUIRED_TOKENS) {
    if (!tokens.has(token)) {
      problems.push(`missing token ${token}`)
    }
  }

  problems.push(...checkReferenceAnchors(tokens))

  for (const file of walk(join(root, 'src'), ['.ts', '.tsx'], ['node_modules'])) {
    if (/\.(test|spec)\./.test(file)) continue
    problems.push(
      ...checkReferencedTokens(readFileSync(file, 'utf8'), tokens).map(
        (problem) => `${relative(root, file)} ${problem}`,
      ),
    )
  }

  // The theme file is the only place allowed to name a colour literally.
  const sourceFiles = walk(join(root, 'src'), ['.tsx', '.ts', '.css'], ['node_modules']).filter(
    (file) => file !== styleEntry && !/\.(test|spec)\./.test(file),
  )

  for (const file of sourceFiles) {
    const found = findRawColors(readFileSync(file, 'utf8'))
    if (found.length > 0) {
      problems.push(`${relative(root, file)} uses raw colours: ${[...new Set(found)].join(', ')}`)
    }
  }

  for (const pair of CONTRAST_PAIRS) {
    const fg = tokens.get(pair.fg)
    const bg = tokens.get(pair.bg)
    if (!fg || !bg) {
      problems.push(`contrast pair ${pair.fg} on ${pair.bg} references a missing token`)
      continue
    }
    const ratio = contrastRatio(fg, bg)
    if (ratio < pair.min) {
      problems.push(
        `${pair.usage}: ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1`,
      )
    }
  }

  return problems
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const problems = runChecks(root)

  if (problems.length > 0) {
    console.error('Design contract failed:')
    for (const problem of problems) {
      console.error(`  - ${problem}`)
    }
    process.exit(1)
  }

  console.log('Design contract satisfied: tokens present, no raw colours, contrast ok.')
}
