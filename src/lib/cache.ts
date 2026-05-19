// src/lib/cache.ts
// In-memory cache for analysis results.
// To add Redis later: install @upstash/redis and extend these functions.

import type { AnalysisResult } from '@/types'

const TTL = parseInt(process.env.CACHE_TTL || '3600') * 1000 // convert to ms

const memCache = new Map<string, { data: AnalysisResult; exp: number }>()

function cacheKey(url: string): string {
  return `dca:${url.toLowerCase().replace(/\/$/, '')}`
}

export async function getCached(url: string): Promise<AnalysisResult | null> {
  const key = cacheKey(url)
  const entry = memCache.get(key)
  if (!entry) return null
  if (entry.exp < Date.now()) {
    memCache.delete(key)
    return null
  }
  return entry.data
}

export async function setCached(url: string, data: AnalysisResult): Promise<void> {
  memCache.set(cacheKey(url), { data, exp: Date.now() + TTL })
}

export async function invalidate(url: string): Promise<void> {
  memCache.delete(cacheKey(url))
}
