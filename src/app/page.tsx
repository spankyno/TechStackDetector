'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { AnalysisResult, AnalyzeStreamEvent } from '@/types'

const EXAMPLES = [
  'linear.app', 'vercel.com', 'stripe.com', 'arc.net',
  'loom.com', 'raycast.com', 'resend.com', 'notion.so',
]

const STEPS_LABELS = [
  'Fetching page structure',
  'Extracting DOM & computed styles',
  'Detecting fonts & colors',
  'Scanning response headers',
  'Analyzing design tokens',
  'Detecting technologies',
  'Assessing security posture',
  'Building report',
]

type Tab = 'tokens' | 'fonts' | 'infra' | 'security' | 'tech'

export default function Home() {
  const [url, setUrl] = useState('')
  const [creativeMode, setCreativeMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('tokens')
  const [toast, setToast] = useState<string | null>(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ host: true })
  const [openVulns, setOpenVulns] = useState<Record<string, boolean>>({})
  const [history, setHistory] = useState<AnalysisResult[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const h = localStorage.getItem('dca_results')
      if (h) setHistory(JSON.parse(h))
    } catch {}
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

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
          try {
            const event: AnalyzeStreamEvent = JSON.parse(line.slice(6))
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
              setHistory(prev => {
                const next = [data, ...prev.filter(h => h.url !== data.url)].slice(0, 20)
                try { localStorage.setItem('dca_results', JSON.stringify(next)) } catch {}
                return next
              })
              if (event.cached) showToast('Loaded from cache')
            }
            if (event.type === 'error') setError(event.error || 'Analysis failed')
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [url, creativeMode])

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
      showToast('✓ ZIP downloaded — run npm install')
    } catch (e: unknown) {
      showToast('Export failed: ' + (e instanceof Error ? e.message : 'Unknown'))
    } finally {
      setZipLoading(false)
    }
  }

  const copy = (text: string, label = 'Copied') =>
    navigator.clipboard.writeText(text).then(() => showToast(label))

  const toggleSection = (id: string) =>
    setOpenSections(p => ({ ...p, [id]: !p[id] }))

  const toggleVuln = (id: string) =>
    setOpenVulns(p => ({ ...p, [id]: !p[id] }))

  const r = (v: boolean) => v
    ? <span style={styles.byes}>Yes</span>
    : <span style={styles.bno}>—</span>

  const bv = (v: string | undefined) => v && v !== 'Unknown' && v !== 'Not detected'
    ? <span style={styles.bval}>{v}</span>
    : <span style={styles.bno}>{v || '—'}</span>

  return (
    <div style={{ background: 'var(--cr)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={styles.brandMark}>
            {[1, 0.3, 0.3, 1].map((o, i) => (
              <span key={i} style={{ background: 'var(--ink)', borderRadius: 1, opacity: o }} />
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.3 }}>DesignClone</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>AI</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowHistory(!showHistory)} style={styles.nbtn}>
            {showHistory ? '← Analyzer' : 'History'}
          </button>
        </div>
      </nav>

      <main style={styles.main}>

        {/* HISTORY */}
        {showHistory ? (
          <div style={{ paddingTop: 28 }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', marginBottom: 16 }}>
              {history.length} analyses saved locally
            </p>
            {!history.length
              ? <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink4)', padding: 24, border: '1px solid var(--r)', textAlign: 'center' as const }}>No analyses yet.</p>
              : (
                <table style={styles.table}>
                  <thead>
                    <tr>{['URL', 'Framework', 'Score', 'Vulns', 'Analyzed'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(26,25,22,0.05)', cursor: 'pointer' }}
                        onClick={() => { setResult(h); setUrl(h.url); setShowHistory(false) }}>
                        <td style={styles.td}>{h.url.replace('https://', '')}</td>
                        <td style={{ ...styles.td, color: 'var(--ink3)' }}>{h.framework}</td>
                        <td style={{ ...styles.td, color: 'var(--ink3)' }}>{h.security?.overallScore ?? '—'}/100</td>
                        <td style={{ ...styles.td, color: 'var(--ink3)' }}>{h.security?.vulnerabilities?.length ?? 0}</td>
                        <td style={{ ...styles.td, color: 'var(--ink4)' }}>{new Date(h.analyzedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        ) : (
          <>
            {/* HERO */}
            <div style={styles.hero}>
              <div style={styles.kicker}>
                <span style={styles.kpulse} />
                Real DOM scraping · No AI required · 2026
              </div>
              <h1 style={styles.h1}>
                Clone any design —<br />
                <em style={{ fontStyle: 'italic', color: 'var(--ink2)' }}>pixel‑perfect, instantly.</em>
              </h1>
              <p style={styles.herop}>
                Browserless scraping real. Extrae computed styles, fuentes Google, headers de seguridad, tecnologías y genera un ZIP con tokens de diseño estructurados.
              </p>

              {/* INPUT */}
              <div style={styles.ibox}>
                <span style={styles.ipfx}>https://</span>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
                  placeholder="linear.app"
                  style={styles.iinput}
                />
                <button onClick={analyze} disabled={loading} style={{ ...styles.abtn, background: loading ? 'var(--ink3)' : 'var(--ink)' }}>
                  {loading
                    ? <><span style={styles.spinner} /> Analyzing</>
                    : 'Analyze →'}
                </button>
              </div>

              {/* EXAMPLES */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                <span style={styles.exlbl}>Try</span>
                {EXAMPLES.map(e => (
                  <button key={e} onClick={() => setUrl(e)} style={styles.ec}>{e}</button>
                ))}
              </div>

              {/* CREATIVE TOGGLE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={styles.exlbl}>Creative mode</span>
                <div onClick={() => setCreativeMode(!creativeMode)} style={{ ...styles.toggle, background: creativeMode ? 'var(--ink)' : 'var(--cr3)' }}>
                  <div style={{ ...styles.toggleThumb, left: creativeMode ? 16 : 2 }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>
                  {creativeMode ? 'On — enhanced tokens' : 'Off — faithful extraction'}
                </span>
              </div>
            </div>

            <hr style={styles.hr} />

            {/* ERROR */}
            {error && (
              <div style={styles.errorbar}>Analysis failed — {error}</div>
            )}

            {/* PROGRESS */}
            {loading && (
              <div style={{ marginBottom: 28 }}>
                <div style={styles.progkicker}>Step {currentStep} of {STEPS_LABELS.length}</div>
                <div style={styles.progh1}>
                  {STEPS_LABELS[currentStep - 1] || 'Starting'}<em style={{ fontStyle: 'italic' }}>...</em>
                </div>
                <div style={styles.progtrack}>
                  <div style={{ ...styles.progfill, width: `${Math.round(currentStep / STEPS_LABELS.length * 100)}%` }} />
                </div>
                <div style={styles.slist}>
                  {STEPS_LABELS.map((label, i) => {
                    const n = i + 1
                    const done = completedSteps.includes(n)
                    const active = n === currentStep
                    return (
                      <div key={i} style={{
                        ...styles.srow,
                        color: done ? 'var(--ink2)' : active ? 'var(--ink)' : 'var(--ink4)',
                        fontWeight: active ? 400 : 300,
                        background: active ? '#fff' : 'transparent',
                        borderRight: i % 2 === 0 ? '1px solid var(--r)' : 'none',
                        borderBottom: i < STEPS_LABELS.length - 2 ? '1px solid var(--r)' : 'none',
                      }}>
                        <span style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          {done ? '✓' : active
                            ? <span style={styles.spinnerDark} />
                            : <span style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid rgba(26,25,22,.28)', display: 'inline-block' }} />}
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
                <div style={styles.fwbadge}>
                  <span style={{ fontWeight: 500 }}>{result.framework}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>· {result.style}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>{Math.round(result.frameworkConfidence * 100)}% confidence</span>
                  {(result.fonts || []).map(f => (
                    <span key={f.family} style={styles.fontpill}>{f.family}</span>
                  ))}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', marginLeft: 'auto' }}>
                    Scraped in {result.duration}ms
                  </span>
                </div>

                {/* SCREENSHOTS */}
                {result.screenshotUrl && (
                  <div style={{ display: 'grid', gridTemplateColumns: result.screenshotMobileUrl ? '2fr 1fr' : '1fr', gap: 8, marginBottom: 16 }}>
                    <img src={result.screenshotUrl} alt="Desktop" style={{ width: '100%', borderRadius: 3, border: '1px solid var(--r)' }} />
                    {result.screenshotMobileUrl && (
                      <img src={result.screenshotMobileUrl} alt="Mobile" style={{ width: '100%', borderRadius: 3, border: '1px solid var(--r)' }} />
                    )}
                  </div>
                )}

                {/* TABS */}
                <div style={styles.tabs}>
                  {([
                    ['tokens', 'Design tokens'],
                    ['fonts', 'Fuentes'],
                    ['infra', 'Infraestructura'],
                    ['security', 'Seguridad & Vulns.'],
                    ['tech', 'Tech stack'],
                  ] as [Tab, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)} style={{
                      ...styles.tbtn,
                      color: activeTab === id ? 'var(--ink)' : 'var(--ink3)',
                      borderBottom: `2px solid ${activeTab === id ? 'var(--ink)' : 'transparent'}`,
                      fontWeight: activeTab === id ? 500 : 400,
                    }}>{label}</button>
                  ))}
                </div>

                {/* TAB: TOKENS */}
                {activeTab === 'tokens' && (
                  <div style={styles.tgrid}>
                    <div style={styles.tcell}>
                      <div style={styles.tclbl}>Color palette</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' as const }}>
                        {(result.colors?.palette || []).map((hex, i) => (
                          <div key={i} title={hex} onClick={() => copy(hex, `Copied ${hex}`)}
                            style={{ width: 22, height: 22, borderRadius: 2, background: hex, border: '1px solid rgba(0,0,0,.08)', cursor: 'pointer' }} />
                        ))}
                      </div>
                      {(['primary', 'secondary', 'background', 'surface', 'accent', 'border'] as const).map(k => (
                        <div key={k} style={styles.tkv}>
                          <span style={styles.tk}>{k}</span>
                          <span style={{ ...styles.tv, cursor: 'pointer' }} onClick={() => copy(result.colors?.[k] || '')}>{result.colors?.[k] || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={styles.tcell}>
                      <div style={styles.tclbl}>Typography</div>
                      <div style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 10 }}>{result.typography?.primaryFont?.split(',')[0].replace(/['"]/g, '') || 'Sans'}</div>
                      {(['headingSize', 'bodySize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const).map(k => (
                        <div key={k} style={styles.tkv}>
                          <span style={styles.tk}>{k}</span>
                          <span style={styles.tv}>{result.typography?.[k] || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={styles.tcell}>
                      <div style={styles.tclbl}>Spacing & layout</div>
                      {(['baseUnit', 'containerMaxWidth', 'sectionPadding', 'componentGap'] as const).map(k => (
                        <div key={k} style={styles.tkv}>
                          <span style={styles.tk}>{k}</span>
                          <span style={styles.tv}>{result.spacing?.[k] || '—'}</span>
                        </div>
                      ))}
                      {result.styleNotes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6, fontStyle: 'italic' }}>"{result.styleNotes}"</div>}
                      <div style={{ marginTop: 14 }}>
                        <div style={styles.tclbl}>Components</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 8 }}>
                          {(result.components || []).map(c => (
                            <span key={c} style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 7px', border: '1px solid var(--r)', borderRadius: 2, color: 'var(--ink3)', background: '#fff' }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={styles.tcell}>
                      <div style={styles.tclbl}>Visual effects</div>
                      {([
                        ['borderRadius', result.effects?.borderRadius],
                        ['boxShadow', result.effects?.boxShadow],
                        ['backdropBlur', result.effects?.backdropBlur ? 'Yes' : '—'],
                        ['gradients', result.effects?.gradients ? 'Yes' : '—'],
                        ['glassmorphism', result.effects?.hasGlassmorphism ? 'Yes' : '—'],
                        ['darkMode', result.effects?.hasDarkMode ? 'Yes' : '—'],
                        ['animations', result.effects?.animations],
                      ] as [string, unknown][]).map(([k, v]) => (
                        <div key={k} style={styles.tkv}>
                          <span style={styles.tk}>{k}</span>
                          <span style={styles.tv}>{String(v ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB: FONTS */}
                {activeTab === 'fonts' && (
                  (result.fonts || []).length === 0
                    ? <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink4)', padding: 24 }}>No Google Fonts detected for this site.</p>
                    : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                        {(result.fonts || []).map(f => (
                          <div key={f.family} style={{ background: '#fff', padding: 16 }}>
                            <div style={styles.tclbl}>{f.role} · {f.category}</div>
                            <div style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8 }}>{f.family}</div>
                            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>The quick brown fox jumps over the lazy dog</div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                              {(f.weights || []).map(w => (
                                <span key={w} style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', border: '1px solid var(--r)', borderRadius: 2, background: 'var(--cr)', color: 'var(--ink3)' }}>{w}</span>
                              ))}
                            </div>
                            {f.notes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 10, fontStyle: 'italic' }}>"{f.notes}"</div>}
                            <div
                              onClick={() => copy(`<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="${f.importUrl}" rel="stylesheet">`, 'Font tag copied')}
                              style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#1e3a5c', background: '#e6edf8', border: '1px solid rgba(30,58,92,.15)', padding: '8px 10px', borderRadius: 2, cursor: 'pointer', lineHeight: 1.5, wordBreak: 'break-all' as const }}>
                              {`<link href="${f.importUrl.slice(0, 55)}..." /> — click to copy`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                )}

                {/* TAB: INFRA */}
                {activeTab === 'infra' && (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                    {([
                      ['host', '🏠', 'Hosting & CDN', 'Provider, type, edge'],
                      ['auth', '🔐', 'Authentication', 'Provider, methods, session'],
                      ['db', '🗄️', 'Database & data', 'DB, ORM, cache, search'],
                      ['api', '🔗', 'APIs & integrations', 'Pattern, third-party'],
                      ['mon', '📊', 'Monitoring & CI/CD', 'Observability, pipeline'],
                    ] as [string, string, string, string][]).map(([id, icon, title, sub]) => {
                      const inf = result.infrastructure || {}
                      const sectionData: Record<string, unknown> =
                        id === 'host' ? { provider: inf.hosting?.provider, region: inf.hosting?.region, type: inf.hosting?.type, cdn: inf.cdn?.provider, cdnFeatures: (inf.cdn?.features || []).join(', ') }
                        : id === 'auth' ? { provider: inf.authentication?.provider, methods: (inf.authentication?.methods || []).join(', '), SSO: inf.authentication?.hasSSO ? 'Yes' : 'No', MFA: inf.authentication?.hasMFA ? 'Yes' : 'No', session: inf.authentication?.sessionStrategy }
                        : id === 'db' ? { primary: inf.database?.primary, orm: inf.database?.orm, cache: inf.database?.caching, search: inf.database?.searchEngine, realtime: inf.database?.hasRealtime ? 'Yes' : 'No' }
                        : id === 'api' ? { pattern: inf.apis?.pattern, prefix: inf.apis?.internalApiPrefix, webhooks: inf.apis?.hasWebhooks ? 'Yes' : 'No', thirdParty: (inf.apis?.thirdParty || []).map(t => t.name).join(', ') || 'None' }
                        : { errorTracking: inf.monitoring?.errorTracking, analytics: inf.monitoring?.analytics, logging: inf.monitoring?.logging, ciPlatform: inf.cicd?.platform, deployment: inf.cicd?.deploymentStrategy, email: inf.email?.provider, featureFlags: inf.featureFlags }

                      return (
                        <div key={id} style={{ background: 'var(--cr)' }}>
                          <div onClick={() => toggleSection(id)} style={styles.infraHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={styles.infraIcon}>{icon}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{sub}</div>
                              </div>
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)' }}>
                              {openSections[id] ? '− collapse' : '+ expand'}
                            </span>
                          </div>
                          {openSections[id] && (
                            <div style={{ padding: '12px 18px' }}>
                              {Object.entries(sectionData).map(([k, v]) => (
                                <div key={k} style={styles.tkv}>
                                  <span style={styles.tk}>{k}</span>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink)', maxWidth: '55%', textAlign: 'right' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                    {String(v ?? '—') || '—'}
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
                  const hdrs = sec.headers || {}

                  return (
                    <div>
                      {/* Score summary */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--r)', border: '1px solid var(--r)', marginBottom: 14 }}>
                        {[
                          [score, 'Security score', score >= 80 ? '#2d5016' : score >= 50 ? '#5c3a10' : '#5c1e18'],
                          [crit + high, 'Critical / High', '#5c1e18'],
                          [med, 'Medium', '#5c3a10'],
                          [low, 'Low / Info', 'var(--ink3)'],
                        ].map(([n, label, color], i) => (
                          <div key={i} style={{ background: 'var(--cr)', padding: 14, textAlign: 'center' as const }}>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1, marginBottom: 4, color: color as string }}>{String(n)}</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label as string}</div>
                          </div>
                        ))}
                      </div>

                      {/* Headers + SSL */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--r)', border: '1px solid var(--r)', marginBottom: 14 }}>
                        <div style={{ background: 'var(--cr)', padding: 16 }}>
                          <div style={styles.tclbl}>SSL / TLS</div>
                          {[
                            ['Grade', sec.ssl?.grade],
                            ['TLS version', sec.ssl?.tlsVersion],
                            ['HSTS', sec.ssl?.hsts ? 'Enabled' : 'Missing'],
                            ['HSTS max-age', sec.ssl?.hstsMaxAge],
                            ['Bot protection', sec.botProtection],
                            ['DDoS protection', sec.ddosProtection],
                            ['Rate limiting', sec.rateLimit],
                          ].map(([k, v]) => (
                            <div key={k} style={styles.tkv}>
                              <span style={styles.tk}>{k}</span>
                              <span style={styles.tv}>{String(v ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: 'var(--cr)', padding: 16 }}>
                          <div style={styles.tclbl}>HTTP security headers</div>
                          {Object.entries(hdrs).map(([k, v]) => {
                            const labels: Record<string, string> = {
                              contentSecurityPolicy: 'Content-Security-Policy',
                              strictTransportSecurity: 'Strict-Transport-Security',
                              xFrameOptions: 'X-Frame-Options',
                              xContentTypeOptions: 'X-Content-Type-Options',
                              referrerPolicy: 'Referrer-Policy',
                              permissionsPolicy: 'Permissions-Policy',
                              crossOriginOpenerPolicy: 'Cross-Origin-Opener-Policy',
                              crossOriginResourcePolicy: 'Cross-Origin-Resource-Policy',
                            }
                            return (
                              <div key={k} style={styles.tkv}>
                                <span style={styles.tk}>{labels[k] || k}</span>
                                <span style={
                                  v === 'present' ? styles.byes
                                  : v === 'partial' ? styles.bwarn
                                  : styles.bno
                                }>{v}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Vulns list */}
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 }}>
                        {vulns.length} vulnerabilities detected
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                        {vulns.map(v => {
                          const sevStyle: Record<string, React.CSSProperties> = {
                            critical: { background: '#f5e8e6', color: '#5c1e18', border: '1px solid rgba(92,30,24,.2)' },
                            high: { background: '#f5ede0', color: '#5c3a10', border: '1px solid rgba(92,58,16,.2)' },
                            medium: { background: '#f5f0e0', color: '#4a3a10', border: '1px solid rgba(74,58,16,.2)' },
                            low: { background: '#e6edf8', color: '#1e3a5c', border: '1px solid rgba(30,58,92,.15)' },
                            info: { background: 'var(--cr2)', color: 'var(--ink3)', border: '1px solid var(--r)' },
                          }
                          return (
                            <div key={v.id} style={{ background: '#fff', padding: '12px 15px', borderBottom: '1px solid var(--r)' }}>
                              <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 7px', borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: .5, fontWeight: 500, flexShrink: 0, ...sevStyle[v.severity] }}>
                                  {v.severity}
                                </span>
                                <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{v.id} — {v.title}</span>
                                <button onClick={() => toggleVuln(v.id)}
                                  style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                  {openVulns[v.id] ? '− close' : '+ details'}
                                </button>
                              </div>
                              {openVulns[v.id] && (
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(26,25,22,0.05)' }}>
                                  <p style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</p>
                                  {v.evidence && (
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', padding: '8px 10px', background: 'var(--cr2)', borderRadius: 2, marginBottom: 8 }}>
                                      <strong style={{ color: 'var(--ink2)' }}>Evidence:</strong> {v.evidence}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' as const }}>
                                    {v.cvss && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 6px', background: '#f5ede0', color: '#5c3a10', borderRadius: 2 }}>CVSS {v.cvss}</span>}
                                    {v.cwe && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 6px', background: '#e6edf8', color: '#1e3a5c', borderRadius: 2 }}>{v.cwe}</span>}
                                  </div>
                                  <div style={{ background: '#e8f0e0', border: '1px solid rgba(45,80,22,.15)', borderRadius: 2, padding: '10px 12px' }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#2d5016', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 5, fontWeight: 500 }}>✓ Fix</div>
                                    <div style={{ fontSize: 11.5, color: '#2d5016', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, fontFamily: 'var(--mono)' }}>{v.solution}</div>
                                  </div>
                                  {v.references?.length > 0 && (
                                    <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' as const }}>
                                      {v.references.map(ref => (
                                        <span key={ref} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', background: 'var(--cr2)', border: '1px solid var(--r)', padding: '1px 7px', borderRadius: 2 }}>{ref}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Recommendations */}
                      {(sec.recommendations || []).length > 0 && (
                        <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--r)', borderRadius: 2, padding: 14 }}>
                          <div style={{ ...styles.tclbl, marginBottom: 10 }}>Priority recommendations</div>
                          {(sec.recommendations || []).map((rec, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(26,25,22,0.05)', fontSize: 12 }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink4)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                              <span style={{ color: 'var(--ink2)' }}>{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* TAB: TECH */}
                {activeTab === 'tech' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr>
                        {['Technology', 'Category', 'Confidence'].map(h => (
                          <th key={h} style={{ textAlign: 'left' as const, fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 1.5, color: 'var(--ink4)', padding: '0 0 8px', borderBottom: '1px solid var(--r)', fontWeight: 400 }}>{h}</th>
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
                <div style={styles.dlstrip}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>Ready to export</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                      {result.url.replace('https://', '')} · Design tokens · Security report · Next.js project
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
                    <button
                      onClick={() => {
                        const sec = result.security
                        const vulns = sec?.vulnerabilities || []
                        const md = `# Security Report — ${result.url}\nGenerated: ${result.analyzedAt}\n\nScore: ${sec?.overallScore}/100 (${sec?.scoreLabel})\n\n${vulns.map(v => `## [${v.severity.toUpperCase()}] ${v.title}\n${v.description}\n\n**Fix:** ${v.solution}`).join('\n\n---\n\n')}`
                        const blob = new Blob([md], { type: 'text/markdown' })
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                        a.download = 'security-report.md'; a.click()
                        showToast('Security report downloaded')
                      }}
                      style={{ ...styles.dlbtn, background: 'none', border: '1px solid var(--r)', color: 'var(--ink3)' }}>
                      Security report
                    </button>
                    <button
                      onClick={downloadZip}
                      disabled={zipLoading}
                      style={{ ...styles.dlbtn, background: zipLoading ? 'var(--ink3)' : 'var(--ink)', color: '#fff', border: 'none' }}>
                      {zipLoading
                        ? <><span style={styles.spinner} /> Building...</>
                        : '⬇ Download .zip'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && !result && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 1, background: 'var(--r)', border: '1px solid var(--r)' }}>
                {[
                  ['01', 'Browserless scraping', 'Playwright real DOM — CSS computado, fuentes, screenshots y headers reales.'],
                  ['02', 'Google Fonts', 'Detección real de fuentes con import URL, variantes y pesos disponibles.'],
                  ['03', 'Security headers', 'Análisis real de HTTP headers, TLS, HSTS y vulnerabilidades OWASP desde la respuesta.'],
                  ['04', 'Real .zip', 'Next.js project con design tokens, security report y estructura lista para npm install.'],
                ].map(([num, title, desc]) => (
                  <div key={num} style={{ background: 'var(--cr)', padding: '18px 16px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink4)', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{num}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.5, fontWeight: 300 }}>{desc}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--ink)', color: 'var(--cr)', fontFamily: 'var(--mono)', fontSize: 11, padding: '10px 18px', borderRadius: 3, zIndex: 999, animation: 'tfade 2.8s forwards' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pk { 0%,100%{opacity:1}50%{opacity:.3} }
        @keyframes tfade { 0%{opacity:0;transform:translateY(6px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0} }
      `}</style>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  nav: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', height:46, borderBottom:'1px solid var(--r)', background:'var(--cr)', position:'sticky' as const, top:0, zIndex:50 },
  brandMark: { width:20, height:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:2 },
  main: { maxWidth:880, margin:'0 auto', padding:'0 28px 60px' },
  hero: { padding:'48px 0 28px' },
  kicker: { fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)', textTransform:'uppercase' as const, letterSpacing:2, display:'flex', alignItems:'center', gap:7, marginBottom:16 },
  kpulse: { width:5, height:5, borderRadius:'50%', background:'var(--ink3)', display:'inline-block', animation:'pk 2.5s ease-in-out infinite' },
  h1: { fontFamily:'var(--serif)', fontSize:'clamp(32px,5vw,52px)', lineHeight:1.04, letterSpacing:-1.5, fontWeight:400, marginBottom:16 },
  herop: { fontSize:13.5, color:'var(--ink2)', maxWidth:460, lineHeight:1.65, fontWeight:300, marginBottom:26 },
  ibox: { display:'flex', border:'1px solid rgba(26,25,22,0.28)', background:'#fff', borderRadius:3, overflow:'hidden', marginBottom:11 },
  ipfx: { fontFamily:'var(--mono)', fontSize:11, color:'var(--ink3)', padding:'0 12px', background:'var(--cr2)', borderRight:'1px solid var(--r)', display:'flex', alignItems:'center', whiteSpace:'nowrap' as const, height:44 },
  iinput: { flex:1, border:'none', outline:'none', fontFamily:'var(--mono)', fontSize:12, color:'var(--ink)', padding:'0 14px', background:'#fff', height:44 },
  abtn: { height:44, padding:'0 22px', color:'var(--cr)', border:'none', fontFamily:'var(--sans)', fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' as const, display:'flex', alignItems:'center', gap:7, flexShrink:0 },
  exlbl: { fontFamily:'var(--mono)', fontSize:9, color:'var(--ink4)', textTransform:'uppercase' as const, letterSpacing:1.5 },
  ec: { fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)', padding:'3px 9px', border:'1px solid var(--r)', borderRadius:2, cursor:'pointer', background:'none' },
  toggle: { width:30, height:16, border:'1px solid var(--r)', borderRadius:8, cursor:'pointer', position:'relative' as const, transition:'background .2s', flexShrink:0 },
  toggleThumb: { position:'absolute' as const, top:2, width:10, height:10, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 2px rgba(0,0,0,.2)' },
  hr: { border:'none', borderTop:'1px solid var(--r)', margin:'0 0 26px' },
  errorbar: { background:'#f5e8e6', border:'1px solid rgba(92,30,24,.2)', color:'#5c1e18', fontFamily:'var(--mono)', fontSize:11, padding:'10px 14px', borderRadius:2, marginBottom:16 },
  progkicker: { fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' as const, letterSpacing:2, marginBottom:12 },
  progh1: { fontFamily:'var(--serif)', fontSize:'clamp(18px,3vw,26px)', lineHeight:1.1, marginBottom:16 },
  progtrack: { height:1, background:'var(--r)', marginBottom:16, position:'relative' as const, overflow:'hidden' },
  progfill: { position:'absolute' as const, top:0, left:0, height:1, background:'var(--ink)', transition:'width .6s ease' },
  slist: { display:'grid', gridTemplateColumns:'1fr 1fr', border:'1px solid var(--r)' },
  srow: { display:'flex', alignItems:'center', gap:9, padding:'8px 12px', fontSize:11.5, transition:'all .3s' },
  spinner: { width:11, height:11, border:'1.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .6s linear infinite' } as React.CSSProperties,
  spinnerDark: { width:10, height:10, border:'1.5px solid rgba(26,25,22,.15)', borderTopColor:'var(--ink)', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' } as React.CSSProperties,
  fwbadge: { display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'#fff', border:'1px solid var(--r)', borderRadius:3, fontSize:12, marginBottom:16, flexWrap:'wrap' as const },
  fontpill: { fontFamily:'var(--mono)', fontSize:9, background:'#e6edf8', color:'#1e3a5c', border:'1px solid rgba(30,58,92,.15)', padding:'2px 8px', borderRadius:2 },
  tabs: { display:'flex', borderBottom:'1px solid var(--r)', marginBottom:18, overflowX:'auto' as const },
  tbtn: { fontFamily:'var(--sans)', fontSize:12, padding:'7px 14px 9px', border:'none', background:'none', marginBottom:-1, cursor:'pointer', whiteSpace:'nowrap' as const, transition:'all .15s' },
  tgrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--r)', border:'1px solid var(--r)' },
  tcell: { background:'var(--cr)', padding:18 },
  tclbl: { fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' as const, letterSpacing:1.5, marginBottom:12 },
  tkv: { display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(26,25,22,0.05)', fontSize:11 },
  tk: { fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink3)' },
  tv: { fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink)' },
  byes: { background:'#e8f0e0', color:'#2d5016', fontFamily:'var(--mono)', fontSize:9, padding:'1px 6px', borderRadius:2 },
  bno: { background:'var(--cr2)', color:'var(--ink4)', fontFamily:'var(--mono)', fontSize:9, padding:'1px 6px', borderRadius:2 },
  bwarn: { background:'#f5ede0', color:'#5c3a10', fontFamily:'var(--mono)', fontSize:9, padding:'1px 6px', borderRadius:2 },
  bval: { fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink2)' },
  infraHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', borderBottom:'1px solid var(--r)', cursor:'pointer' },
  infraIcon: { width:26, height:26, border:'1px solid var(--r)', borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center', background:'#fff', fontSize:13, flexShrink:0 },
  dlstrip: { border:'1px solid var(--r)', padding:'16px 18px', marginTop:22, background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:14 },
  dlbtn: { fontFamily:'var(--sans)', fontSize:12, padding:'7px 15px', borderRadius:2, cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .12s' },
  nbtn: { fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)', background:'none', border:'1px solid var(--r)', padding:'3px 10px', borderRadius:3, cursor:'pointer' },
  table: { width:'100%', borderCollapse:'collapse' as const, border:'1px solid var(--r)' },
  th: { textAlign:'left' as const, fontFamily:'var(--mono)', fontSize:9, textTransform:'uppercase' as const, letterSpacing:1.5, color:'var(--ink4)', padding:'7px 13px', borderBottom:'1px solid var(--r)', fontWeight:400, background:'var(--cr2)' },
  td: { padding:'9px 13px', fontSize:11.5, fontFamily:'var(--mono)', color:'var(--ink)' },
} satisfies Record<string, React.CSSProperties>
