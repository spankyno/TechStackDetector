// src/app/api/fonts/route.ts
// Fetches real font metadata from Google Fonts API

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const families = searchParams.get('families')?.split(',').filter(Boolean) || []

  if (!families.length) {
    return NextResponse.json({ fonts: [] })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY

  if (!apiKey) {
    // Return synthetic font data without API key
    const fonts = families.map(buildSyntheticFont)
    return NextResponse.json({ fonts, source: 'synthetic' })
  }

  try {
    const results = await Promise.all(families.map(f => fetchFontFromGoogle(f, apiKey)))
    const fonts = results.filter(Boolean)
    return NextResponse.json({ fonts, source: 'google-api' })
  } catch (err) {
    console.error('[fonts] Google Fonts API error:', err)
    const fonts = families.map(buildSyntheticFont)
    return NextResponse.json({ fonts, source: 'synthetic-fallback' })
  }
}

async function fetchFontFromGoogle(family: string, apiKey: string) {
  const clean = family.replace(/['"]/g, '').trim()
  const encoded = encodeURIComponent(clean)

  const res = await fetch(
    `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&family=${encoded}`,
    { next: { revalidate: 86400 } } // cache 24h
  )

  if (!res.ok) return buildSyntheticFont(family)

  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return buildSyntheticFont(family)

  const weights = Object.keys(item.files || {})
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => parseInt(a) - parseInt(b))

  const slug = item.family.replace(/\s+/g, '+')

  return {
    family: item.family,
    category: item.category,
    weights: weights.length ? weights : ['400'],
    importUrl: `https://fonts.googleapis.com/css2?family=${slug}:wght@${(weights.length ? weights : ['300', '400', '500', '600', '700']).join(';')}&display=swap`,
    cssVariable: `--font-${item.family.toLowerCase().replace(/\s+/g, '-')}`,
    tailwindKey: item.category === 'monospace' ? 'mono' : item.category === 'serif' ? 'serif' : 'sans',
    isGoogleFont: true,
    verified: true,
  }
}

function buildSyntheticFont(family: string) {
  const clean = family.replace(/['"]/g, '').trim()
  const slug = clean.replace(/\s+/g, '+')
  const isSerif = /serif/i.test(clean)
  const isMono = /mono|code|courier/i.test(clean)

  return {
    family: clean,
    category: isMono ? 'monospace' : isSerif ? 'serif' : 'sans-serif',
    weights: ['300', '400', '500', '600', '700'],
    importUrl: `https://fonts.googleapis.com/css2?family=${slug}:wght@300;400;500;600;700&display=swap`,
    cssVariable: `--font-${clean.toLowerCase().replace(/\s+/g, '-')}`,
    tailwindKey: isMono ? 'mono' : isSerif ? 'serif' : 'sans',
    isGoogleFont: true,
    verified: false,
  }
}
