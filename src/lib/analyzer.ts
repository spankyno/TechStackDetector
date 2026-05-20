// src/lib/analyzer.ts
// Pure DOM-based analysis — no AI, no API keys required.
// Extracts design tokens, technologies, and security data from real scraped data.

import type { ScrapedData, AnalysisResult, DetectedFont, Technology, Vulnerability, SecurityHeaders } from '@/types'

export async function analyzeWithClaude(
  scraped: ScrapedData,
  _creativeMode = false
): Promise<AnalysisResult> {
  const start = Date.now()

  const colors = extractColors(scraped)
  const typography = extractTypography(scraped)
  const fonts = extractFonts(scraped)
  const spacing = extractSpacing(scraped)
  const effects = extractEffects(scraped)
  const technologies = detectTechnologies(scraped)
  const framework = detectFramework(scraped, technologies)
  const infrastructure = extractInfrastructure(scraped, technologies)
  const security = extractSecurity(scraped)
  const components = detectComponents(scraped)
  const style = detectStyle(scraped, colors, effects)

  return {
    id: crypto.randomUUID(),
    url: scraped.url,
    analyzedAt: new Date().toISOString(),
    duration: Date.now() - start,
    scrapedAt: new Date().toISOString(),
    framework: framework.name,
    frameworkConfidence: framework.confidence,
    style,
    styleNotes: buildStyleNotes(style, colors, typography),
    colors,
    typography,
    spacing,
    effects,
    components,
    fonts,
    infrastructure,
    security,
    technologies,
    nextjsCode: '',
    htmlCode: '',
    vibePrompt: '',
    screenshotUrl: scraped.screenshotBase64
      ? `data:image/jpeg;base64,${scraped.screenshotBase64}`
      : undefined,
    screenshotMobileUrl: scraped.screenshotMobileBase64
      ? `data:image/jpeg;base64,${scraped.screenshotMobileBase64}`
      : undefined,
  }
}

// ── Color extraction ──────────────────────────────────────────────────────────

function extractColors(scraped: ScrapedData) {
  const cs = scraped.computedStyles

  // Convert rgb() to hex
  const toHex = (rgb: string): string => {
    const m = rgb.match(/\d+/g)
    if (!m || m.length < 3) return '#000000'
    return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
  }

  const rawColors = scraped.colors.map(toHex).filter(h => h !== '#000000' && h !== '#ffffff')
  const unique = [...new Set(rawColors)].slice(0, 12)

  const bg = cs.bodyBg ? toHex(cs.bodyBg) : '#ffffff'
  const text = cs.bodyColor ? toHex(cs.bodyColor) : '#000000'

  // Heuristic: darkest frequent color = primary, most saturated = accent
  const primary = unique[0] || '#000000'
  const accent = unique.find(h => {
    const r = parseInt(h.slice(1, 3), 16)
    const g = parseInt(h.slice(3, 5), 16)
    const b = parseInt(h.slice(5, 7), 16)
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    return (max - min) > 80
  }) || unique[1] || '#333333'

  return {
    primary,
    secondary: unique[2] || '#555555',
    background: bg,
    surface: unique[3] || '#f5f5f5',
    text,
    textMuted: unique[4] || '#888888',
    accent,
    border: unique[5] || '#e5e5e5',
    palette: unique.slice(0, 6),
  }
}

// ── Typography extraction ─────────────────────────────────────────────────────

