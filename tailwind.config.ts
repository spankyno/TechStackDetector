import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#f5f2ec',
          2: '#ede9e1',
          3: '#e4dfd5',
          4: '#d8d3c8',
        },
        ink: {
          DEFAULT: '#1a1916',
          2: '#4a4740',
          3: '#8a8780',
          4: '#b8b5ae',
        },
        ok: { bg: '#e8f0e0', text: '#2d5016' },
        warn: { bg: '#f5ede0', text: '#5c3a10' },
        err: { bg: '#f5e8e6', text: '#5c1e18' },
        info: { bg: '#e6edf8', text: '#1e3a5c' },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
    },
  },
}

export default config
