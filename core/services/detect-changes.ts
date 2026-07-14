/**
 * detect_changes — git diff → affected symbols + blast radius + risk.
 *
 * P1: hunk-level — map unified-diff line ranges to symbols by start_line.
 */

import { loadGraph } from '../domain/import-graph'
import { fileFanIn, filesCallingInto, hasSymbolIndex, symbolsInFile } from '../domain/symbol-graph'
import type { ChangeRisk, DetectChangesResult, DetectedChange } from '../types/domain.js'
import { execFileAsync } from '../utils/exec'

async function safeGit(projectPath: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: projectPath })
    return stdout.trim()
  } catch {
    return null
  }
}

async function listWorkingTreeFiles(projectPath: string): Promise<string[]> {
  const unstaged = (await safeGit(projectPath, ['diff', '--name-only', 'HEAD'])) ?? ''
  const staged = (await safeGit(projectPath, ['diff', '--name-only', '--cached'])) ?? ''
  const untracked =
    (await safeGit(projectPath, ['ls-files', '--others', '--exclude-standard'])) ?? ''
  const set = new Set<string>()
  for (const block of [unstaged, staged, untracked]) {
    for (const line of block.split('\n')) {
      if (line.trim()) set.add(line.trim())
    }
  }
  return [...set]
}

async function listCommittedFiles(projectPath: string): Promise<string[]> {
  let defaultRef = ''
  const originHead = await safeGit(projectPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])
  if (originHead && originHead !== 'origin/HEAD') defaultRef = originHead
  else {
    for (const c of ['main', 'master']) {
      if ((await safeGit(projectPath, ['rev-parse', '--verify', '--quiet', c])) !== null) {
        defaultRef = c
        break
      }
    }
  }
  if (!defaultRef) return []
  const base = await safeGit(projectPath, ['merge-base', defaultRef, 'HEAD'])
  if (!base) return []
  const names = (await safeGit(projectPath, ['diff', '--name-only', `${base}..HEAD`])) ?? ''
  return names.split('\n').filter(Boolean)
}

async function resolveDiffBase(
  projectPath: string,
  source: DetectChangesResult['source']
): Promise<string | null> {
  if (source === 'working-tree' || source === 'explicit') return 'HEAD'
  let defaultRef = ''
  const originHead = await safeGit(projectPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])
  if (originHead && originHead !== 'origin/HEAD') defaultRef = originHead
  else {
    for (const c of ['main', 'master']) {
      if ((await safeGit(projectPath, ['rev-parse', '--verify', '--quiet', c])) !== null) {
        defaultRef = c
        break
      }
    }
  }
  if (!defaultRef) return 'HEAD'
  return (await safeGit(projectPath, ['merge-base', defaultRef, 'HEAD'])) ?? 'HEAD'
}

/**
 * Parse unified diff for a file into new-file line numbers that changed.
 * Handles both `@@ -a,b +c,d @@` hunks (additions/context on + side).
 */
export function parseChangedLinesFromUnifiedDiff(diff: string): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  let currentFile: string | null = null
  let newLine = 0

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim()
      if (p === '/dev/null') {
        currentFile = null
        continue
      }
      currentFile = p.replace(/^b\//, '')
      if (!map.has(currentFile)) map.set(currentFile, new Set())
      continue
    }
    if (!currentFile) continue
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (hunk) {
      newLine = Number.parseInt(hunk[1]!, 10)
      continue
    }
    if (raw.startsWith('\\')) continue
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      map.get(currentFile)?.add(newLine)
      newLine++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      // deletion: does not advance new-file line
    } else if (raw.startsWith(' ') || raw === '') {
      newLine++
    }
  }
  return map
}

async function loadHunkLines(
  projectPath: string,
  source: DetectChangesResult['source'],
  files: string[]
): Promise<Map<string, Set<number>>> {
  if (files.length === 0) return new Map()
  const base = await resolveDiffBase(projectPath, source)
  if (!base) return new Map()

  const args =
    source === 'committed'
      ? ['diff', '-U0', `${base}..HEAD`, '--', ...files]
      : ['diff', '-U0', 'HEAD', '--', ...files]

  const diff = (await safeGit(projectPath, args)) ?? ''
  // Also staged for working-tree
  let staged = ''
  if (source !== 'committed') {
    staged = (await safeGit(projectPath, ['diff', '-U0', '--cached', '--', ...files])) ?? ''
  }
  const map = parseChangedLinesFromUnifiedDiff(diff + '\n' + staged)
  return map
}

