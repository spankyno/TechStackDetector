import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DesignClone AI — Clone any website design instantly',
  description:
    'Extract design tokens, detect fonts, analyze security vulnerabilities, and generate production-ready Next.js code from any public URL.',
  keywords: ['design clone', 'web scraping', 'design tokens', 'Next.js', 'Tailwind CSS'],
  openGraph: {
    title: 'DesignClone AI',
    description: 'Clone any website design instantly',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
