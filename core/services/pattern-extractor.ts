import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getTemplateContent } from '../agentic/template-loader'
import { prjctDb } from '../storage/database'
import type {
  ExtractedAntiPattern,
  ExtractedPattern,
  ExtractPatternInput,
  ExtractPatternResult,
} from '../types/services.js'

type RuleSource = 'baseline' | 'repo' | 'context7' | 'feedback'
type Severity = 'low' | 'medium' | 'high'

interface BaselinePattern {
  name: string
  description: string
  location?: string
  severity?: Severity
  language?: string
  framework?: string
  confidence?: number
}

interface BaselineAntiPattern {
  issue: string
  file?: string
  suggestion: string
  severity?: Severity
  language?: string
  framework?: string
  confidence?: number
}

interface BaselineFile<T> {
  items: T[]
}

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
])

const MAX_FILES = 400

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function repoHash(projectPath: string): string {
  const normalized = path.resolve(projectPath)
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function parseBaselineFile<T>(relativePath: string): T[] {
  const raw = getTemplateContent(relativePath)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as BaselineFile<T>
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

async function listSourceFiles(projectPath: string): Promise<string[]> {
  const out: string[] = []
  const stack: string[] = [projectPath]

  while (stack.length > 0 && out.length < MAX_FILES) {
    const dir = stack.pop()
    if (!dir) break
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (out.length >= MAX_FILES) break
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) stack.push(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)$/.test(entry.name)) {
        out.push(fullPath)
      }
    }
  }

  return out
}

