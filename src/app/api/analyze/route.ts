// src/app/api/analyze/route.ts
// Streaming analysis endpoint — emits SSE events as steps complete

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { scrapePage } from '@/lib/scraper'
import { analyzeWithClaude } from '@/lib/analyzer'
import { getCached, setCached } from '@/lib/cache'

export const runtime = 'nodejs'
export const maxDuration = 60

const RequestSchema = z.object({
  url: z.string().url(),
  creativeMode: z.boolean().optional().default(false),
  forceRefresh: z.boolean().optional().default(false),
})

type StepEvent = {
  type: 'step'
  step: number
  total: number
  label: string
}

type ResultEvent = {
  type: 'result'
  data: object
  cached: boolean
}

type ErrorEvent = {
  type: 'error'
  error: string
}

type SSEEvent = StepEvent | ResultEvent | ErrorEvent

function encode(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

const STEPS = [
  'Fetching page structure',
  'Extracting DOM & computed styles',
  'Detecting fonts & colors',
  'Scanning response headers',
  'Sending to Claude AI',
  'Analyzing design tokens',
  'Assessing security posture',
  'Generating code & prompts',
]

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = (event: SSEEvent) =>
    writer.write(encoder.encode(encode(event)))

  // Run analysis in background
  ;(async () => {
    try {
      const body = await req.json()
      const { url, creativeMode, forceRefresh } = RequestSchema.parse(body)

      // Step 1: Check cache
      await send({ type: 'step', step: 1, total: STEPS.length, label: STEPS[0] })

      if (!forceRefresh) {
        const cached = await getCached(url)
        if (cached) {
          await send({ type: 'result', data: cached, cached: true })
          await writer.close()
          return
        }
      }

      // Step 2-4: Scrape with Browserless
      await send({ type: 'step', step: 2, total: STEPS.length, label: STEPS[1] })
      const scraped = await scrapePage(url)

      await send({ type: 'step', step: 3, total: STEPS.length, label: STEPS[2] })
      await new Promise(r => setTimeout(r, 100)) // yield

      await send({ type: 'step', step: 4, total: STEPS.length, label: STEPS[3] })
      await new Promise(r => setTimeout(r, 100))

      // Step 5-8: Claude analysis
      await send({ type: 'step', step: 5, total: STEPS.length, label: STEPS[4] })
      await send({ type: 'step', step: 6, total: STEPS.length, label: STEPS[5] })

      const result = await analyzeWithClaude(scraped, creativeMode)

      await send({ type: 'step', step: 7, total: STEPS.length, label: STEPS[6] })
      await send({ type: 'step', step: 8, total: STEPS.length, label: STEPS[7] })

      // Cache result
      await setCached(url, result)

      await send({ type: 'result', data: result, cached: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await send({ type: 'error', error: message })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
