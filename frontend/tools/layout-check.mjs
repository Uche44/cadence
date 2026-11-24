/**
 * Real-layout checks against the built app.
 *
 * jsdom has no layout engine, so it cannot answer "is this tap target 48px?" or
 * "does anything scroll sideways at 320px?". This drives the real Chromium and
 * measures the browser's own numbers.
 *
 * Run after `npm run build`.
 */

import { createServer } from 'node:http'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

const WIDTHS = [320, 390, 430]
const PATHS = ['/', '/today', '/design']

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

function startServer(root) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)

    // The app probes the API on load; answer honestly so screenshots are not
    // dominated by an offline banner that has nothing to do with layout.
    if (pathname === '/api/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ status: 'ok', version: '0.1.0', server_time: 'now' }))
      return
    }

    const resolved = normalize(join(root, pathname))
    const isFile = existsSync(resolved) && statSync(resolved).isFile()
    const filePath = isFile ? resolved : join(root, 'index.html')

    if (!existsSync(filePath)) {
      response.writeHead(404)
      response.end('not found')
      return
    }

    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    })
    response.end(readFileSync(filePath))
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

async function measure(page, width, path) {
  return page.evaluate(
    ({ width, path }) => {
      const problems = []
      const viewportWidth = window.innerWidth

      if (document.documentElement.scrollWidth > viewportWidth + 1) {
        problems.push(
          `${path} at ${width}px scrolls horizontally (${document.documentElement.scrollWidth}px wide)`,
        )
      }

      const interactiveSelector =
        'a[href], button:not([disabled]), input:not([disabled]), [role="switch"]'
      for (const element of document.querySelectorAll(interactiveSelector)) {
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const label =
          element.textContent?.trim().slice(0, 24) ||
          element.getAttribute('aria-label') ||
          element.tagName.toLowerCase()
        if (rect.height < 48) {
          problems.push(
            `${path} at ${width}px: "${label}" is ${Math.round(rect.height)}px tall, needs 48px`,
          )
        }
        if (rect.width < 48) {
          problems.push(
            `${path} at ${width}px: "${label}" is ${Math.round(rect.width)}px wide, needs 48px`,
          )
        }
      }

      for (const heading of document.querySelectorAll('h1, h2, h3')) {
        if (heading.scrollWidth > heading.clientWidth + 1) {
          problems.push(
            `${path} at ${width}px: heading "${heading.textContent?.trim().slice(0, 24)}" is clipped`,
          )
        }
      }

      const bodyFont = getComputedStyle(document.body).fontFamily
      if (!bodyFont.includes('Plus Jakarta Sans')) {
        problems.push(`${path} at ${width}px: body font is "${bodyFont}", not Plus Jakarta Sans`)
      }

      return { problems, title: document.title }
    },
    { width, path },
  )
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const frontendRoot = fileURLToPath(new URL('..', import.meta.url))
  const dist = join(frontendRoot, 'dist')

  if (!existsSync(join(dist, 'index.html'))) {
    console.error('No build found. Run: npm run build')
    process.exit(1)
  }

  const screenshotsDir = join(frontendRoot, '..', 'screenshots')
  mkdirSync(screenshotsDir, { recursive: true })

  const { server, baseUrl } = await startServer(dist)
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    args: ['--no-sandbox'],
  })

  const problems = []

  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
      })

      for (const path of PATHS) {
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
        const result = await measure(page, width, path)
        problems.push(...result.problems)

        const slug = path === '/' ? 'welcome' : path.replace(/\//g, '-').replace(/^-/, '')
        await page.screenshot({
          path: join(screenshotsDir, `m2-${width}-${slug}.png`),
          fullPage: true,
        })
      }

      await page.close()
    }

    const navPage = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await navPage.goto(`${baseUrl}/today`, { waitUntil: 'networkidle' })
    const navState = await navPage.evaluate(() => {
      const nav = document.querySelector('.bottom-nav')
      const active = document.querySelector('.bottom-nav__item[aria-current="page"]')
      return {
        present: nav !== null,
        items: document.querySelectorAll('.bottom-nav__item').length,
        activeLabel: active?.textContent?.trim() ?? null,
      }
    })
    await navPage.close()

    if (!navState.present) problems.push('bottom navigation is missing on /today')
    if (navState.items !== 4)
      problems.push(`bottom navigation has ${navState.items} items, expected 4`)
    if (navState.activeLabel !== 'Today') {
      problems.push(`bottom navigation active item is "${navState.activeLabel}", expected Today`)
    }
  } finally {
    await browser.close()
    server.close()
  }

  if (problems.length > 0) {
    console.error('Layout check failed:')
    for (const problem of problems) {
      console.error(`  - ${problem}`)
    }
    process.exit(1)
  }

  console.log(`Layout check passed at ${WIDTHS.join(', ')}px. Screenshots in screenshots/.`)
}
