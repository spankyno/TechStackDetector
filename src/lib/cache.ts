// src/lib/cache.ts
// Analysis result caching — Upstash Redis in production, in-memory in dev

import type { AnalysisResult } from '@/types'

const TTL = parseInt(process.env.CACHE_TTL || '3600') // 1 hour default

// ── In-memory fallback ────────────────────────────────────────────────────────

const memCache = new Map<string, { data: AnalysisResult; exp: number }>()

function cacheKey(url: string): string {
  return `dca:${url.toLowerCase().replace(/\/$/, '')}`
}

// ── Redis client (optional — add @upstash/redis to deps to enable) ───────────

async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis')
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch {
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCached(url: string): Promise<AnalysisResult | null> {
  const key = cacheKey(url)

  // Try Redis
  const redis = await getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      // fall through to memory
    }
  }

  // Memory fallback
  const entry = memCache.get(key)
  if (entry && entry.exp > Date.now()) return entry.data
  if (entry) memCache.delete(key)

  return null
}

export async function setCached(url: string, data: AnalysisResult): Promise<void> {
  const key = cacheKey(url)

  // Try Redis
  const redis = await getRedis()
  if (redis) {
    try {
      await redis.setex(key, TTL, JSON.stringify(data))
      return
    } catch {
      // fall through
    }
  }

  // Memory fallback
  memCache.set(key, { data, exp: Date.now() + TTL * 1000 })
}

export async function invalidate(url: string): Promise<void> {
  const key = cacheKey(url)
  const redis = await getRedis()
  if (redis) {
    try { await redis.del(key) } catch {}
  }
  memCache.delete(key)
}
