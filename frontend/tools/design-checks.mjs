/**
 * Design-contract checks.
 *
 * These exist because a design system drifts silently: someone adds a one-off
 * hex value, a button loses its minimum height, or a token gets nudged until
 * text no longer passes contrast. Each check below fails loudly instead.
 *
 * Everything is exported so the checks themselves can be tested — a check that
 * cannot fail is not a check.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_TOKENS = [
  '--color-canvas',
  '--color-canvas-sunken',
  '--color-surface',
  '--color-ink',
  '--color-ink-heading',
  '--color-ink-muted',
  '--color-ink-muted-strong',
  '--color-on-ink',
  '--color-accent',
  '--color-accent-strong',
  '--color-outline',
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
  '--color-backdrop',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-pill',
  '--space-2xs',
  '--space-xs',
  '--space-sm',
  '--space-md',
  '--space-lg',
  '--space-xl',
  '--space-2xl',
  '--space-3xl',
  '--gutter',
  '--margin',
  '--font-sans',
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
  '--weight-regular',
  '--weight-medium',
  '--weight-semibold',
  '--weight-bold',
  '--shadow-card',
  '--shadow-nav',
  '--tap-target',
  '--focus-ring',
  '--focus-offset',
  '--duration-fast',
  '--duration-base',
  '--ease-out',
  '--app-max-width',
  '--nav-clearance',
]

/** Text pairs that are actually rendered, with the ratio each must clear. */
export const CONTRAST_PAIRS = [
  { fg: '--color-ink', bg: '--color-canvas', min: 4.5, usage: 'body text on canvas' },
  { fg: '--color-ink', bg: '--color-surface', min: 4.5, usage: 'body text on cards' },
  { fg: '--color-ink-heading', bg: '--color-surface', min: 3, usage: 'headlines on cards' },
  { fg: '--color-ink-muted', bg: '--color-surface', min: 4.5, usage: 'muted text on cards' },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-canvas',
    min: 4.5,
    usage: 'muted text on canvas',
  },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-surface',
    min: 4.5,
    usage: 'muted text on cards',
  },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-tint-lavender-soft',
    min: 4.5,
    usage: 'field hints inside inputs',
  },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-canvas-sunken',
    min: 4.5,
    usage: 'muted text on sunken panels',
  },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-tint-mint-soft',
    min: 4.5,
    usage: 'muted text on mint wash',
  },
  {
    fg: '--color-ink-muted-strong',
    bg: '--color-tint-apricot-soft',
    min: 4.5,
    usage: 'muted text on apricot wash',
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
    bg: '--color-tint-mint-soft',
    min: 4.5,
    usage: 'completed badge',
  },
  {
    fg: '--color-warning-ink',
    bg: '--color-tint-apricot-soft',
    min: 4.5,
    usage: 'skipped badge and offline banner',
  },
  { fg: '--color-danger-ink', bg: '--color-danger-soft', min: 4.5, usage: 'stop badge' },
  { fg: '--color-ink', bg: '--color-tint-lavender', min: 4.5, usage: 'lavender card' },
  { fg: '--color-ink', bg: '--color-tint-apricot', min: 4.5, usage: 'apricot card' },
  { fg: '--color-ink', bg: '--color-tint-sky', min: 4.5, usage: 'sky card' },
  { fg: '--color-ink', bg: '--color-tint-mint', min: 4.5, usage: 'mint card' },
  { fg: '--color-ink', bg: '--color-tint-blush', min: 4.5, usage: 'blush card' },
]

/** Interactive roots that must meet the 48px touch floor. */
export const INTERACTIVE_SELECTORS = [
  { selector: '.pill-button', requireWidth: true },
  { selector: '.chip', requireWidth: false },
  { selector: '.toggle', requireWidth: false },
  { selector: '.field__input', requireWidth: false },
  { selector: '.sheet__close', requireWidth: true },
  { selector: '.bottom-nav__item', requireWidth: true },
]