function extractTypography(scraped: ScrapedData) {
  const cs = scraped.computedStyles
  const cleanFont = (f: string) => f?.split(',')[0].replace(/['"]/g, '').trim() || 'sans-serif'

  return {
    primaryFont: cleanFont(cs.bodyFont || cs.h1Font || ''),
    secondaryFont: cs.h1Font && cs.h1Font !== cs.bodyFont ? cleanFont(cs.h1Font) : null,
    monoFont: scraped.fonts.find(f => /mono|code|courier/i.test(f)) || null,
    headingSize: cs.h1Size || 'clamp(32px, 5vw, 64px)',
    bodySize: cs.bodyFontSize || '16px',
    fontWeight: cs.h1Weight ? `${cs.bodyFont ? '400' : ''}/${cs.h1Weight}` : '400/700',
    lineHeight: cs.bodyLineHeight || '1.6',
    letterSpacing: cs.h1LetterSpacing || 'normal',
  }
}

// ── Font detection ────────────────────────────────────────────────────────────

function extractFonts(scraped: ScrapedData): DetectedFont[] {
  const googleFonts: DetectedFont[] = []

  // Parse Google Fonts links from stylesheets
  for (const sheet of scraped.stylesheets) {
    if (!sheet.includes('fonts.googleapis.com')) continue
    const match = sheet.match(/family=([^&]+)/)
    if (!match) continue

    const families = decodeURIComponent(match[1]).split('|')
    for (const fam of families) {
      const [name, variants] = fam.split(':')
      const clean = name.replace(/\+/g, ' ').trim()
      const weights = variants
        ? variants.replace('wght@', '').split(';').filter(w => /^\d+$/.test(w))
        : ['400']
      const slug = clean.replace(/\s+/g, '+')
      const isSerif = /serif/i.test(clean)
      const isMono = /mono|code/i.test(clean)

      googleFonts.push({
        family: clean,
        role: googleFonts.length === 0 ? 'primary' : googleFonts.length === 1 ? 'secondary' : 'mono',
        weights: weights.length ? weights : ['300', '400', '500', '600', '700'],
        isGoogleFont: true,
        importUrl: `https://fonts.googleapis.com/css2?family=${slug}:wght@${(weights.length ? weights : ['300','400','500','600','700']).join(';')}&display=swap`,
        cssVariable: `--font-${clean.toLowerCase().replace(/\s+/g, '-')}`,
        tailwindKey: isMono ? 'mono' : isSerif ? 'serif' : 'sans',
        category: isMono ? 'monospace' : isSerif ? 'serif' : 'sans-serif',
        notes: `Detected from Google Fonts stylesheet`,
      })
    }
  }

  // Fallback: fonts from computed styles
  if (!googleFonts.length) {
    for (const font of scraped.fonts.slice(0, 3)) {
      if (['system-ui','sans-serif','serif','monospace','inherit'].includes(font)) continue
      const isMono = /mono|code/i.test(font)
      const isSerif = /serif/i.test(font)
      const slug = font.replace(/\s+/g, '+')
      googleFonts.push({
        family: font,
        role: googleFonts.length === 0 ? 'primary' : 'secondary',
        weights: ['400', '700'],
        isGoogleFont: false,
        importUrl: `https://fonts.googleapis.com/css2?family=${slug}:wght@400;700&display=swap`,
        cssVariable: `--font-${font.toLowerCase().replace(/\s+/g, '-')}`,
        tailwindKey: isMono ? 'mono' : isSerif ? 'serif' : 'sans',
        category: isMono ? 'monospace' : isSerif ? 'serif' : 'sans-serif',
        notes: `Detected from computed styles`,
      })
    }
  }

  return googleFonts.slice(0, 4)
}

// ── Spacing ───────────────────────────────────────────────────────────────────

function extractSpacing(scraped: ScrapedData) {
  // Try to detect max-width from HTML patterns
  const widthMatch = scraped.html.match(/max-w(?:idth)?[:\s-]+(\d{3,4}px|\d+rem)/i)
  const containerMatch = scraped.html.match(/container.*?(\d{3,4}px)/i)

  return {
    baseUnit: '8px',
    containerMaxWidth: widthMatch?.[1] || containerMatch?.[1] || '1200px',
    sectionPadding: '80px 0',
    componentGap: '24px',
  }
}

// ── Effects ───────────────────────────────────────────────────────────────────

function extractEffects(scraped: ScrapedData) {
  const html = scraped.html.toLowerCase()
  const hasBlur = html.includes('backdrop-blur') || html.includes('backdrop_blur')
  const hasGlass = hasBlur && html.includes('rgba')
  const hasGradient = html.includes('gradient')
  const hasDark = html.includes('dark:') || html.includes('dark-mode') || html.includes('prefers-color-scheme')
  const hasNoise = html.includes('noise') || html.includes('grain')

  const radiusMatch = scraped.html.match(/border-radius:\s*(\d+px|\d+rem)/i)
    || scraped.html.match(/rounded-(\w+)/i)

  let borderRadius = '8px'
  if (radiusMatch) {
    const r = radiusMatch[1]
    if (r === 'full') borderRadius = '9999px'
    else if (r === 'none') borderRadius = '0px'
    else if (r === 'sm') borderRadius = '4px'
    else if (r === 'lg') borderRadius = '12px'
    else if (r === 'xl') borderRadius = '16px'
    else borderRadius = r
  }

  const hasAnimation = html.includes('transition') || html.includes('animation') || html.includes('framer')
  const hasHeavyAnim = html.includes('gsap') || html.includes('lottie') || html.includes('three')

  return {
    borderRadius,
    boxShadow: html.includes('shadow-xl') || html.includes('shadow-lg') ? 'strong' as const
      : html.includes('shadow') ? 'subtle' as const : 'none' as const,
    backdropBlur: hasBlur,
    gradients: hasGradient,
    animations: hasHeavyAnim ? 'heavy' as const : hasAnimation ? 'moderate' as const : 'none' as const,
    hasGlassmorphism: hasGlass,
    hasDarkMode: hasDark,
    hasNoise,
  }
}

// ── Technology detection ──────────────────────────────────────────────────────

function detectTechnologies(scraped: ScrapedData): Technology[] {
  const techs: Technology[] = []
  const scripts = scraped.scripts.join(' ').toLowerCase()
  const html = scraped.html.toLowerCase()
  const sheets = scraped.stylesheets.join(' ').toLowerCase()
  const headers = scraped.responseHeaders

  const add = (name: string, confidence: number, category: string) =>
    techs.push({ name, confidence, category })

  // Frameworks
  if (scripts.includes('/_next/') || html.includes('__next')) add('Next.js', 0.95, 'Framework')
  else if (scripts.includes('nuxt') || html.includes('__nuxt')) add('Nuxt.js', 0.92, 'Framework')
  else if (html.includes('data-reactroot') || html.includes('react')) add('React', 0.80, 'Framework')
  else if (scripts.includes('vue') || html.includes('__vue')) add('Vue.js', 0.85, 'Framework')
  else if (scripts.includes('svelte')) add('SvelteKit', 0.88, 'Framework')
  else if (html.includes('astro') || scripts.includes('astro')) add('Astro', 0.85, 'Framework')

  // CSS
  if (html.includes('class="') && /\b(flex|grid|px-|py-|text-|bg-|rounded|border)\b/.test(html)) add('Tailwind CSS', 0.90, 'CSS')
  if (sheets.includes('bootstrap')) add('Bootstrap', 0.88, 'CSS')
  if (sheets.includes('fonts.googleapis.com')) add('Google Fonts', 0.99, 'Fonts')

  // CMS / Platforms
  if (html.includes('wp-content') || html.includes('wordpress')) add('WordPress', 0.95, 'CMS')
  if (html.includes('webflow')) add('Webflow', 0.92, 'Platform')
  if (html.includes('framer')) add('Framer', 0.90, 'Platform')
  if (html.includes('shopify')) add('Shopify', 0.95, 'E-commerce')

  // Analytics
  if (scripts.includes('google-analytics') || scripts.includes('gtag')) add('Google Analytics', 0.95, 'Analytics')
  if (scripts.includes('plausible')) add('Plausible', 0.95, 'Analytics')
  if (scripts.includes('segment')) add('Segment', 0.88, 'Analytics')
  if (scripts.includes('posthog')) add('PostHog', 0.90, 'Analytics')
  if (scripts.includes('mixpanel')) add('Mixpanel', 0.88, 'Analytics')

  // Animation
  if (scripts.includes('framer-motion') || scripts.includes('framer_motion')) add('Framer Motion', 0.88, 'Animation')
  if (scripts.includes('gsap')) add('GSAP', 0.92, 'Animation')
  if (scripts.includes('three')) add('Three.js', 0.88, 'Animation')
  if (scripts.includes('lottie')) add('Lottie', 0.85, 'Animation')

  // Payments
  if (scripts.includes('stripe')) add('Stripe', 0.95, 'Payments')
  if (scripts.includes('paddle')) add('Paddle', 0.88, 'Payments')

  // Support / chat
  if (scripts.includes('intercom')) add('Intercom', 0.92, 'Support')
  if (scripts.includes('crisp')) add('Crisp', 0.90, 'Support')
  if (scripts.includes('zendesk')) add('Zendesk', 0.88, 'Support')

  // Hosting signals from headers
  const server = headers['server'] || ''
  const via = headers['via'] || ''
  const xPowered = headers['x-powered-by'] || ''
  if (server.includes('vercel') || headers['x-vercel-id']) add('Vercel', 0.95, 'Hosting')
  if (server.includes('cloudflare') || headers['cf-ray']) add('Cloudflare', 0.95, 'CDN')
  if (xPowered.includes('next')) add('Next.js', 0.90, 'Framework')

  // Dedup by name
  const seen = new Set<string>()
  return techs.filter(t => { if (seen.has(t.name)) return false; seen.add(t.name); return true })
    .sort((a, b) => b.confidence - a.confidence)
}

// ── Framework detection ───────────────────────────────────────────────────────

function detectFramework(scraped: ScrapedData, techs: Technology[]) {
  const frameworks = ['Next.js', 'Nuxt.js', 'SvelteKit', 'Astro', 'Remix', 'Webflow', 'Framer', 'WordPress']
  for (const fw of frameworks) {
    const t = techs.find(t => t.name === fw)
    if (t) return { name: fw, confidence: t.confidence }
  }

  const html = scraped.html.toLowerCase()
  if (html.includes('gatsby')) return { name: 'Gatsby', confidence: 0.82 }
  if (html.includes('squarespace')) return { name: 'Squarespace', confidence: 0.90 }
  if (html.includes('wix')) return { name: 'Wix', confidence: 0.90 }

  return { name: 'Custom', confidence: 0.50 }
}

// ── Infrastructure ────────────────────────────────────────────────────────────

function extractInfrastructure(scraped: ScrapedData, techs: Technology[]) {
  const h = scraped.responseHeaders
  const scripts = scraped.scripts.join(' ').toLowerCase()

  // Hosting
  let hostingProvider = 'Unknown'
  let hostingConfidence = 0.5
  if (h['x-vercel-id'] || (h['server'] || '').includes('vercel')) { hostingProvider = 'Vercel'; hostingConfidence = 0.95 }
  else if ((h['server'] || '').includes('cloudflare')) { hostingProvider = 'Cloudflare Pages'; hostingConfidence = 0.88 }
  else if (h['x-amz-cf-id'] || h['x-amz-request-id']) { hostingProvider = 'AWS'; hostingConfidence = 0.85 }
  else if ((h['server'] || '').includes('netlify') || h['x-nf-request-id']) { hostingProvider = 'Netlify'; hostingConfidence = 0.92 }
  else if ((h['server'] || '').includes('github')) { hostingProvider = 'GitHub Pages'; hostingConfidence = 0.88 }

  // CDN
  let cdnProvider = 'Unknown'
  if (h['cf-ray']) cdnProvider = 'Cloudflare'
  else if (h['x-amz-cf-id']) cdnProvider = 'AWS CloudFront'
  else if (h['x-vercel-id']) cdnProvider = 'Vercel Edge'
  else if (h['x-fastly-request-id']) cdnProvider = 'Fastly'

  // Auth signals
  let authProvider = 'Unknown'
  if (scripts.includes('clerk')) authProvider = 'Clerk'
  else if (scripts.includes('auth0')) authProvider = 'Auth0'
  else if (scripts.includes('supabase')) authProvider = 'Supabase Auth'
  else if (scripts.includes('firebase')) authProvider = 'Firebase Auth'
  else if (scripts.includes('nextauth') || scripts.includes('next-auth')) authProvider = 'NextAuth.js'

  // DB signals
  let dbPrimary = 'Unknown'
  if (scripts.includes('supabase')) dbPrimary = 'Supabase (PostgreSQL)'
  else if (scripts.includes('planetscale')) dbPrimary = 'PlanetScale (MySQL)'
  else if (scripts.includes('firebase')) dbPrimary = 'Firebase Firestore'
  else if (scripts.includes('mongodb')) dbPrimary = 'MongoDB'
  else if (scripts.includes('neon')) dbPrimary = 'Neon (PostgreSQL)'

  // Analytics
  const analyticsMap: Record<string, string> = {
    'google-analytics': 'Google Analytics 4',
    'gtag': 'Google Analytics 4',
    'plausible': 'Plausible Analytics',
    'segment': 'Segment',
    'posthog': 'PostHog',
    'mixpanel': 'Mixpanel',
    'amplitude': 'Amplitude',
  }
  let analytics = 'Not detected'
  for (const [key, val] of Object.entries(analyticsMap)) {
    if (scripts.includes(key)) { analytics = val; break }
  }

  // Error tracking
  let errorTracking = 'Not detected'
  if (scripts.includes('sentry')) errorTracking = 'Sentry'
  else if (scripts.includes('bugsnag')) errorTracking = 'Bugsnag'
  else if (scripts.includes('datadog')) errorTracking = 'Datadog'

  return {
    hosting: {
      provider: hostingProvider,
      confidence: hostingConfidence,
      region: h['x-vercel-id']?.split('::')[0] || 'Unknown',
      type: hostingProvider === 'Vercel' ? 'Serverless' : 'Unknown',
      notes: `Detected from response headers`,
    },
    cdn: {
      provider: cdnProvider,
      confidence: cdnProvider !== 'Unknown' ? 0.90 : 0.3,
      features: cdnProvider !== 'Unknown' ? ['Edge caching', 'DDoS protection', 'Global network'] : [],
    },
    authentication: {
      provider: authProvider,
      confidence: authProvider !== 'Unknown' ? 0.82 : 0.2,
      methods: authProvider !== 'Unknown' ? ['Email/password', 'OAuth'] : [],
      hasSSO: scripts.includes('saml') || scripts.includes('sso'),
      hasMFA: scripts.includes('mfa') || scripts.includes('totp'),
      sessionStrategy: 'Unknown',
      notes: `Detected from loaded scripts`,
    },
    database: {
      primary: dbPrimary,
      primaryConfidence: dbPrimary !== 'Unknown' ? 0.75 : 0.2,
      orm: scripts.includes('prisma') ? 'Prisma' : scripts.includes('drizzle') ? 'Drizzle' : 'Unknown',
      caching: scripts.includes('redis') || scripts.includes('upstash') ? 'Redis' : 'Not detected',
      searchEngine: scripts.includes('algolia') ? 'Algolia' : scripts.includes('typesense') ? 'Typesense' : 'Not detected',
      hasRealtime: scripts.includes('supabase') || scripts.includes('pusher') || scripts.includes('ably'),
      notes: `Detected from loaded scripts`,
    },
    apis: {
      pattern: scripts.includes('graphql') ? 'GraphQL' : scripts.includes('trpc') ? 'tRPC' : 'REST',
      thirdParty: techs
        .filter(t => ['Payments', 'Support', 'Analytics'].includes(t.category))
        .map(t => ({ name: t.name, category: t.category, confidence: t.confidence })),
      internalApiPrefix: '/api',
      hasWebhooks: false,
    },
    monitoring: {
      errorTracking,
      analytics,
      logging: scripts.includes('datadog') ? 'Datadog' : scripts.includes('axiom') ? 'Axiom' : 'Not detected',
      uptime: 'Not detected',
      performance: h['x-vercel-id'] ? 'Vercel Speed Insights' : 'Not detected',
    },
    cicd: {
      platform: hostingProvider === 'Vercel' ? 'Vercel' : hostingProvider === 'Netlify' ? 'Netlify' : 'Unknown',
      repository: 'GitHub',
      deploymentStrategy: hostingProvider === 'Vercel' ? 'Preview deployments' : 'Unknown',
      hasAutomatedTests: false,
    },
    email: {
      provider: scripts.includes('resend') ? 'Resend'
        : scripts.includes('sendgrid') ? 'SendGrid'
        : scripts.includes('postmark') ? 'Postmark' : 'Not detected',
      confidence: 0.7,
    },
    featureFlags: scripts.includes('launchdarkly') ? 'LaunchDarkly'
      : scripts.includes('statsig') ? 'Statsig'
      : scripts.includes('posthog') ? 'PostHog Flags' : 'Not detected',
    internationalisation: scraped.html.includes('lang=') && scraped.html.includes('hreflang'),
    mobileStrategy: 'Responsive' as const,
    accessibilityScore: 0,
  }
}

// ── Security ──────────────────────────────────────────────────────────────────

function extractSecurity(scraped: ScrapedData) {
  const h = scraped.responseHeaders
  const get = (key: string) => h[key.toLowerCase()] || ''

  const csp = get('content-security-policy')
  const hsts = get('strict-transport-security')
  const xfo = get('x-frame-options')
  const xcto = get('x-content-type-options')
  const rp = get('referrer-policy')
  const pp = get('permissions-policy')
  const coop = get('cross-origin-opener-policy')
  const corp = get('cross-origin-resource-policy')

  const headers: SecurityHeaders = {
    contentSecurityPolicy: csp ? (csp.includes('unsafe-inline') ? 'partial' : 'present') : 'missing',
    strictTransportSecurity: hsts ? 'present' : 'missing',
    xFrameOptions: xfo ? 'present' : 'missing',
    xContentTypeOptions: xcto ? 'present' : 'missing',
    referrerPolicy: rp ? 'present' : 'missing',
    permissionsPolicy: pp ? 'present' : 'missing',
    crossOriginOpenerPolicy: coop ? 'present' : 'missing',
    crossOriginResourcePolicy: corp ? 'present' : 'missing',
  }

  // Score: each present header = ~10 points, HSTS + CSP weighted more
  let score = 40 // base
  if (csp && !csp.includes('unsafe-inline')) score += 15
  else if (csp) score += 7
  if (hsts) score += 15
  if (xfo) score += 7
  if (xcto) score += 7
  if (rp) score += 5
  if (pp) score += 5
  if (coop) score += 4
  if (corp) score += 2

  // SSL
  const tlsVersion = get('x-tls-version') || (scraped.url.startsWith('https') ? '1.2+' : 'N/A')
  const hstsMaxAge = hsts.match(/max-age=(\d+)/)?.[1] || 'Unknown'
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'F'

  // Vulnerabilities from real header data
  const vulns: Vulnerability[] = []
  let vulnId = 1
  const vid = () => `VULN-${String(vulnId++).padStart(3, '0')}`

  if (!csp) vulns.push({
    id: vid(), title: 'Missing Content-Security-Policy header',
    severity: 'high', category: 'OWASP A05 Security Misconfiguration',
    description: 'No CSP header detected. This allows execution of arbitrary inline scripts and resources from any origin, exposing the site to XSS attacks.',
    evidence: 'content-security-policy header absent from HTTP response',
    cvss: '7.2', cwe: 'CWE-693',
    affected: 'All pages — HTTP response headers',
    solution: `Add to next.config.ts:\nasync headers() {\n  return [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'nonce-{nonce}'" }] }]\n}`,
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP', 'OWASP A05:2021'],
  })

  if (csp?.includes('unsafe-inline')) vulns.push({
    id: vid(), title: "CSP allows 'unsafe-inline' scripts",
    severity: 'medium', category: 'OWASP A05 Security Misconfiguration',
    description: "The Content-Security-Policy header includes 'unsafe-inline', which negates most XSS protections by allowing inline script execution.",
    evidence: `content-security-policy: ${csp.slice(0, 120)}`,
    cvss: '5.4', cwe: 'CWE-693',
    affected: 'Content-Security-Policy header',
    solution: "Replace 'unsafe-inline' with nonces or hashes. Use __webpack_nonce__ in Next.js with middleware to inject per-request nonces.",
    references: ['https://web.dev/strict-csp/', 'CSP Level 3 spec'],
  })

  if (!hsts) vulns.push({
    id: vid(), title: 'Missing Strict-Transport-Security (HSTS)',
    severity: 'high', category: 'OWASP A02 Cryptographic Failures',
    description: 'No HSTS header found. Browsers may accept HTTP connections, enabling downgrade attacks and SSL stripping.',
    evidence: 'strict-transport-security header absent from HTTP response',
    cvss: '6.5', cwe: 'CWE-319',
    affected: 'All HTTPS endpoints',
    solution: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security', 'OWASP A02:2021'],
  })

  if (hsts && parseInt(hstsMaxAge) < 31536000) vulns.push({
    id: vid(), title: 'HSTS max-age too short',
    severity: 'low', category: 'OWASP A02 Cryptographic Failures',
    description: `HSTS max-age is set to ${hstsMaxAge}s, below the recommended 31536000s (1 year). Short max-age reduces the protection window.`,
    evidence: `strict-transport-security: ${hsts}`,
    cvss: '3.1', cwe: 'CWE-319',
    affected: 'Strict-Transport-Security header',
    solution: 'Set max-age=31536000; includeSubDomains; preload and submit to HSTS preload list.',
    references: ['https://hstspreload.org'],
  })

  if (!xfo && !coop) vulns.push({
    id: vid(), title: 'Missing clickjacking protection',
    severity: 'medium', category: 'OWASP A05 Security Misconfiguration',
    description: 'Neither X-Frame-Options nor Cross-Origin-Opener-Policy is set. The site can be embedded in iframes by any origin, enabling clickjacking attacks.',
    evidence: 'x-frame-options and cross-origin-opener-policy headers absent',
    cvss: '4.3', cwe: 'CWE-1021',
    affected: 'All pages',
    solution: "Add: X-Frame-Options: DENY or Cross-Origin-Opener-Policy: same-origin. In Next.js headers config, add { key: 'X-Frame-Options', value: 'DENY' }.",
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options', 'OWASP A05:2021'],
  })

  if (!xcto) vulns.push({
    id: vid(), title: 'Missing X-Content-Type-Options header',
    severity: 'low', category: 'OWASP A05 Security Misconfiguration',
    description: 'No X-Content-Type-Options: nosniff header. Browsers may MIME-sniff responses, potentially executing non-script content as scripts.',
    evidence: 'x-content-type-options header absent',
    cvss: '3.7', cwe: 'CWE-693',
    affected: 'All responses',
    solution: "Add header: { key: 'X-Content-Type-Options', value: 'nosniff' }",
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'],
  })

  if (!rp) vulns.push({
    id: vid(), title: 'Missing Referrer-Policy header',
    severity: 'low', category: 'Privacy',
    description: 'No Referrer-Policy set. Full URLs (including paths and query params) may be sent as Referer headers to third parties, leaking user navigation data.',
    evidence: 'referrer-policy header absent',
    cvss: '3.1', cwe: 'CWE-200',
    affected: 'All outbound requests',
    solution: "Add: { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }",
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'],
  })

  if (!pp) vulns.push({
    id: vid(), title: 'Missing Permissions-Policy header',
    severity: 'info', category: 'Privacy',
    description: 'No Permissions-Policy header. Browser features (camera, microphone, geolocation) are accessible to any embedded third-party script without restriction.',
    evidence: 'permissions-policy header absent',
    cvss: '2.5', cwe: 'CWE-276',
    affected: 'Browser feature access',
    solution: "Add: { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }",
    references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy'],
  })

  if (!scraped.url.startsWith('https')) vulns.push({
    id: vid(), title: 'Site served over HTTP',
    severity: 'critical', category: 'OWASP A02 Cryptographic Failures',
    description: 'The site is not using HTTPS. All traffic is transmitted in plaintext, enabling interception, tampering, and credential theft.',
    evidence: `URL scheme: ${scraped.url.split(':')[0]}`,
    cvss: '9.1', cwe: 'CWE-319',
    affected: 'Entire site',
    solution: 'Enable HTTPS immediately. Redirect all HTTP traffic to HTTPS. Configure HSTS.',
    references: ['https://developer.mozilla.org/en-US/docs/Glossary/https', 'OWASP A02:2021'],
  })

  // Server header info disclosure
  const server = get('server')
  if (server && (server.includes('/') || /\d/.test(server))) vulns.push({
    id: vid(), title: 'Server header discloses version information',
    severity: 'info', category: 'Information Disclosure',
    description: `The Server header reveals software name and version: "${server}". This information aids attackers in targeting known CVEs.`,
    evidence: `server: ${server}`,
    cvss: '2.6', cwe: 'CWE-200',
    affected: 'Server HTTP header',
    solution: 'Configure your server to return a generic Server header or suppress it entirely.',
    references: ['https://owasp.org/www-project-web-security-testing-guide/'],
  })

  const scoreLabel = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : score >= 30 ? 'Poor' : 'Critical'
  const riskLevel = score >= 70 ? 'Low' : score >= 50 ? 'Medium' : score >= 30 ? 'High' : 'Critical'

  return {
    overallScore: Math.min(score, 100),
    scoreLabel,
    riskLevel: riskLevel as 'Low' | 'Medium' | 'High' | 'Critical',
    headers,
    ssl: {
      grade: grade as 'A+' | 'A' | 'B' | 'C' | 'F' | 'Unknown',
      provider: get('cf-ray') ? 'Cloudflare' : 'Unknown',
      hsts: !!hsts,
      hstsMaxAge,
      tlsVersion,
    },
    rateLimit: (get('x-ratelimit-limit') || get('ratelimit-limit')) ? 'detected' as const : 'not detected' as const,
    botProtection: get('cf-ray') ? 'Cloudflare' : 'Unknown',
    ddosProtection: get('cf-ray') ? 'Cloudflare' : 'Unknown',
    vulnerabilities: vulns,
    recommendations: vulns
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .map(v => v.title)
      .slice(0, 5),
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function detectComponents(scraped: ScrapedData): string[] {
  const html = scraped.html.toLowerCase()
  const components: string[] = []
  if (html.includes('<nav') || html.includes('navbar')) components.push('nav')
  if (html.includes('hero') || html.includes('<h1')) components.push('hero')
  if (html.includes('<button') || html.includes('btn')) components.push('buttons')
  if (html.includes('card') || html.includes('<article')) components.push('cards')
  if (html.includes('pricing') || html.includes('plan')) components.push('pricing')
  if (html.includes('<form') || html.includes('input type')) components.push('forms')
  if (html.includes('<table')) components.push('tables')
  if (html.includes('testimonial') || html.includes('review')) components.push('testimonials')
  if (html.includes('faq') || html.includes('accordion')) components.push('accordion')
  if (html.includes('<footer')) components.push('footer')
  if (html.includes('modal') || html.includes('dialog')) components.push('modal')
  if (html.includes('banner') || html.includes('alert')) components.push('alerts')
  return components
}

// ── Style detection ───────────────────────────────────────────────────────────

function detectStyle(scraped: ScrapedData, colors: ReturnType<typeof extractColors>, effects: ReturnType<typeof extractEffects>): string {
  const html = scraped.html.toLowerCase()
  if (effects.hasGlassmorphism) return 'glassmorphism'
  if (html.includes('brutalist') || html.includes('brutal')) return 'brutalist'
  if (colors.background.match(/#(f[0-9a-f]{5}|fff)/i) && !effects.gradients) return 'minimal'
  if (html.includes('editorial') || html.includes('serif')) return 'editorial'
  if (effects.gradients && effects.animations !== 'none') return 'playful'
  if (html.includes('enterprise') || html.includes('corporate')) return 'corporate'
  return 'minimal'
}

function buildStyleNotes(style: string, colors: ReturnType<typeof extractColors>, typography: ReturnType<typeof extractTypography>): string {
  return `${style.charAt(0).toUpperCase() + style.slice(1)} aesthetic with ${colors.primary} as primary color. Typography anchored by ${typography.primaryFont || 'system fonts'}.`
}
