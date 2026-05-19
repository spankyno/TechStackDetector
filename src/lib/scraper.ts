// src/lib/scraper.ts
// Real DOM scraping via Browserless + Playwright
// Falls back to fetch + Cheerio if Browserless is unavailable

import type { ScrapedData } from '@/types'

const BROWSERLESS_URL = 'wss://chrome.browserless.io'
const TIMEOUT = 30_000

// ── Main scraping function ────────────────────────────────────────────────────

export async function scrapePage(url: string): Promise<ScrapedData> {
  const start = Date.now()

  // Try Browserless first (real headless browser)
  if (process.env.BROWSERLESS_API_KEY) {
    try {
      return await scrapeWithBrowserless(url, start)
    } catch (e) {
      console.warn('[scraper] Browserless failed, falling back to fetch:', e)
    }
  }

  // Fallback: fetch + Cheerio (no JS rendering)
  return await scrapeWithFetch(url, start)
}

// ── Browserless / Playwright ──────────────────────────────────────────────────

async function scrapeWithBrowserless(url: string, start: number): Promise<ScrapedData> {
  const { chromium } = await import('playwright-core')

  const wsEndpoint = `${BROWSERLESS_URL}?token=${process.env.BROWSERLESS_API_KEY}`

  const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: TIMEOUT })

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    })

    const page = await context.newPage()

    // Intercept response headers
    let responseHeaders: Record<string, string> = {}
    let statusCode = 200

    page.on('response', async (response) => {
      if (response.url() === url || response.url() === url + '/') {
        statusCode = response.status()
        const hdrs = response.headers()
        responseHeaders = Object.fromEntries(
          Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), v])
        )
      }
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT })

    // Extract everything we need in one evaluate call
    const pageData = await page.evaluate(() => {
      // Fonts
      const fontFamilies = new Set<string>()
      document.querySelectorAll('*').forEach((el) => {
        const ff = window.getComputedStyle(el).fontFamily
        if (ff) ff.split(',').forEach((f) => fontFamilies.add(f.trim().replace(/['"]/g, '')))
      })

      // Colors (from computed styles, most common)
      const colorMap = new Map<string, number>()
      document.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el)
        ;[s.color, s.backgroundColor, s.borderColor].forEach((c) => {
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
            colorMap.set(c, (colorMap.get(c) || 0) + 1)
          }
        })
      })
      const topColors = [...colorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([c]) => c)

      // Scripts
      const scripts = [...document.querySelectorAll('script[src]')]
        .map((s) => (s as HTMLScriptElement).src)
        .filter(Boolean)
        .slice(0, 30)

      // Stylesheets
      const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => (l as HTMLLinkElement).href)
        .filter(Boolean)
        .slice(0, 20)

      // Meta tags
      const metaTags: Record<string, string> = {}
      document.querySelectorAll('meta').forEach((m) => {
        const name = m.getAttribute('name') || m.getAttribute('property') || ''
        const content = m.getAttribute('content') || ''
        if (name && content) metaTags[name] = content
      })

      // Computed styles of key elements
      const body = window.getComputedStyle(document.body)
      const h1 = document.querySelector('h1')
      const h1Styles = h1 ? window.getComputedStyle(h1) : null

      return {
        title: document.title,
        html: document.documentElement.outerHTML.slice(0, 200_000), // cap at 200kb
        fonts: [...fontFamilies].filter(
          (f) => f && !['inherit', 'initial', 'unset', ''].includes(f)
        ),
        colors: topColors,
        scripts,
        stylesheets,
        metaTags,
        computedStyles: {
          bodyBg: body.backgroundColor,
          bodyColor: body.color,
          bodyFont: body.fontFamily,
          bodyFontSize: body.fontSize,
          bodyLineHeight: body.lineHeight,
          h1Font: h1Styles?.fontFamily || '',
          h1Size: h1Styles?.fontSize || '',
          h1Weight: h1Styles?.fontWeight || '',
          h1LetterSpacing: h1Styles?.letterSpacing || '',
        },
      }
    })

    // Desktop screenshot
    const screenshotBuffer = process.env.ENABLE_SCREENSHOT !== 'false'
      ? await page.screenshot({ fullPage: false, type: 'jpeg', quality: 80 })
      : null

    // Mobile screenshot
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(500)
    const screenshotMobileBuffer = process.env.ENABLE_SCREENSHOT !== 'false'
      ? await page.screenshot({ fullPage: false, type: 'jpeg', quality: 80 })
      : null

    await context.close()

    return {
      url,
      title: pageData.title,
      html: pageData.html,
      computedStyles: pageData.computedStyles,
      fonts: pageData.fonts,
      colors: pageData.colors,
      headers: pageData.computedStyles,
      metaTags: pageData.metaTags,
      scripts: pageData.scripts,
      stylesheets: pageData.stylesheets,
      responseHeaders,
      statusCode,
      loadTime: Date.now() - start,
      screenshotBase64: screenshotBuffer
        ? screenshotBuffer.toString('base64')
        : undefined,
      screenshotMobileBase64: screenshotMobileBuffer
        ? screenshotMobileBuffer.toString('base64')
        : undefined,
    }
  } finally {
    await browser.close()
  }
}

// ── Fetch + Cheerio fallback ──────────────────────────────────────────────────

async function scrapeWithFetch(url: string, start: number): Promise<ScrapedData> {
  const { load } = await import('cheerio')

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DesignCloneBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(TIMEOUT),
  })

  const html = await res.text()
  const responseHeaders = Object.fromEntries(res.headers.entries())
  const $ = load(html)

  // Extract font links
  const fonts: string[] = []
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/family=([^&:]+)/)
    if (match) fonts.push(decodeURIComponent(match[1]).replace(/\+/g, ' '))
  })
  $('style').each((_, el) => {
    const text = $(el).html() || ''
    const matches = text.matchAll(/font-family:\s*['"]?([^'";,]+)/g)
    for (const m of matches) fonts.push(m[1].trim())
  })

  // Meta tags
  const metaTags: Record<string, string> = {}
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || ''
    const content = $(el).attr('content') || ''
    if (name && content) metaTags[name] = content
  })

  // Scripts
  const scripts: string[] = []
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || ''
    if (src) scripts.push(src)
  })

  // Stylesheets
  const stylesheets: string[] = []
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (href) stylesheets.push(href)
  })

  return {
    url,
    title: $('title').text() || '',
    html: html.slice(0, 200_000),
    computedStyles: {},
    fonts: [...new Set(fonts)],
    colors: [],
    headers: {},
    metaTags,
    scripts,
    stylesheets,
    responseHeaders,
    statusCode: res.status,
    loadTime: Date.now() - start,
  }
}
