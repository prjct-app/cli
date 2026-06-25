import type {
  CurrentTask,
  HarnessEvidence,
  HarnessGate,
  HarnessKind,
  HarnessLevel,
  HarnessRisk,
  TaskHarness,
} from '../schemas/state'
import { getTimestamp } from '../utils/date-helper'
import { execFileAsync } from '../utils/exec'

const PUBLIC_SURFACE_TERMS = [
  'cli',
  'command',
  'install',
  'setup',
  'doctor',
  'mcp',
  'codex',
  'claude',
  'statusline',
  'statusbar',
  'output',
  'help',
]

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'task',
  'implement',
  'implementa',
  'fix',
  'bug',
  'add',
  'agrega',
  'crear',
  'hacer',
  'esto',
  'debe',
])

export interface HarnessCompletionEvaluation {
  changedFiles: string[]
  observedEvidence: string[]
  warnings: string[]
}

export function buildTaskHarness(description: string): TaskHarness {
  const text = description.toLowerCase()
  const kind = detectKind(text)
  const publicSurface = PUBLIC_SURFACE_TERMS.some((term) => text.includes(term))
  const highRisk = hasAny(text, [
    'security',
    'seguridad',
    'auth',
    'permission',
    'secret',
    'migration',
    'sqlite',
    'database',
    'arquitectura',
    'architecture',
    'must',
    'critical',
    'critico',
    'crítico',
  ])

  const level = detectLevel(kind, text, highRisk)
  const risk = detectRisk(level, highRisk)
  const expectedEvidence = expectedEvidenceFor(kind, level, publicSurface)
  const gates = gatesFor(level)
  const scopeHints = extractScopeHints(description)

  return {
    level,
    kind,
    risk,
    expectedEvidence,
    scopeHints,
    gates,
    rationale: rationaleFor(level, kind, risk),
    createdAt: getTimestamp(),
  }
}

export async function evaluateHarnessCompletion(
  projectPath: string,
  task: CurrentTask
): Promise<HarnessCompletionEvaluation> {
  const harness = task.harness
  if (!harness || harness.level === 'H0') {
    return { changedFiles: [], observedEvidence: [], warnings: [] }
  }

  const changedFiles = await readChangedFiles(projectPath)
  const observedEvidence = observedEvidenceFromFiles(changedFiles)
  const warnings: string[] = []

  if (
    harness.expectedEvidence.includes('regression-test') &&
    !observedEvidence.includes('tests-changed')
  ) {
    warnings.push(`${harness.level} expects a regression test; no test file changed in the diff.`)
  }

  if (
    harness.expectedEvidence.includes('docs-if-public-behavior') &&
    touchesPublicSurface(changedFiles) &&
    !observedEvidence.includes('docs-changed')
  ) {
    warnings.push('Public-facing files changed; no README/docs/changelog file changed.')
  }

  const diffSize = await readDiffSize(projectPath)
  if (diffSize > 400) {
    warnings.push(`Diff is ${diffSize} changed lines; consider splitting or justify the scope.`)
  }

  return { changedFiles, observedEvidence, warnings }
}

function detectKind(text: string): HarnessKind {
  if (hasAny(text, ['security', 'seguridad', 'auth', 'permission', 'secret'])) return 'security'
  if (hasAny(text, ['bug', 'fix', 'falla', 'fallo', 'error', 'broken', 'regression', 'no se'])) {
    return 'bug'
  }
  if (hasAny(text, ['refactor', 'cleanup', 'split', 'restructure'])) return 'refactor'
  if (hasAny(text, ['doc', 'readme', 'changelog', 'typo'])) return 'docs'
  if (hasAny(text, ['chore', 'format', 'lint'])) return 'chore'
  if (hasAny(text, ['add', 'agrega', 'crear', 'implement', 'implementa', 'feature', 'mejora'])) {
    return 'feature'
  }
  return 'unknown'
}

