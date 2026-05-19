// src/types/index.ts
// Core types for DesignClone AI

export interface ColorPalette {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  textMuted: string
  accent: string
  border: string
  palette: string[]
}

export interface Typography {
  primaryFont: string
  secondaryFont: string | null
  monoFont: string | null
  headingSize: string
  bodySize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
}

export interface Spacing {
  baseUnit: string
  containerMaxWidth: string
  sectionPadding: string
  componentGap: string
}

export interface Effects {
  borderRadius: string
  boxShadow: 'none' | 'subtle' | 'medium' | 'strong'
  backdropBlur: boolean
  gradients: boolean
  animations: 'none' | 'subtle' | 'moderate' | 'heavy'
  hasGlassmorphism: boolean
  hasDarkMode: boolean
  hasNoise: boolean
}

export interface DetectedFont {
  family: string
  role: 'primary' | 'secondary' | 'mono' | 'display'
  weights: string[]
  isGoogleFont: boolean
  importUrl: string
  cssVariable: string
  tailwindKey: string
  category: 'sans-serif' | 'serif' | 'monospace' | 'display'
  notes: string
}

// ── Infrastructure ────────────────────────────────────────────────────────────

export interface Hosting {
  provider: string
  confidence: number
  region: string
  type: string
  notes: string
}

export interface CDN {
  provider: string
  confidence: number
  features: string[]
}

export interface Authentication {
  provider: string
  confidence: number
  methods: string[]
  hasSSO: boolean
  hasMFA: boolean
  sessionStrategy: string
  notes: string
}

export interface Database {
  primary: string
  primaryConfidence: number
  orm: string
  caching: string
  searchEngine: string
  hasRealtime: boolean
  notes: string
}

export interface ThirdPartyAPI {
  name: string
  category: string
  confidence: number
}

export interface APIs {
  pattern: string
  thirdParty: ThirdPartyAPI[]
  internalApiPrefix: string
  hasWebhooks: boolean
}

export interface Monitoring {
  errorTracking: string
  analytics: string
  logging: string
  uptime: string
  performance: string
}

export interface CICD {
  platform: string
  repository: string
  deploymentStrategy: string
  hasAutomatedTests: boolean
}

export interface Infrastructure {
  hosting: Hosting
  cdn: CDN
  authentication: Authentication
  database: Database
  apis: APIs
  monitoring: Monitoring
  cicd: CICD
  email: { provider: string; confidence: number }
  featureFlags: string
  internationalisation: boolean
  mobileStrategy: string
  accessibilityScore: number
}

// ── Security ──────────────────────────────────────────────────────────────────

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Vulnerability {
  id: string
  title: string
  severity: VulnerabilitySeverity
  category: string
  description: string
  evidence: string
  cvss: string
  cwe: string
  affected: string
  solution: string
  references: string[]
}

export interface SecurityHeaders {
  contentSecurityPolicy: 'present' | 'partial' | 'missing'
  strictTransportSecurity: 'present' | 'missing'
  xFrameOptions: 'present' | 'missing'
  xContentTypeOptions: 'present' | 'missing'
  referrerPolicy: 'present' | 'missing'
  permissionsPolicy: 'present' | 'missing'
  crossOriginOpenerPolicy: 'present' | 'missing'
  crossOriginResourcePolicy: 'present' | 'missing'
}

export interface SSL {
  grade: 'A+' | 'A' | 'B' | 'C' | 'F' | 'Unknown'
  provider: string
  hsts: boolean
  hstsMaxAge: string
  tlsVersion: string
}

export interface Security {
  overallScore: number
  scoreLabel: string
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  headers: SecurityHeaders
  ssl: SSL
  rateLimit: 'detected' | 'likely' | 'not detected'
  botProtection: string
  ddosProtection: string
  vulnerabilities: Vulnerability[]
  recommendations: string[]
}

// ── Tech stack ────────────────────────────────────────────────────────────────

export interface Technology {
  name: string
  confidence: number
  category: string
}

// ── Scraping data (from Browserless) ─────────────────────────────────────────

export interface ScrapedData {
  url: string
  title: string
  html: string
  computedStyles: Record<string, string>
  fonts: string[]
  colors: string[]
  headers: Record<string, string>
  screenshotBase64?: string
  screenshotMobileBase64?: string
  metaTags: Record<string, string>
  scripts: string[]
  stylesheets: string[]
  responseHeaders: Record<string, string>
  statusCode: number
  loadTime: number
  error?: string
}

// ── Main analysis result ──────────────────────────────────────────────────────

export interface AnalysisResult {
  id: string
  url: string
  analyzedAt: string
  duration: number
  framework: string
  frameworkConfidence: number
  style: string
  styleNotes: string
  colors: ColorPalette
  typography: Typography
  spacing: Spacing
  effects: Effects
  components: string[]
  fonts: DetectedFont[]
  infrastructure: Infrastructure
  security: Security
  technologies: Technology[]
  nextjsCode: string
  htmlCode: string
  vibePrompt: string
  screenshotUrl?: string
  screenshotMobileUrl?: string
  scrapedAt?: string
}

// ── API request/response ──────────────────────────────────────────────────────

export interface AnalyzeRequest {
  url: string
  creativeMode?: boolean
}

export interface AnalyzeResponse {
  success: boolean
  data?: AnalysisResult
  error?: string
  cached?: boolean
}

export interface AnalyzeStreamEvent {
  type: 'step' | 'result' | 'error'
  step?: number
  total?: number
  label?: string
  data?: AnalysisResult
  cached?: boolean
  error?: string
}

// ── History ───────────────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string
  url: string
  analyzedAt: string
  framework: string
  style: string
  securityScore: number
  vulnCount: number
  fontCount: number
  primaryColor: string
}