/** Symbols whose startLine falls in a changed hunk (or nearest prior symbol). */
export function symbolsTouchedByHunks(
  projectId: string,
  file: string,
  changedLines: Set<number> | undefined
): string[] {
  const all = symbolsInFile(projectId, file)
  if (all.length === 0) return []
  if (!changedLines || changedLines.size === 0) {
    return all.slice(0, 12).map((s) => s.name)
  }
  const lines = [...changedLines].sort((a, b) => a - b)
  const names = new Set<string>()
  for (const line of lines) {
    // Nearest symbol with startLine <= line
    let best = all[0]!
    for (const s of all) {
      if (s.startLine <= line) best = s
      else break
    }
    names.add(best.name)
    // Also any symbol starting exactly on a changed line
    for (const s of all) {
      if (changedLines.has(s.startLine)) names.add(s.name)
    }
  }
  return [...names].slice(0, 12)
}

const CRITICAL_PATH =
  /(?:^|\/)(?:auth|security|crypto|billing|payment|migrate|schema|migrations?)(?:\/|$)/i
const HIGH_PATH = /(?:^|\/)(?:storage|database|db|sync|daemon|mcp|hooks?|session)(?:\/|$)/i

function classifyRisk(
  file: string,
  fanIn: number,
  importerCount: number,
  hasSymbols: boolean,
  hunkSymbolCount: number
): { risk: ChangeRisk; reasons: string[] } {
  const reasons: string[] = []
  let risk: ChangeRisk = 'low'

  if (CRITICAL_PATH.test(file)) {
    risk = 'critical'
    reasons.push('touches auth/security/billing/schema path')
  } else if (HIGH_PATH.test(file)) {
    risk = 'high'
    reasons.push('touches storage/sync/hooks/mcp path')
  }

  if (fanIn >= 15) {
    risk = 'critical'
    reasons.push(`high call fan-in (${fanIn} callers)`)
  } else if (fanIn >= 5) {
    if (risk === 'low') risk = 'high'
    reasons.push(`moderate call fan-in (${fanIn} callers)`)
  } else if (fanIn > 0) {
    if (risk === 'low') risk = 'medium'
    reasons.push(`${fanIn} caller(s) via symbol graph`)
  }

  if (importerCount >= 10) {
    if (risk !== 'critical') risk = 'high'
    reasons.push(`${importerCount} importers`)
  } else if (importerCount >= 3) {
    if (risk === 'low') risk = 'medium'
    reasons.push(`${importerCount} importers`)
  }

  if (hunkSymbolCount > 0) {
    reasons.push(`${hunkSymbolCount} symbol(s) in changed hunks`)
  }

  if (!hasSymbols && importerCount === 0 && fanIn === 0) {
    reasons.push('leaf change (no graph neighbors)')
  }

  if (reasons.length === 0) reasons.push('isolated or low connectivity')
  return { risk, reasons }
}

export async function detectChanges(
  projectPath: string,
  projectId: string,
  opts: {
    files?: string[]
    /** Prefer working-tree; fall back to committed range vs main. */
    source?: 'working-tree' | 'committed' | 'auto'
  } = {}
): Promise<DetectChangesResult> {
  let changedFiles = opts.files ?? []
  let source: DetectChangesResult['source'] = 'explicit'

  if (changedFiles.length === 0) {
    const mode = opts.source ?? 'auto'
    if (mode === 'working-tree' || mode === 'auto') {
      changedFiles = await listWorkingTreeFiles(projectPath)
      source = 'working-tree'
    }
    if (changedFiles.length === 0 && (mode === 'committed' || mode === 'auto')) {
      changedFiles = await listCommittedFiles(projectPath)
      source = 'committed'
    }
  }

  const importGraph = loadGraph(projectId)
  const hasSymbols = hasSymbolIndex(projectId)

  const hunkMap = hasSymbols
    ? await loadHunkLines(projectPath, source, changedFiles.slice(0, 80))
    : new Map<string, Set<number>>()

  // Expand blast radius via import reverse edges + call-graph
  const affected = new Set<string>(changedFiles)
  for (const f of changedFiles) {
    const importers = importGraph?.reverse[f] ?? []
    for (const imp of importers) affected.add(imp)
  }
  if (hasSymbols) {
    for (const f of filesCallingInto(projectId, changedFiles, 2)) {
      affected.add(f)
    }
  }

  const changes: DetectedChange[] = []
  const summary = { critical: 0, high: 0, medium: 0, low: 0 }

  for (const file of changedFiles) {
    const importers = importGraph?.reverse[file] ?? []
    const fanIn = hasSymbols ? fileFanIn(projectId, file) : 0
    const touched = hasSymbols ? symbolsTouchedByHunks(projectId, file, hunkMap.get(file)) : []
    const { risk, reasons } = classifyRisk(
      file,
      fanIn,
      importers.length,
      touched.length > 0 || (hasSymbols && symbolsInFile(projectId, file).length > 0),
      touched.length
    )
    summary[risk]++
    changes.push({
      file,
      risk,
      touchedSymbols: touched,
      fanIn,
      reasons,
    })
  }

  const order: Record<ChangeRisk, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  changes.sort((a, b) => order[a.risk] - order[b.risk] || a.file.localeCompare(b.file))

  return {
    changedFiles,
    affectedFiles: [...affected].sort(),
    changes,
    summary,
    source,
  }
}

