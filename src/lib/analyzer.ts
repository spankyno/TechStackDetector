// src/lib/analyzer.ts
// Sends scraped data to Claude for deep design + infra + security analysis

import Anthropic from '@anthropic-ai/sdk'
import type { ScrapedData, AnalysisResult } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function analyzeWithClaude(
  scraped: ScrapedData,
  creativeMode = false
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(creativeMode)
  const userPrompt = buildUserPrompt(scraped)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  const parsed = parseJSON(raw)

  return {
    id: crypto.randomUUID(),
    url: scraped.url,
    analyzedAt: new Date().toISOString(),
    duration: scraped.loadTime,
    scrapedAt: new Date().toISOString(),
    screenshotUrl: scraped.screenshotBase64
      ? `data:image/webp;base64,${scraped.screenshotBase64}`
      : undefined,
    screenshotMobileUrl: scraped.screenshotMobileBase64
      ? `data:image/webp;base64,${scraped.screenshotMobileBase64}`
      : undefined,
    ...parsed,
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(creativeMode: boolean): string {
  return `You are DesignClone AI — the most advanced web design and infrastructure analysis engine of 2026. You receive real scraped DOM data, computed styles, response headers, and page metadata, then produce a complete JSON analysis.

Return ONLY a raw JSON object. No markdown, no backticks, no explanation.

${creativeMode
  ? 'CREATIVE MODE: Tastefully enhance the design while preserving brand identity.'
  : 'FAITHFUL MODE: Replicate as closely as possible to the original.'
}

JSON schema (all fields required):
{
  "framework": "Next.js|Webflow|Framer|Squarespace|Nuxt|Astro|SvelteKit|Remix|Custom|Unknown",
  "frameworkConfidence": 0.0-1.0,
  "style": "minimal|glassmorphism|brutalist|editorial|corporate|playful|luxury|technical|neomorphic",
  "styleNotes": "2-sentence visual identity description",

  "colors": {
    "primary":"#hex","secondary":"#hex","background":"#hex","surface":"#hex",
    "text":"#hex","textMuted":"#hex","accent":"#hex","border":"#hex",
    "palette":["#hex","#hex","#hex","#hex","#hex","#hex"]
  },
  "typography": {
    "primaryFont":"exact name","secondaryFont":"name or null","monoFont":"name or null",
    "headingSize":"clamp(32px,5vw,64px)","bodySize":"15px",
    "fontWeight":"300/400/600","lineHeight":"1.6","letterSpacing":"-0.5px"
  },
  "spacing": {
    "baseUnit":"8px","containerMaxWidth":"1200px",
    "sectionPadding":"96px 0","componentGap":"24px"
  },
  "effects": {
    "borderRadius":"8px","boxShadow":"none|subtle|medium|strong",
    "backdropBlur":false,"gradients":true,"animations":"none|subtle|moderate|heavy",
    "hasGlassmorphism":false,"hasDarkMode":true,"hasNoise":false
  },
  "components": ["nav","hero","cards","pricing","footer"],

  "fonts": [
    {
      "family":"exact Google Fonts name",
      "role":"primary|secondary|mono|display",
      "weights":["300","400","500","600","700"],
      "isGoogleFont":true,
      "importUrl":"https://fonts.googleapis.com/css2?family=Name:wght@300;400;500;600;700&display=swap",
      "cssVariable":"--font-primary",
      "tailwindKey":"sans|serif|mono|display",
      "category":"sans-serif|serif|monospace|display",
      "notes":"Why this font suits this brand"
    }
  ],

  "infrastructure": {
    "hosting":{"provider":"string","confidence":0.9,"region":"string","type":"string","notes":"string"},
    "cdn":{"provider":"string","confidence":0.85,"features":["string"]},
    "authentication":{"provider":"string","confidence":0.8,"methods":["string"],"hasSSO":false,"hasMFA":false,"sessionStrategy":"string","notes":"string"},
    "database":{"primary":"string","primaryConfidence":0.75,"orm":"string","caching":"string","searchEngine":"string","hasRealtime":false,"notes":"string"},
    "apis":{"pattern":"REST|GraphQL|tRPC","thirdParty":[{"name":"string","category":"string","confidence":0.9}],"internalApiPrefix":"string","hasWebhooks":false},
    "monitoring":{"errorTracking":"string","analytics":"string","logging":"string","uptime":"string","performance":"string"},
    "cicd":{"platform":"string","repository":"string","deploymentStrategy":"string","hasAutomatedTests":false},
    "email":{"provider":"string","confidence":0.7},
    "featureFlags":"string",
    "internationalisation":false,
    "mobileStrategy":"Responsive|PWA|Native|Unknown",
    "accessibilityScore":0
  },

  "security": {
    "overallScore":0,
    "scoreLabel":"Excellent|Good|Fair|Poor|Critical",
    "riskLevel":"Low|Medium|High|Critical",
    "headers": {
      "contentSecurityPolicy":"present|partial|missing",
      "strictTransportSecurity":"present|missing",
      "xFrameOptions":"present|missing",
      "xContentTypeOptions":"present|missing",
      "referrerPolicy":"present|missing",
      "permissionsPolicy":"present|missing",
      "crossOriginOpenerPolicy":"present|missing",
      "crossOriginResourcePolicy":"present|missing"
    },
    "ssl":{"grade":"A+|A|B|C|F|Unknown","provider":"string","hsts":true,"hstsMaxAge":"31536000","tlsVersion":"1.3"},
    "rateLimit":"detected|likely|not detected",
    "botProtection":"string",
    "ddosProtection":"string",
    "vulnerabilities": [
      {
        "id":"VULN-001",
        "title":"string",
        "severity":"critical|high|medium|low|info",
        "category":"OWASP A01|OWASP A02|OWASP A03|OWASP A04|OWASP A05|OWASP A06|OWASP A07|OWASP A08|OWASP A09|OWASP A10|Header Missing|TLS Issue|Information Disclosure|Supply Chain|Privacy|Configuration",
        "description":"Clear technical description",
        "evidence":"What in the scraped data indicates this",
        "cvss":"0.0",
        "cwe":"CWE-XXX",
        "affected":"Affected surface",
        "solution":"Specific actionable fix with code example",
        "references":["string"]
      }
    ],
    "recommendations":["string"]
  },

  "technologies":[{"name":"string","confidence":0.9,"category":"string"}],
  "nextjsCode":"Complete Next.js 15 + Tailwind 4 page.tsx (120-150 lines). Include Google Fonts import. Full homepage with nav, hero, features section, CTA, footer. Real brand copy from the scraped title and meta. Actual working Tailwind classes using the detected colors.",
  "htmlCode":"Complete standalone HTML (100-120 lines) with Tailwind CDN and Google Fonts link. Same layout.",
  "vibePrompt":"Ultra-detailed 500-600 word vibe coding prompt. 7 sections: 1) Visual soul, 2) Color philosophy (exact hex), 3) Typography (exact font names + import URLs), 4) Spacing doctrine, 5) Component language, 6) Motion personality, 7) Step-by-step recreation guide."
}

IMPORTANT: Use the actual response headers provided to accurately assess security headers. Use the detected scripts and stylesheets to identify technologies. Use the computed styles to extract real typography values. Generate 10-14 vulnerabilities covering OWASP Top 10, headers, TLS, info disclosure, supply chain, and privacy. Each vulnerability MUST have a specific, actionable solution.`
}

function buildUserPrompt(scraped: ScrapedData): string {
  // Build a condensed but rich context from scraped data
  const headerSummary = Object.entries(scraped.responseHeaders)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')

  const scriptsSummary = scraped.scripts
    .map((s) => s.replace(/^https?:\/\//, '').split('?')[0])
    .slice(0, 20)
    .join(', ')

  const stylesSummary = scraped.stylesheets
    .map((s) => s.replace(/^https?:\/\//, '').split('?')[0])
    .slice(0, 10)
    .join(', ')

  // Extract key HTML sections (head + first ~10kb of body)
  const htmlSnippet = scraped.html.slice(0, 12_000)

  return `Analyze this website: ${scraped.url}

## Real scraped data

### Page info
- Title: ${scraped.title}
- Status code: ${scraped.statusCode}
- Load time: ${scraped.loadTime}ms

### Response headers (REAL — use for security analysis)
${headerSummary || '  (no headers captured — fallback mode)'}

### Computed styles (REAL)
${Object.entries(scraped.computedStyles).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (no computed styles — fallback mode)'}

### Detected fonts
${scraped.fonts.slice(0, 15).join(', ') || 'none detected'}

### Detected colors (top 15)
${scraped.colors.slice(0, 15).join(', ') || 'none detected'}

### Scripts loaded
${scriptsSummary || 'none'}

### Stylesheets
${stylesSummary || 'none'}

### Meta tags
${Object.entries(scraped.metaTags).slice(0, 15).map(([k, v]) => `  ${k}: ${v.slice(0, 100)}`).join('\n') || '  none'}

### HTML snippet (head + opening body)
\`\`\`html
${htmlSnippet}
\`\`\`

Based on ALL this real data, generate the complete analysis JSON.`
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseJSON(raw: string): Omit<AnalysisResult, 'id' | 'url' | 'analyzedAt' | 'duration' | 'scrapedAt' | 'screenshotUrl' | 'screenshotMobileUrl'> {
  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No valid JSON in Claude response')
    return JSON.parse(match[0])
  }
}
