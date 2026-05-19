import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(url: string): string {
  return url
    .replace(/https?:\/\//, '')
    .split('/')[0]
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
