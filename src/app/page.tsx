'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { AnalysisResult, AnalyzeStreamEvent } from '@/types'

// ── Example URLs ──────────────────────────────────────────────────────────────
const EXAMPLES = [
  'linear.app', 'vercel.com', 'stripe.com', 'arc.net',
  'loom.com', 'raycast.com', 'resend.com', 'notion.so',
]

const STEPS_LABELS = [
  'Fetching page structure',
  'Extracting DOM & computed styles',
  'Detecting fonts & colors',
  'Scanning response headers',
  'Sending to Claude AI',
  'Analyzing design tokens',
  'Assessing security posture',
  'Generating code & prompts',
]

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'tokens' | 'fonts' | 'infra' | 'security' | 'code' | 'vibe' | 'tech'
type CodeLang = 'nextjs' | 'html'

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('')
  const [creativeMode, setCreativeMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('tokens')
  const [codeLang, setCodeLang] = useState<CodeLang>('nextjs')
  const [toast, setToast] = useState<string | null>(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ host: true })
  const [openVulns, setOpenVulns] = useState<Record<string, boolean>>({})
  const abortRef = useRef<AbortController | null>(null)

  // Load history from localStorage
  const [history, setHistory] = useState<AnalysisResult[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    try {
      const h = localStorage.getItem('dca_results')
      if (h) setHistory(JSON.parse(h))
    } catch {}
  }, [])

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  // ── Analysis ────────────────────────────────────────────────────────────────
  const analyze = useCallback(async () => {
    const target = url.trim()
    if (!target) return

    const fullUrl = target.startsWith('http') ? target : `https://${target}`

    setLoading(true)
    setError(null)
    setResult(null)
    setCompletedSteps([])
    setCurrentStep(0)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl, creativeMode }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)
          try {
            const event: AnalyzeStreamEvent = JSON.parse(json)

            if (event.type === 'step' && event.step) {
              setCurrentStep(event.step)
              setCompletedSteps(prev => {
                const next = [...prev]
                for (let i = 1; i < event.step!; i++) {
                  if (!next.includes(i)) next.push(i)
                }
                return next
              })
            }

            if (event.type === 'result' && event.data) {
              const data = event.data as AnalysisResult
              setResult(data)
              setCompletedSteps(STEPS_LABELS.map((_, i) => i + 1))

              // Save to history
              setHistory(prev => {
                const next = [data, ...prev.filter(h => h.url !== data.url)].slice(0, 20)
                try { localStorage.setItem('dca_results', JSON.stringify(next)) } catch {}
                return next
              })

              if (event.cached) showToast('Loaded from cache')
            }

            if (event.type === 'error') {
              setError(event.error || 'Analysis failed')
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message || 'Analysis failed')
      }
    } finally {
      setLoading(false)
    }
  }, [url, creativeMode])

  // ── ZIP download ─────────────────────────────────────────────────────────────
  const downloadZip = async () => {
    if (!result) return
    setZipLoading(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const slug = result.url.replace(/https?:\/\//, '').split('/')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${slug}-designclone.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      showToast('✓ Real .zip downloaded — run npm install')
    } catch (e: unknown) {
      showToast('Export failed: ' + (e instanceof Error ? e.message : 'Unknown'))
    } finally {
      setZipLoading(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const copy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text).then(() => showToast(label))
  }

  const toggleSection = (id: string) =>
    setOpenSections(p => ({ ...p, [id]: !p[id] }))

  const toggleVuln = (id: string) =>
    setOpenVulns(p => ({ ...p, [id]: !p[id] }))

  const sc = (s: number) => s >= 80 ? 'high' : s >= 50 ? 'med' : 'low'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--cr)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 46, borderBottom: '1px solid var(--r)',
        background: 'var(--cr)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 20, height: 20, display: 'grid',
            gridTemplateColumns: '1fr 1fr', gap: 2,
          }}>
            {[1, 0.3, 0.3, 1].map((o, i) => (
              <span key={i} style={{ background: 'var(--ink)', borderRadius: 1, opacity: o }} />
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.3 }}>DesignClone</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1 }}>AI</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', background: 'none', border: '1px solid var(--r)', padding: '3px 10px', borderRadius: 3, cursor: 'pointer' }}
          >
            {showHistory ? '← Analyzer' : 'History'}
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '0 28px 60px' }}>

        {/* HISTORY VIEW */}
        {showHistory ? (
          <div style={{ paddingTop: 28 }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', marginBottom: 16 }}>
              {history.length} analyses saved locally
            </p>
            {history.length === 0 ? (
              <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink4)', padding: 24, border: '1px solid var(--r)', textAlign: 'center' }}>
                No analyses yet.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--r)' }}>
                <thead>
                  <tr>
                    {['URL', 'Framework', 'Score', 'Vulns', 'Analyzed'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--ink4)', padding: '7px 13px', borderBottom: '1px solid var(--r)', fontWeight: 400, background: 'var(--cr2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      style={{ borderBottom: '1px solid rgba(26,25,22,0.05)', cursor: 'pointer' }}
                      onClick={() => { setResult(h); setUrl(h.url); setShowHistory(false); }}
                    >
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)' }}>{h.url.replace('https://', '')}</td>
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)' }}>{h.framework}</td>
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)' }}>{h.security?.overallScore ?? '—'}/100</td>
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)' }}>{h.security?.vulnerabilities?.length ?? 0}</td>
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink4)' }}>{new Date(h.analyzedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            {/* HERO */}
            <div style={{ padding: '48px 0 28px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink3)', display: 'inline-block', animation: 'pk 2.5s ease-in-out infinite' }} />
                Design & infrastructure intelligence · 2026
              </div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px,5vw,52px)', lineHeight: 1.04, letterSpacing: -1.5, fontWeight: 400, marginBottom: 16 }}>
                Clone any design —<br /><em style={{ fontStyle: 'italic', color: 'var(--ink2)' }}>pixel‑perfect, instantly.</em>
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ink2)', maxWidth: 460, lineHeight: 1.65, fontWeight: 300, marginBottom: 26 }}>
                Real Browserless scraping. Extracts DOM, computed styles, fonts, and security headers. Generates production Next.js code in a real .zip.
              </p>

              {/* INPUT */}
              <div style={{ display: 'flex', border: '1px solid var(--r3)', background: '#fff', borderRadius: 3, overflow: 'hidden', marginBottom: 11 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', padding: '0 12px', background: 'var(--cr2)', borderRight: '1px solid var(--r)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', height: 44 }}>https://</span>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
                  placeholder="linear.app"
                  style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', padding: '0 14px', background: '#fff', height: 44 }}
                />
                <button
                  onClick={analyze}
                  disabled={loading}
                  style={{ height: 44, padding: '0 22px', background: loading ? 'var(--ink3)' : 'var(--ink)', color: 'var(--cr)', border: 'none', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 11, height: 11, border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear infinite' }} />
                      Analyzing
                    </>
                  ) : 'Analyze →'}
                </button>
              </div>

              {/* EXAMPLES */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Try</span>
                {EXAMPLES.map(e => (
                  <button key={e} onClick={() => setUrl(e)}
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', padding: '3px 9px', border: '1px solid var(--r)', borderRadius: 2, cursor: 'pointer', background: 'none' }}>
                    {e}
                  </button>
                ))}
              </div>

              {/* CREATIVE TOGGLE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Creative mode</span>
                <div
                  onClick={() => setCreativeMode(!creativeMode)}
                  style={{ width: 30, height: 16, background: creativeMode ? 'var(--ink)' : 'var(--cr3)', border: '1px solid var(--r)', borderRadius: 8, cursor: 'pointer', position: 'relative', transition: 'background .2s' }}
                >
                  <div style={{ position: 'absolute', top: 2, left: creativeMode ? 16 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>
                  {creativeMode ? 'On — enhanced design' : 'Off — faithful clone'}
                </span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--r)', margin: '0 0 26px' }} />

            {/* ERROR */}
            {error && (
              <div style={{ background: 'var(--cr-er-bg, #f5e8e6)', border: '1px solid rgba(92,30,24,.2)', color: '#5c1e18', fontFamily: 'var(--mono)', fontSize: 11, padding: '10px 14px', borderRadius: 2, marginBottom: 16 }}>
                Analysis failed — {error}
              </div>
            )}

            {/* PROGRESS */}
            {loading && (
              <div style={{ paddingTop: 0, marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                  Step {currentStep} of {STEPS_LABELS.length}
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(18px,3vw,26px)', lineHeight: 1.1, marginBottom: 16 }}>
                  {STEPS_LABELS[currentStep - 1] || 'Starting'}<em style={{ fontStyle: 'italic' }}>...</em>
                </div>
                <div style={{ height: 1, background: 'var(--r)', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, height: 1, background: 'var(--ink)', transition: 'width .6s ease', width: `${Math.round(currentStep / STEPS_LABELS.length * 100)}%` }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--r)' }}>
                  {STEPS_LABELS.map((label, i) => {
                    const n = i + 1
                    const done = completedSteps.includes(n)
                    const active = n === currentStep
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '8px 12px',
                        borderBottom: i < STEPS_LABELS.length - 2 ? '1px solid var(--r)' : 'none',
                        borderRight: i % 2 === 0 ? '1px solid var(--r)' : 'none',
                        fontSize: 11.5, color: done ? 'var(--ink2)' : active ? 'var(--ink)' : 'var(--ink4)',
                        fontWeight: active ? 400 : 300,
                        background: active ? '#fff' : 'transparent',
                        transition: 'all .3s',
                      }}>
                        <span style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {done ? '✓' : active ? (
                            <span style={{ width: 10, height: 10, border: '1.5px solid rgba(26,25,22,.15)', borderTopColor: 'var(--ink)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                          ) : (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid rgba(26,25,22,.28)', display: 'inline-block' }} />
                          )}
                        </span>
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <div>
                {/* FW BADGE */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fff', border: '1px solid var(--r)', borderRadius: 3, fontSize: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{result.framework}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>· {result.style}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>{Math.round(result.frameworkConfidence * 100)}% confidence</span>
                  {(result.fonts || []).map(f => (
                    <span key={f.family} style={{ fontFamily: 'var(--mono)', fontSize: 9, background: '#e6edf8', color: '#1e3a5c', border: '1px solid rgba(30,58,92,.15)', padding: '2px 8px', borderRadius: 2 }}>{f.family}</span>
                  ))}
                </div>

                {/* SCREENSHOT */}
                {result.screenshotUrl && (
                  <div style={{ display: 'grid', gridTemplateColumns: result.screenshotMobileUrl ? '2fr 1fr' : '1fr', gap: 12, marginBottom: 18 }}>
                    <img src={result.screenshotUrl} alt="Desktop screenshot" style={{ width: '100%', borderRadius: 4, border: '1px solid var(--r)' }} />
                    {result.screenshotMobileUrl && (
                      <img src={result.screenshotMobileUrl} alt="Mobile screenshot" style={{ width: '100%', borderRadius: 4, border: '1px solid var(--r)' }} />
                    )}
                  </div>
                )}

                {/* TABS */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--r)', marginBottom: 18, overflowX: 'auto' }}>
                  {([
                    ['tokens', 'Design tokens'],
                    ['fonts', 'Fuentes'],
                    ['infra', 'Infraestructura'],
                    ['security', 'Seguridad & Vulns.'],
                    ['code', 'Code'],
                    ['vibe', 'Vibe prompt'],
                    ['tech', 'Tech stack'],
                  ] as [Tab, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      style={{
                        fontFamily: 'var(--sans)', fontSize: 12, color: activeTab === id ? 'var(--ink)' : 'var(--ink3)',
                        padding: '7px 14px 9px', border: 'none', background: 'none',
                        borderBottom: `2px solid ${activeTab === id ? 'var(--ink)' : 'transparent'}`,
                        marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap',
                        fontWeight: activeTab === id ? 500 : 400, transition: 'all .15s',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* TAB: TOKENS */}
                {activeTab === 'tokens' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                    {/* Colors */}
                    <div style={{ background: 'var(--cr)', padding: 18 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Color palette</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                        {(result.colors?.palette || []).map((hex, i) => (
                          <div key={i} title={hex} onClick={() => copy(hex, `Copied ${hex}`)}
                            style={{ width: 22, height: 22, borderRadius: 2, background: hex, border: '1px solid rgba(0,0,0,.08)', cursor: 'pointer' }} />
                        ))}
                      </div>
                      {(['primary', 'secondary', 'background', 'surface', 'accent', 'border'] as const).map(k => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(26,25,22,0.05)', fontSize: 11 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => copy(result.colors?.[k] || '', `Copied ${result.colors?.[k]}`)}>{result.colors?.[k] || '—'}</span>
                        </div>
                      ))}
                    </div>
                    {/* Typography */}
                    <div style={{ background: 'var(--cr)', padding: 18 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Typography</div>
                      <div style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 10 }}>{result.typography?.primaryFont?.split(',')[0].replace(/['"]/g, '') || 'Sans'}</div>
                      {(['headingSize', 'bodySize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const).map(k => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(26,25,22,0.05)', fontSize: 11 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)' }}>{result.typography?.[k] || '—'}</span>
                        </div>
                      ))}
                    </div>
                    {/* Spacing */}
                    <div style={{ background: 'var(--cr)', padding: 18 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Spacing & layout</div>
                      {(['baseUnit', 'containerMaxWidth', 'sectionPadding', 'componentGap'] as const).map(k => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(26,25,22,0.05)', fontSize: 11 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)' }}>{result.spacing?.[k] || '—'}</span>
                        </div>
                      ))}
                      {result.styleNotes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6, fontStyle: 'italic' }}>"{result.styleNotes}"</div>}
                    </div>
                    {/* Effects */}
                    <div style={{ background: 'var(--cr)', padding: 18 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Visual effects</div>
                      {([
                        ['borderRadius', result.effects?.borderRadius],
                        ['boxShadow', result.effects?.boxShadow],
                        ['backdropBlur', result.effects?.backdropBlur ? 'Yes' : '—'],
                        ['gradients', result.effects?.gradients ? 'Yes' : '—'],
                        ['glassmorphism', result.effects?.hasGlassmorphism ? 'Yes' : '—'],
                        ['darkMode', result.effects?.hasDarkMode ? 'Yes' : '—'],
                        ['animations', result.effects?.animations],
                      ] as [string, unknown][]).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,25,22,0.05)' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)' }}>{String(v) || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB: FONTS */}
                {activeTab === 'fonts' && (
                  <div>
                    {(result.fonts || []).length === 0 ? (
                      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink4)', padding: 24 }}>No Google Fonts detected.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--r)', border: '1px solid var(--r)', marginBottom: 14 }}>
                        {(result.fonts || []).map(f => (
                          <div key={f.family} style={{ background: '#fff', padding: 16 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>{f.role} · {f.category}</div>
                            <div style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 8 }}>{f.family}</div>
                            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>The quick brown fox jumps over the lazy dog</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                              {(f.weights || []).map(w => (
                                <span key={w} style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', border: '1px solid var(--r)', borderRadius: 2, background: 'var(--cr)', color: 'var(--ink3)' }}>{w}</span>
                              ))}
                            </div>
                            {f.notes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 10, fontStyle: 'italic', lineHeight: 1.5 }}>"{f.notes}"</div>}
                            <div
                              onClick={() => copy(`<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${f.importUrl}" rel="stylesheet">`, 'Font tag copied')}
                              style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#1e3a5c', background: '#e6edf8', border: '1px solid rgba(30,58,92,.15)', padding: '8px 10px', borderRadius: 2, cursor: 'pointer', lineHeight: 1.5, wordBreak: 'break-all' }}
                            >
                              {`<link href="${f.importUrl.slice(0, 60)}..." />`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: INFRA */}
                {activeTab === 'infra' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                    {([
                      ['host', '🏠', 'Hosting & CDN', 'Provider, type, edge network'],
                      ['auth', '🔐', 'Authentication', 'Provider, methods, session'],
                      ['db', '🗄️', 'Database & data', 'DB, ORM, cache, search'],
                      ['api', '🔗', 'APIs & integrations', 'Pattern, third-party services'],
                      ['mon', '📊', 'Monitoring & CI/CD', 'Observability, pipeline'],
                    ] as [string, string, string, string][]).map(([id, icon, title, sub]) => {
                      const inf = result.infrastructure || {}
                      const data = id === 'host' ? inf.hosting : id === 'auth' ? inf.authentication : id === 'db' ? inf.database : id === 'api' ? inf.apis : { ...inf.monitoring, ...inf.cicd }
                      return (
                        <div key={id} style={{ background: 'var(--cr)' }}>
                          <div onClick={() => toggleSection(id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid var(--r)', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 26, height: 26, border: '1px solid var(--r)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontSize: 13 }}>{icon}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{sub}</div>
                              </div>
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>{openSections[id] ? '− collapse' : '+ expand'}</span>
                          </div>
                          {openSections[id] && data && (
                            <div style={{ padding: '14px 18px' }}>
                              {Object.entries(data).slice(0, 8).map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(26,25,22,0.05)', fontSize: 11 }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{k}</span>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)', maxWidth: '55%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v ?? '—')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* TAB: SECURITY */}
                {activeTab === 'security' && (() => {
                  const sec = result.security || {}
                  const vulns = sec.vulnerabilities || []
                  const crit = vulns.filter(v => v.severity === 'critical').length
                  const high = vulns.filter(v => v.severity === 'high').length
                  const med = vulns.filter(v => v.severity === 'medium').length
                  const low = vulns.filter(v => v.severity === 'low' || v.severity === 'info').length
                  const score = sec.overallScore || 0

                  return (
                    <div>
                      {/* Score summary */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--r)', border: '1px solid var(--r)', marginBottom: 14 }}>
                        {[
                          [score, 'Security score', score >= 80 ? '#2d5016' : score >= 50 ? '#5c3a10' : '#5c1e18'],
                          [crit + high, 'Critical / High', '#5c1e18'],
                          [med, 'Medium', '#5c3a10'],
                          [low, 'Low / Info', 'var(--ink3)'],
                        ].map(([n, label, color], i) => (
                          <div key={i} style={{ background: 'var(--cr)', padding: 14, textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1, marginBottom: 4, color: color as string }}>{String(n)}</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1 }}>{label as string}</div>
                          </div>
                        ))}
                      </div>

                      {/* Vulns list */}
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                        {vulns.length} vulnerabilities detected
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                        {vulns.map((v) => {
                          const sevColors: Record<string, string> = { critical: '#5c1e18', high: '#5c3a10', medium: '#4a3a10', low: '#1e3a5c', info: 'var(--ink3)' }
                          const sevBg: Record<string, string> = { critical: '#f5e8e6', high: '#f5ede0', medium: '#f5f0e0', low: '#e6edf8', info: 'var(--cr2)' }
                          return (
                            <div key={v.id} style={{ background: '#fff', padding: '13px 15px', borderBottom: '1px solid var(--r)' }}>
                              <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 7px', borderRadius: 2, background: sevBg[v.severity], color: sevColors[v.severity], border: `1px solid ${sevColors[v.severity]}33`, flexShrink: 0, textTransform: 'uppercase', letterSpacing: .5, fontWeight: 500 }}>{v.severity}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{v.id} — {v.title}</span>
                                <button onClick={() => toggleVuln(v.id)}
                                  style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                  {openVulns[v.id] ? '− close' : '+ details'}
                                </button>
                              </div>
                              {openVulns[v.id] && (
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(26,25,22,0.05)' }}>
                                  <p style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</p>
                                  {v.evidence && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', padding: '8px 10px', background: 'var(--cr2)', borderRadius: 2, marginBottom: 8 }}><strong style={{ color: 'var(--ink2)' }}>Evidence:</strong> {v.evidence}</div>}
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                    {v.cvss && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 6px', background: '#f5ede0', color: '#5c3a10', borderRadius: 2 }}>CVSS {v.cvss}</span>}
                                    {v.cwe && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 6px', background: '#e6edf8', color: '#1e3a5c', borderRadius: 2 }}>{v.cwe}</span>}
                                  </div>
                                  <div style={{ background: '#e8f0e0', border: '1px solid rgba(45,80,22,.15)', borderRadius: 2, padding: '10px 12px' }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#2d5016', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, fontWeight: 500 }}>✓ Fix</div>
                                    <div style={{ fontSize: 11.5, color: '#2d5016', lineHeight: 1.6 }}>{v.solution}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* TAB: CODE */}
                {activeTab === 'code' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['nextjs', 'html'] as CodeLang[]).map(l => (
                          <button key={l} onClick={() => setCodeLang(l)}
                            style={{ fontFamily: 'var(--mono)', fontSize: 10, color: codeLang === l ? 'var(--cr)' : 'var(--ink3)', background: codeLang === l ? 'var(--ink)' : 'none', border: '1px solid var(--r)', padding: '3px 10px', borderRadius: 2, cursor: 'pointer' }}>
                            {l === 'nextjs' ? 'Next.js 15' : 'HTML + Tailwind'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => copy(codeLang === 'nextjs' ? result.nextjsCode : result.htmlCode, 'Code copied')}
                        style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', background: 'none', border: '1px solid var(--r)', padding: '3px 10px', borderRadius: 2, cursor: 'pointer' }}>
                        Copy
                      </button>
                    </div>
                    <pre style={{ background: '#fff', border: '1px solid var(--r)', borderRadius: 3, padding: 16, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink2)', lineHeight: 1.75, maxHeight: 420, overflow: 'auto', whiteSpace: 'pre' }}>
                      {codeLang === 'nextjs' ? result.nextjsCode : result.htmlCode}
                    </pre>
                  </div>
                )}

                {/* TAB: VIBE */}
                {activeTab === 'vibe' && (
                  <div style={{ border: '1px solid var(--r)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--r)' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, marginBottom: 2 }}>Vibe coding prompt</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Ultra-detailed replication guide</div>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', border: '1px solid var(--r)', padding: '2px 7px', borderRadius: 2 }}>Premium</span>
                    </div>
                    <div style={{ padding: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink2)', lineHeight: 1.9, maxHeight: 380, overflowY: 'auto', whiteSpace: 'pre-wrap', background: '#fff' }}>
                      {result.vibePrompt}
                    </div>
                    <div style={{ display: 'flex', gap: 7, padding: '12px 18px', borderTop: '1px solid var(--r)' }}>
                      <button onClick={() => copy(result.vibePrompt, 'Prompt copied')}
                        style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '6px 14px', borderRadius: 2, cursor: 'pointer', background: 'var(--ink)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                        Copy prompt
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB: TECH */}
                {activeTab === 'tech' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Technology', 'Category', 'Confidence'].map(h => (
                          <th key={h} style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--ink4)', padding: '0 0 8px', borderBottom: '1px solid var(--r)', fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(result.technologies || [])].sort((a, b) => b.confidence - a.confidence).map(t => (
                        <tr key={t.name} style={{ borderBottom: '1px solid rgba(26,25,22,0.05)' }}>
                          <td style={{ padding: '9px 0', fontSize: 12, fontWeight: 500 }}>{t.name}</td>
                          <td style={{ padding: '9px 0' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 6px', background: 'var(--cr2)', color: 'var(--ink3)', borderRadius: 2 }}>{t.category}</span>
                          </td>
                          <td style={{ padding: '9px 0' }}>
                            <span style={{ display: 'inline-block', width: 60, height: 2, background: 'var(--cr3)', borderRadius: 1, verticalAlign: 'middle', marginRight: 6, position: 'relative', overflow: 'hidden' }}>
                              <span style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.round(t.confidence * 100)}%`, background: 'var(--ink2)' }} />
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{Math.round(t.confidence * 100)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* DOWNLOAD STRIP */}
                <div style={{ border: '1px solid var(--r)', padding: '16px 18px', marginTop: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>Ready to export</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                      {result.url.replace('https://', '')} · Next.js 15 · Tailwind 4 · Real .zip · Browserless scraped
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        const blob = new Blob([result.htmlCode || ''], { type: 'text/html' })
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                        a.download = 'designclone-output.html'; a.click()
                      }}
                      style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '7px 15px', borderRadius: 2, cursor: 'pointer', background: 'none', border: '1px solid var(--r)', color: 'var(--ink3)' }}>
                      HTML only
                    </button>
                    <button
                      onClick={() => {
                        const vulns = result.security?.vulnerabilities || []
                        const md = `# Security Report — ${result.url}\n\n${vulns.map(v => `## [${v.severity.toUpperCase()}] ${v.title}\n${v.description}\n\n**Fix:** ${v.solution}`).join('\n\n---\n\n')}`
                        const blob = new Blob([md], { type: 'text/markdown' })
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                        a.download = 'security-report.md'; a.click()
                      }}
                      style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '7px 15px', borderRadius: 2, cursor: 'pointer', background: 'none', border: '1px solid var(--r)', color: 'var(--ink3)' }}>
                      Security report
                    </button>
                    <button
                      onClick={downloadZip}
                      disabled={zipLoading}
                      style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '7px 15px', borderRadius: 2, cursor: zipLoading ? 'not-allowed' : 'pointer', background: zipLoading ? 'var(--ink3)' : 'var(--ink)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {zipLoading ? (
                        <><span style={{ width: 11, height: 11, border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear infinite' }} /> Building...</>
                      ) : '⬇ Download .zip'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FEATURE GRID (empty state) */}
            {!loading && !result && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                {[
                  ['01', 'Browserless scraping', 'Playwright real DOM — CSS computado, fuentes, headers de respuesta reales.'],
                  ['02', 'Google Fonts', 'Detección real de fuentes con import URL, variantes y pesos.'],
                  ['03', 'OWASP Security', 'Análisis OWASP Top 10, headers HTTP, TLS, CVEs y soluciones concretas.'],
                  ['04', 'Real .zip', 'Next.js 15 descargable: layout, globals.css, components, tokens JSON.'],
                ].map(([num, title, desc]) => (
                  <div key={num} style={{ background: 'var(--cr)', padding: '18px 16px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{num}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.5, fontWeight: 300 }}>{desc}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--ink)', color: 'var(--cr)', fontFamily: 'var(--mono)', fontSize: 11, padding: '10px 18px', borderRadius: 3, zIndex: 999, animation: 'tfade 2.8s forwards' }}>
          {toast}
        </div>
      )}

      {/* CSS ANIMATIONS */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pk { 0%,100%{opacity:1}50%{opacity:.3} }
        @keyframes tfade { 0%{opacity:0;transform:translateY(6px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0} }
      `}</style>
    </div>
  )
}