/** Values that come from the reference and should not drift silently. */
export const REFERENCE_ANCHORS = [
  { token: '--color-canvas', value: '#f4f3ff', note: 'periwinkle canvas' },
  { token: '--color-ink', value: '#0f172a', note: 'obsidian ink' },
  { token: '--color-ink-heading', value: '#1e1b4b', note: 'indigo headline ink' },
  { token: '--color-accent', value: '#6d28d9', note: 'violet accent' },
  { token: '--tap-target', value: '3rem', note: '48px touch floor' },
]

const TOKEN_PATTERN = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
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

export function parseRules(cssText) {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const withoutKeyframes = withoutComments.replace(
    /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
    '',
  )

  const rules = []
  let cursor = 0

  while (cursor < withoutKeyframes.length) {
    const open = withoutKeyframes.indexOf('{', cursor)
    if (open === -1) break
    const close = withoutKeyframes.indexOf('}', open)
    if (close === -1) break

    rules.push({
      selector: withoutKeyframes.slice(cursor, open).trim(),
      body: withoutKeyframes.slice(open + 1, close),
    })
    cursor = close + 1
  }

  return rules
}

export function isAtLeastTapTarget(value) {
  if (!value) return false
  if (value.includes('var(--tap-target)')) return true

  const match = value.match(/^([\d.]+)(rem|px)$/)
  if (!match) return false

  const amount = Number.parseFloat(match[1])
  return match[2] === 'rem' ? amount * 16 >= 48 : amount >= 48
}

export function checkTapTargets(cssText) {
  const rules = parseRules(cssText)
  const problems = []

  for (const { selector, requireWidth } of INTERACTIVE_SELECTORS) {
    const matching = rules.filter((rule) =>
      rule.selector
        .split(',')
        .map((part) => part.trim())
        .includes(selector),
    )

    if (matching.length === 0) {
      problems.push(`${selector} is not styled at all`)
      continue
    }

    const declaresHeight = matching.some((rule) =>
      isAtLeastTapTarget(rule.body.match(/min-height\s*:\s*([^;]+)/)?.[1]?.trim()),
    )
    if (!declaresHeight) {
      problems.push(`${selector} does not declare a 48px minimum height`)
    }

    if (requireWidth) {
      const declaresWidth = matching.some((rule) =>
        isAtLeastTapTarget(rule.body.match(/min-width\s*:\s*([^;]+)/)?.[1]?.trim()),
      )
      if (!declaresWidth) {
        problems.push(`${selector} does not declare a 48px minimum width`)
      }
    }
  }

  return problems
}

export function checkMutedText(cssText) {
  const problems = []

  for (const rule of parseRules(cssText)) {
    const usesLighterMuted = /color\s*:\s*var\(--color-ink-muted\)/.test(rule.body)
    if (usesLighterMuted && !rule.selector.includes('icon')) {
      problems.push(
        `${rule.selector} uses --color-ink-muted for text; use --color-ink-muted-strong so it passes 4.5:1`,
      )
    }
  }

  return problems
}

/**
 * Every token name a source file quotes must exist in tokens.css.
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

/** Pin the values that come straight from the reference designs. */
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
  const stylesDir = join(root, 'src', 'styles')
  const tokensPath = join(stylesDir, 'tokens.css')
  const componentsPath = join(stylesDir, 'components.css')

  const problems = []
  const tokens = parseTokens(readFileSync(tokensPath, 'utf8'))

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

  const sourceFiles = walk(join(root, 'src'), ['.tsx', '.ts', '.css'], ['node_modules']).filter(
    (file) => file !== tokensPath && !/\.(test|spec)\./.test(file),
  )

  for (const file of sourceFiles) {
    const found = findRawColors(readFileSync(file, 'utf8'))
    if (found.length > 0) {
      problems.push(`${relative(root, file)} uses raw colours: ${[...new Set(found)].join(', ')}`)
    }
  }

  problems.push(...checkTapTargets(readFileSync(componentsPath, 'utf8')))

  for (const cssFile of walk(stylesDir, ['.css'])) {
    problems.push(...checkMutedText(readFileSync(cssFile, 'utf8')))
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

  console.log(
    'Design contract satisfied: tokens present, no raw colours, tap targets and contrast ok.',
  )
}