function detectLevel(kind: HarnessKind, text: string, highRisk: boolean): HarnessLevel {
  if (kind === 'docs' || kind === 'chore') return 'H0'
  if (kind === 'security') return 'H3'
  if (
    highRisk &&
    hasAny(text, ['migration', 'sqlite', 'database', 'architecture', 'arquitectura'])
  ) {
    return 'H3'
  }
  if (kind === 'feature' || kind === 'refactor') return 'H2'
  if (kind === 'bug') return 'H1'
  return 'H1'
}

function detectRisk(level: HarnessLevel, highRisk: boolean): HarnessRisk {
  if (level === 'H3' || highRisk) return 'high'
  if (level === 'H2' || level === 'H1') return 'medium'
  return 'low'
}

function expectedEvidenceFor(
  kind: HarnessKind,
  level: HarnessLevel,
  publicSurface: boolean
): HarnessEvidence[] {
  const evidence = new Set<HarnessEvidence>()
  if (kind === 'bug') {
    evidence.add('regression-test')
    evidence.add('focused-tests')
    evidence.add('edge-cases')
  }
  if (kind === 'feature' || kind === 'refactor') {
    evidence.add('focused-tests')
    evidence.add('scope-check')
  }
  if (publicSurface) evidence.add('docs-if-public-behavior')
  if (level === 'H2' || level === 'H3') evidence.add('spec-or-design')
  if (level === 'H3') evidence.add('config-preservation')
  return [...evidence]
}

function gatesFor(level: HarnessLevel): HarnessGate[] {
  if (level === 'H0') return []
  if (level === 'H1') return ['verify-before-done']
  if (level === 'H2') return ['verify-before-done', 'scope-check']
  return ['spec-before-implementation', 'verify-before-done', 'scope-check', 'review-before-ship']
}

function rationaleFor(level: HarnessLevel, kind: HarnessKind, risk: HarnessRisk): string {
  if (level === 'H0') return `Low-risk ${kind}; keep the task direct and low-friction.`
  return `${level} ${kind}/${risk}; define expected evidence up front and verify before closure.`
}

function extractScopeHints(description: string): string[] {
  const terms = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9_.-]+/u)
    .filter((term) => term.length >= 3 && !STOPWORDS.has(term))
  return [...new Set(terms)].slice(0, 8)
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term))
}

function observedEvidenceFromFiles(files: string[]): string[] {
  const observed = new Set<string>()
  if (files.some(isTestFile)) observed.add('tests-changed')
  if (files.some(isDocsFile)) observed.add('docs-changed')
  return [...observed]
}

function isTestFile(file: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)\//.test(file) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(file)
}

function isDocsFile(file: string): boolean {
  return /(^|\/)(README|CHANGELOG|docs\/)/i.test(file)
}

function touchesPublicSurface(files: string[]): boolean {
  return files.some(
    (file) =>
      file.startsWith('core/commands/') ||
      file.startsWith('core/mcp/') ||
      file.startsWith('templates/') ||
      file === 'README.md'
  )
}

async function readChangedFiles(projectPath: string): Promise<string[]> {
  const files = new Set<string>()
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: projectPath,
    })
    for (const line of stdout.split('\n')) {
      const value = line.trim()
      if (value) files.add(value)
    }
  } catch {
    return []
  }
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: projectPath,
    })
    for (const line of stdout.split('\n')) {
      const value = line.trim()
      if (value) files.add(value)
    }
  } catch {
    // ignore untracked lookup failure
  }
  return [...files].sort()
}

async function readDiffSize(projectPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--shortstat', 'HEAD'], {
      cwd: projectPath,
    })
    const insertions = Number.parseInt(stdout.match(/(\d+) insertions?/)?.[1] ?? '0', 10)
    const deletions = Number.parseInt(stdout.match(/(\d+) deletions?/)?.[1] ?? '0', 10)
    return insertions + deletions
  } catch {
    return 0
  }
}