async function detectRepoRules(
  projectPath: string,
  files: string[]
): Promise<{ patterns: ExtractedPattern[]; antiPatterns: ExtractedAntiPattern[] }> {
  const patterns: ExtractedPattern[] = []
  const antiPatterns: ExtractedAntiPattern[] = []

  let hasNextImage = false
  let hasHeroUi = false
  let hasUiButton = false
  let anyViolations = 0
  let tsIgnoreViolations = 0
  let rawImgViolations = 0

  for (const file of files) {
    const rel = path.relative(projectPath, file)
    const content = await fs.readFile(file, 'utf-8')

    if (/from\s+['"]next\/image['"]/.test(content)) hasNextImage = true
    if (/from\s+['"]@?heroui\//.test(content) || /from\s+['"]@nextui-org\//.test(content)) {
      hasHeroUi = true
    }
    if (/<UiButton\b|from\s+['"][^'"]*UiButton[^'"]*['"]/.test(content)) hasUiButton = true

    const anyMatches = content.match(/:\s*any\b|<\s*any\s*>/g)
    if (anyMatches) {
      anyViolations += anyMatches.length
      antiPatterns.push({
        issue: 'Unbounded any usage',
        file: rel,
        suggestion: 'Replace with specific types or justified unknown + narrowing.',
        severity: 'high',
        language: 'TypeScript',
        source: 'repo',
        confidence: 0.92,
      })
    }

    const ignoreMatches = content.match(/@ts-ignore/g)
    if (ignoreMatches) {
      tsIgnoreViolations += ignoreMatches.length
      antiPatterns.push({
        issue: 'Unchecked @ts-ignore usage',
        file: rel,
        suggestion: 'Use @ts-expect-error with reason or refactor typings.',
        severity: 'medium',
        language: 'TypeScript',
        source: 'repo',
        confidence: 0.88,
      })
    }

    if (/\.(tsx|jsx)$/.test(file) && /<img\s+/.test(content) && !/next\/image/.test(content)) {
      rawImgViolations += 1
      antiPatterns.push({
        issue: 'Raw <img> in React/Next component',
        file: rel,
        suggestion: 'Prefer framework image component or documented exception.',
        severity: 'medium',
        framework: 'Next.js',
        source: 'repo',
        confidence: 0.8,
      })
    }
  }

  if (hasNextImage) {
    patterns.push({
      name: 'Image rendering via next/image',
      description: 'Project uses next/image for optimized image delivery.',
      location: 'app/** or src/**',
      framework: 'Next.js',
      source: 'repo',
      confidence: 0.9,
    })
  }

  if (hasHeroUi) {
    patterns.push({
      name: 'HeroUI as component system',
      description: 'UI components are sourced from HeroUI/NextUI packages.',
      location: 'components/**',
      source: 'repo',
      confidence: 0.87,
    })
  }

  if (hasUiButton) {
    patterns.push({
      name: 'Use UiButton abstraction',
      description: 'Buttons are wrapped in UiButton instead of native button in app UI.',
      location: 'components/**',
      source: 'repo',
      confidence: 0.84,
    })
  }

  if (anyViolations > 0 || tsIgnoreViolations > 0 || rawImgViolations > 0) {
    patterns.push({
      name: 'Strict type/lint hygiene',
      description: `Detected ${anyViolations} any, ${tsIgnoreViolations} ts-ignore, ${rawImgViolations} raw img potential violations.`,
      source: 'repo',
      confidence: 0.76,
    })
  }

  return { patterns, antiPatterns }
}

function dedupePatterns(input: ExtractedPattern[]): ExtractedPattern[] {
  const seen = new Set<string>()
  const out: ExtractedPattern[] = []
  for (const item of input) {
    const key = `${normalizeKey(item.name)}::${normalizeKey(item.source)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function dedupeAntiPatterns(input: ExtractedAntiPattern[]): ExtractedAntiPattern[] {
  const seen = new Set<string>()
  const out: ExtractedAntiPattern[] = []
  for (const item of input) {
    const key = `${normalizeKey(item.issue)}::${normalizeKey(item.file)}::${normalizeKey(item.source)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

class PatternExtractor {
  async extract(input: ExtractPatternInput): Promise<ExtractPatternResult> {
    const hash = repoHash(input.projectPath)
    const files = await listSourceFiles(input.projectPath)

    const baselinePatterns: ExtractedPattern[] = []
    const baselineAntiPatterns: ExtractedAntiPattern[] = []

    for (const language of input.languages) {
      const key = normalizeKey(language)
      const p = parseBaselineFile<BaselinePattern>(`baseline/patterns/${key}.json`)
      const a = parseBaselineFile<BaselineAntiPattern>(`baseline/anti-patterns/${key}.json`)
      baselinePatterns.push(
        ...p.map((item) => ({
          ...item,
          language,
          source: 'baseline' as const,
          confidence: item.confidence ?? 0.8,
        }))
      )
      baselineAntiPatterns.push(
        ...a.map((item) => ({
          ...item,
          file: item.file || 'multiple',
          language,
          source: 'baseline' as const,
          confidence: item.confidence ?? 0.8,
        }))
      )
    }

    for (const framework of input.frameworks) {
      const key = normalizeKey(framework)
      const p = parseBaselineFile<BaselinePattern>(`baseline/patterns/${key}.json`)
      const a = parseBaselineFile<BaselineAntiPattern>(`baseline/anti-patterns/${key}.json`)
      baselinePatterns.push(
        ...p.map((item) => ({
          ...item,
          framework,
          source: 'baseline' as const,
          confidence: item.confidence ?? 0.82,
        }))
      )
      baselineAntiPatterns.push(
        ...a.map((item) => ({
          ...item,
          file: item.file || 'multiple',
          framework,
          source: 'baseline' as const,
          confidence: item.confidence ?? 0.82,
        }))
      )

      if (input.context7Verified) {
        baselinePatterns.push({
          name: `${framework} API validation via Context7`,
          description: `Validate ${framework} APIs against current documentation through Context7 before implementation.`,
          framework,
          source: 'context7',
          confidence: 0.7,
        })
      }
    }

    const repoDetected = await detectRepoRules(input.projectPath, files)

    const feedbackPatterns: ExtractedPattern[] = (input.feedback?.patternsDiscovered || []).map(
      (p) => ({
        name: p,
        description: `Confirmed during completed tasks: ${p}`,
        source: 'feedback',
        confidence: 0.75,
      })
    )
    const feedbackAntiPatterns: ExtractedAntiPattern[] = (input.feedback?.knownGotchas || []).map(
      (g) => ({
        issue: g,
        file: 'multiple',
        suggestion: `Recurring gotcha. Prevent this pattern during implementation: ${g}`,
        source: 'feedback',
        severity: 'medium',
        confidence: 0.7,
      })
    )

    const patterns = dedupePatterns([
      ...baselinePatterns,
      ...repoDetected.patterns,
      ...feedbackPatterns,
    ])
    const antiPatterns = dedupeAntiPatterns([
      ...baselineAntiPatterns,
      ...repoDetected.antiPatterns,
      ...feedbackAntiPatterns,
    ])

    const key = `analysis:derived-rules:${hash}`
    prjctDb.setDoc(input.projectId, key, {
      projectId: input.projectId,
      repoPathHash: hash,
      patterns,
      antiPatterns,
      updatedAt: new Date().toISOString(),
      version: 1,
    })

    return { patterns, antiPatterns, repoPathHash: hash }
  }
}

export const patternExtractor = new PatternExtractor()
export default patternExtractor