export function formatDetectChangesMd(result: DetectChangesResult): string {
  if (result.changedFiles.length === 0) {
    return '## Detect changes\n\n_No changes detected (clean tree / no base range)._\n'
  }
  const lines = [
    '## Detect changes',
    '',
    `- **Source**: ${result.source}`,
    `- **Changed**: ${result.changedFiles.length} file(s)`,
    `- **Blast radius**: ${result.affectedFiles.length} file(s) (imports + call-graph)`,
    `- **Risk**: critical ${result.summary.critical} · high ${result.summary.high} · medium ${result.summary.medium} · low ${result.summary.low}`,
    '',
    '### Per-file risk',
    '',
  ]
  for (const c of result.changes) {
    const syms =
      c.touchedSymbols.length > 0 ? ` · symbols: ${c.touchedSymbols.slice(0, 6).join(', ')}` : ''
    lines.push(`- **${c.risk.toUpperCase()}** \`${c.file}\`${syms}`, `  - ${c.reasons.join('; ')}`)
  }
  if (result.affectedFiles.length > result.changedFiles.length) {
    lines.push('', '### Affected beyond diff', '')
    const extra = result.affectedFiles.filter((f) => !result.changedFiles.includes(f)).slice(0, 25)
    for (const f of extra) lines.push(`- \`${f}\``)
    if (result.affectedFiles.length - result.changedFiles.length > 25) {
      lines.push(`- _…+${result.affectedFiles.length - result.changedFiles.length - 25} more_`)
    }
  }
  lines.push('', '_Advisory. Expand with `prjct code trace <symbol>` or MCP `prjct_trace_path`._')
  return lines.join('\n')
}

export function formatDetectChangesText(result: DetectChangesResult): string {
  if (result.changedFiles.length === 0) {
    return 'detect-changes: no changes detected'
  }
  const lines = [
    `Detect changes (${result.source}): ${result.changedFiles.length} changed → blast ${result.affectedFiles.length}`,
    `Risk: critical=${result.summary.critical} high=${result.summary.high} medium=${result.summary.medium} low=${result.summary.low}`,
  ]
  for (const c of result.changes.slice(0, 30)) {
    const sym = c.touchedSymbols.length ? ` [${c.touchedSymbols.slice(0, 4).join(',')}]` : ''
    lines.push(`  [${c.risk.toUpperCase()}] ${c.file}${sym} — ${c.reasons[0] ?? ''}`)
  }
  return lines.join('\n')
}

/** One-line ship advisory from structural risk (never hard-blocks by itself). */
export function shipStructuralRiskCue(result: DetectChangesResult): string | null {
  if (result.changedFiles.length === 0) return null
  if (result.summary.critical > 0) {
    return `⚠️  Structural risk CRITICAL (${result.summary.critical} file(s), blast ${result.affectedFiles.length}). Review: \`prjct code impact --md\`.`
  }
  if (result.summary.high > 0) {
    return `⚠️  Structural risk HIGH (${result.summary.high} file(s), blast ${result.affectedFiles.length}). Consider \`prjct code impact --md\`.`
  }
  return null
}
