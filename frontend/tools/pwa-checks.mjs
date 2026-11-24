/**
 * Installability and offline checks against the built output.
 *
 * These cannot run in jsdom: a service worker is a browser feature and the
 * manifest is a build artifact. So this inspects dist/ after `npm run build`
 * and asserts the things a judge's browser will actually look for.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseTokens } from './design-checks.mjs'

const REQUIRED_ICON_SIZES = ['192x192', '512x512']

export function validateManifest(manifest) {
  const problems = []

  if (!manifest.name) problems.push('manifest.name is missing')
  if (!manifest.short_name) problems.push('manifest.short_name is missing')
  if (!manifest.start_url) problems.push('manifest.start_url is missing')
  if (manifest.display !== 'standalone') {
    problems.push(`manifest.display must be "standalone", got "${manifest.display}"`)
  }
  if (!manifest.theme_color) problems.push('manifest.theme_color is missing')
  if (!manifest.background_color) problems.push('manifest.background_color is missing')

  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  const sizes = new Set(icons.map((icon) => icon.sizes))
  for (const required of REQUIRED_ICON_SIZES) {
    if (!sizes.has(required)) {
      problems.push(`manifest is missing a ${required} icon`)
    }
  }
  if (!icons.some((icon) => String(icon.purpose ?? '').includes('maskable'))) {
    problems.push('manifest has no maskable icon')
  }

  return problems
}

export function checkBuild(distDir, tokens) {
  const problems = []

  const manifestPath = join(distDir, 'manifest.webmanifest')
  if (!existsSync(manifestPath)) {
    return [`no manifest at ${manifestPath} — run npm run build`]
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  problems.push(...validateManifest(manifest))

  // The install prompt shows the canvas colour; it must match the tokens.
  const canvas = tokens.get('--color-canvas')
  if (canvas && String(manifest.theme_color).toLowerCase() !== canvas.toLowerCase()) {
    problems.push(
      `manifest.theme_color ${manifest.theme_color} does not match --color-canvas ${canvas}`,
    )
  }

  for (const icon of manifest.icons ?? []) {
    const iconPath = join(distDir, icon.src.replace(/^\//, ''))
    if (!existsSync(iconPath)) {
      problems.push(`manifest references a missing icon: ${icon.src}`)
    }
  }

  const serviceWorkerPath = join(distDir, 'sw.js')
  if (!existsSync(serviceWorkerPath)) {
    problems.push('no service worker at dist/sw.js')
  } else {
    const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')
    if (!serviceWorker.includes('index.html')) {
      problems.push('service worker precache manifest does not include index.html')
    }
    if (!serviceWorker.includes('api')) {
      problems.push('service worker has no reference to the /api deny rule')
    }
  }

  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    problems.push('dist/index.html is missing')
  } else {
    const html = readFileSync(indexPath, 'utf8')
    if (!/rel="manifest"/.test(html)) {
      problems.push('index.html does not link the web manifest')
    }
    if (!/serviceWorker|registerSW|registerSW\.js/.test(html)) {
      problems.push('index.html does not register the service worker')
    }
  }

  const fontFiles = existsSync(join(distDir, 'assets'))
    ? readdirSync(join(distDir, 'assets')).filter((file) => file.endsWith('.woff2'))
    : []
  if (fontFiles.length === 0) {
    problems.push('no self-hosted woff2 font in dist/assets — offline text would fall back')
  }

  return problems
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const frontendRoot = fileURLToPath(new URL('..', import.meta.url))
  const tokens = parseTokens(readFileSync(join(frontendRoot, 'src', 'styles', 'index.css'), 'utf8'))
  const problems = checkBuild(join(frontendRoot, 'dist'), tokens)

  if (problems.length > 0) {
    console.error('PWA check failed:')
    for (const problem of problems) {
      console.error(`  - ${problem}`)
    }
    process.exit(1)
  }

  console.log('PWA check passed: manifest, icons, service worker, precache and font are in place.')
}
