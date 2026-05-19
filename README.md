# DesignClone AI

Clone any website's design instantly — extract design tokens, detect fonts, analyze security vulnerabilities, and generate production-ready Next.js code.

## Stack

- **Next.js 15** — App Router, React 19, Server Actions
- **Playwright + Browserless** — real headless DOM scraping
- **Claude AI** — design + infrastructure + security analysis
- **Tailwind CSS 4** — styling
- **JSZip** — real .zip project export
- **TypeScript** — full type safety
- **Zod** — runtime validation

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Main UI (client component)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── analyze/route.ts  # SSE streaming analysis endpoint
│       ├── export/route.ts   # Real ZIP generator endpoint
│       └── fonts/route.ts    # Google Fonts metadata endpoint
├── lib/
│   ├── scraper.ts            # Browserless + Playwright scraper
│   ├── analyzer.ts           # Claude AI analysis engine
│   ├── cache.ts              # Upstash Redis / in-memory cache
│   └── zip-generator.ts      # Full Next.js project ZIP builder
└── types/
    └── index.ts              # All TypeScript types
```

## Getting started

```bash
cp .env.example .env.local
# Fill in your API keys

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✓ | Claude AI API key |
| `BROWSERLESS_API_KEY` | ✓ | Browserless.io key for real scraping |
| `NEXT_PUBLIC_GOOGLE_FONTS_API_KEY` | — | Google Fonts metadata |
| `UPSTASH_REDIS_REST_URL` | — | Redis cache URL |
| `UPSTASH_REDIS_REST_TOKEN` | — | Redis cache token |
| `CACHE_TTL` | — | Cache duration in seconds (default: 3600) |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Set all environment variables in the Vercel dashboard. Browserless handles Playwright in production — no extra configuration needed.

## How it works

1. User enters a URL
2. `/api/analyze` opens a streaming SSE connection
3. Browserless launches a real Chromium browser, loads the page
4. Playwright extracts: computed styles, fonts, colors, response headers, screenshots
5. Scraped data is sent to Claude with a detailed system prompt
6. Claude returns a structured JSON with design tokens, infrastructure analysis, security vulnerabilities, generated code, and vibe prompt
7. Result is cached in Redis (or memory) for 1 hour
8. User can download a real `.zip` via `/api/export` — a complete Next.js 15 project ready for `npm install`

## Features

- **Real scraping** — Playwright via Browserless, not just AI guessing
- **Design tokens** — colors, typography, spacing, effects extracted from real computed styles
- **Font detection** — Google Fonts API integration with import URLs and weight variants
- **Infrastructure analysis** — hosting, CDN, auth, database, APIs, monitoring, CI/CD
- **Security assessment** — OWASP Top 10, HTTP headers, TLS/SSL grade, vulnerabilities with fixes
- **Code generation** — Next.js 15 + Tailwind 4 + vanilla HTML
- **Vibe prompt** — ultra-detailed design replication prompt
- **Real ZIP** — full project with layout, globals.css, components, design-tokens.json, security-report.md
- **Streaming progress** — SSE events show each analysis step in real time
- **Caching** — Upstash Redis in production, in-memory fallback in dev
- **Creative mode** — slightly enhances the design while preserving brand identity

---

Built with DesignClone AI · 2026
