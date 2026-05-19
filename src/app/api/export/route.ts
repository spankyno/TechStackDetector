// src/app/api/export/route.ts
// Generates and streams a real .zip file of the cloned Next.js project

import { NextRequest, NextResponse } from 'next/server'
import { generateProjectZip } from '@/lib/zip-generator'
import type { AnalysisResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const result: AnalysisResult = await req.json()

    if (!result?.url) {
      return NextResponse.json({ error: 'Invalid analysis data' }, { status: 400 })
    }

    const buffer = await generateProjectZip(result)

    const slug = result.url
      .replace(/https?:\/\//, '')
      .split('/')[0]
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug}-designclone.zip"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export] ZIP generation failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ZIP generation failed' },
      { status: 500 }
    )
  }
}
