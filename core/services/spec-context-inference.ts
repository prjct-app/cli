/**
 * Spec context inference (Phase 1.6 / B-CTX).
 *
 * When `prjct spec <title>` is called in a brownfield project,
 * compose existing primitives to surface the relevant slice of the
 * codebase + project memory:
 *   - findRelevantFiles(title) — BM25-style scoring over code paths
 *   - projectMemory.recall(topic) — decisions / gotchas / learnings
 *     filtered by inferred domain tag
 *
 * Output is a Markdown block tagged `<!-- auto-context:tentative -->`
 * that the spec service writes into `spec.notes` when the field is
 * empty. Humans validate or replace before audit-spec runs.
 *
 * Errors are non-fatal: a context-recall miss emits a structured
 * stderr warning (B-ERR-CONTRACT) but does not block spec creation.
 */

import { projectMemory } from '../memory/project-memory'
import { findRelevantFiles } from '../tools/context/files-tool'

const PATH_CAP = 5
const MEMORY_LIMIT = 8
const MIN_SCORE = 0.15

export interface ContextInferenceResult {
  /** Markdown block ready to slot into spec.notes. Empty string when
   *  no signal found (caller decides whether to skip or warn). */
  notesBlock: string
  /** Inferred paths — also handed to audit-spec dispatch (B-RVW). */
  paths: string[]
  /** Memory entries the recall surfaced. */
  memoryHits: number
  /** True when neither files nor memory matched. Drives B-ERR. */
  empty: boolean
}

/**
 * Compose `findRelevantFiles` + `projectMemory.recall` into a
 * Markdown notes block. `projectId` is required for the memory
 * recall; `projectPath` for file inference.
 */
export async function inferSpecContext(
  title: string,
  projectId: string,
  projectPath: string
): Promise<ContextInferenceResult> {
  const [filesOut, memoryHits] = await Promise.all([
    findRelevantFiles(title, projectPath, {
      maxFiles: PATH_CAP * 4, // over-fetch then dedupe by dir
      minScore: MIN_SCORE,
    }).catch(() => ({ files: [] as Array<{ path: string; score: number }> })),
    Promise.resolve(
      projectMemory.recall(projectId, {
        topic: title,
        limit: MEMORY_LIMIT,
      })
    ).catch(() => []),
  ])

  const paths = dedupeTopDirs(
    filesOut.files.map((f) => f.path),
    PATH_CAP
  )
  const empty = paths.length === 0 && memoryHits.length === 0

  if (empty) {
    return { notesBlock: '', paths: [], memoryHits: 0, empty: true }
  }

  const notesBlock = buildNotesBlock(title, paths, memoryHits)
  return { notesBlock, paths, memoryHits: memoryHits.length, empty: false }
}

/**
 * Collapse a long file list to ≤ N representative top-level dirs +
 * the highest-scoring file in each. Keeps the notes block compact.
 */
function dedupeTopDirs(files: string[], cap: number): string[] {
  const seenDirs = new Set<string>()
  const out: string[] = []
  for (const f of files) {
    const topDir = f.split('/').slice(0, 2).join('/')
    if (seenDirs.has(topDir)) continue
    seenDirs.add(topDir)
    out.push(f)
    if (out.length >= cap) break
  }
  return out
}

function buildNotesBlock(
  title: string,
  paths: string[],
  memoryHits: Array<{ type: string; content: string; tags: Record<string, string> }>
): string {
  const lines: string[] = []
  lines.push('<!-- auto-context:tentative -->')
  lines.push('## Existing context (auto-inferred)')
  lines.push('')
  lines.push(`_Inferred from title "${title}". Validate before audit — entries tagged tentative._`)
  lines.push('')

  if (paths.length > 0) {
    lines.push('### Likely paths')
    for (const p of paths) lines.push(`- \`${p}\``)
    lines.push('')
  }

  if (memoryHits.length > 0) {
    lines.push('### Relevant prior memory')
    for (const m of memoryHits) {
      const preview = m.content.length > 140 ? `${m.content.slice(0, 137)}…` : m.content
      const tags = Object.entries(m.tags)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ')
      lines.push(`- **${m.type}**${tags ? ` _(${tags})_` : ''} — ${preview}`)
    }
    lines.push('')
  }

  lines.push('<!-- /auto-context -->')
  return lines.join('\n')
}

/**
 * Emit a structured stderr warning per the B-ERR-CONTRACT acceptance
 * criterion. Callers use this when `inferSpecContext` returns empty
 * and they want the user / agent to know context recall missed.
 */
export function warnNoContextMatch(title: string, suggestion?: string): void {
  const payload = {
    level: 'warn',
    code: 'no_context_match',
    message: `No codebase or memory context matched "${title}"`,
    suggestion: suggestion ?? 'Fill spec.notes manually or run with `--skip-context` next time.',
  }
  // stderr is reserved for diagnostics; stdout stays for command output.
  process.stderr.write(`${JSON.stringify(payload)}\n`)
}
