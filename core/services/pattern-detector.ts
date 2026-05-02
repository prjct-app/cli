/**
 * Pattern Detector — surface durable patterns from recent project work.
 *
 * Scope (M2 of the rescue plan): start with hot files only. A file
 * touched 3+ times in the last 7 days is a refactor candidate worth
 * the user's attention. Detected on every Stop hook fire, persisted as
 * a `learning` memory entry tagged `pattern:hot-file`. The wiki regen
 * exposes them under `_generated/memory/learning.md`, and the
 * lookup-first protocol in CLAUDE.md ensures Claude finds them at
 * session start.
 *
 * Recurring bugs and tech-debt growth are deferred to a follow-up
 * commit. Heuristics for those need more thought to avoid false
 * positives.
 *
 * Design contract (mem_899):
 *   - Best-effort, never blocks the Stop hook.
 *   - Idempotent: a file already marked hot in the same window is not
 *     re-persisted.
 *   - Conservative: noise > value. We'd rather miss a hot file than
 *     pollute the memory store with churn.
 */

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import configManager from '../infrastructure/config-manager'
import { projectMemory } from '../memory/project-memory'

const execFileP = promisify(execFile)

const HOT_FILE_PATTERN_TAG = 'hot-file'
const HOT_FILE_SOURCE_TAG = 'pattern-detector-auto'
// Window + threshold tuned conservatively. 3+ touches over a week is
// "this file is the locus of recent activity" without flagging every
// daily-touched file in an active repo.
const WINDOW_DAYS = 7
const HOT_THRESHOLD = 3
// Skip noisy paths that are touched on every commit and offer no
// refactor signal.
const IGNORE_PATTERNS: readonly RegExp[] = [
  /^package(-lock)?\.json$/,
  /^bun\.lock(b)?$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^CHANGELOG\.md$/,
  /^\.gitignore$/,
  /\.snap$/,
  /^dist\//,
  /^node_modules\//,
]

interface HotFile {
  path: string
  touches: number
}

interface DetectResult {
  scanned: number
  hotFiles: HotFile[]
  persisted: number
  skipped: { reason: string; file?: string }[]
  errors: string[]
}

/**
 * Public entry: run all detectors, persist insights for new hot files.
 * Stop hook awaits this best-effort. Wraps every IO in try/catch so a
 * non-git directory or a transient git failure never escapes.
 */
export async function detectAndPersistPatterns(projectPath: string): Promise<DetectResult> {
  const result: DetectResult = {
    scanned: 0,
    hotFiles: [],
    persisted: 0,
    skipped: [],
    errors: [],
  }

  const config = await configManager.readConfig(projectPath).catch(() => null)
  if (!config?.projectId) {
    result.errors.push('no project config')
    return result
  }

  let hotFiles: HotFile[] = []
  try {
    hotFiles = await detectHotFiles(projectPath)
  } catch (err) {
    result.errors.push(`hot-file detection failed: ${(err as Error).message}`)
    return result
  }
  result.scanned = hotFiles.length
  result.hotFiles = hotFiles

  if (hotFiles.length === 0) return result

  const alreadyMarked = collectAlreadyMarked(config.projectId)

  for (const hf of hotFiles) {
    if (alreadyMarked.has(hf.path)) {
      result.skipped.push({ reason: 'already-marked-this-window', file: hf.path })
      continue
    }
    try {
      await projectMemory.remember(projectPath, {
        type: 'learning',
        content:
          `Hot file: \`${hf.path}\` — ${hf.touches} touches in the last ${WINDOW_DAYS} days. ` +
          `Worth a refactor pass or a deliberate decision about why it churns this often.`,
        tags: {
          source: HOT_FILE_SOURCE_TAG,
          pattern: HOT_FILE_PATTERN_TAG,
          file: hf.path,
          touches: String(hf.touches),
          window_days: String(WINDOW_DAYS),
        },
        provenance: 'inferred',
      })
      result.persisted += 1
    } catch (err) {
      result.errors.push(`remember failed for ${hf.path}: ${(err as Error).message}`)
    }
  }

  return result
}

// =============================================================================
// Hot file detection
// =============================================================================

/**
 * Walk `git log --name-only` for the last WINDOW_DAYS, count touches per
 * path, drop ignore-listed paths, return ones over HOT_THRESHOLD.
 *
 * Uses `git log -z` so paths with newlines or quotes don't fragment the
 * parse. Returns sorted by touch count desc.
 */
export async function detectHotFiles(projectPath: string): Promise<HotFile[]> {
  // -z: NUL-separate paths inside each commit; --name-only without
  //   --diff-filter so we count any change (add/modify/rename).
  // --pretty=format:: empty so each commit emits only its file list.
  const { stdout } = await execFileP(
    'git',
    ['log', `--since=${WINDOW_DAYS}.days.ago`, '--name-only', '--pretty=format:', '-z'],
    { cwd: projectPath, maxBuffer: 16 * 1024 * 1024 }
  )

  const counts = new Map<string, number>()
  for (const raw of stdout.split('\0')) {
    const file = raw.trim()
    if (!file) continue
    if (isIgnored(file)) continue
    counts.set(file, (counts.get(file) ?? 0) + 1)
  }

  const hot: HotFile[] = []
  for (const [file, touches] of counts) {
    if (touches < HOT_THRESHOLD) continue
    hot.push({ path: file, touches })
  }
  hot.sort((a, b) => b.touches - a.touches)
  return hot
}

function isIgnored(file: string): boolean {
  const base = path.basename(file)
  for (const re of IGNORE_PATTERNS) {
    if (re.test(file) || re.test(base)) return true
  }
  return false
}

// =============================================================================
// Dedup against previously persisted hot-file insights (same window)
// =============================================================================

interface MemoryRow {
  data: string
}

/**
 * Pull recent auto-persisted hot-file insights and return the set of
 * file paths already marked. Window dedup: we treat any insight in the
 * last WINDOW_DAYS as "still valid" so we don't re-persist on every
 * Stop hook call. The next window will let us re-mark naturally.
 */
function collectAlreadyMarked(projectId: string): Set<string> {
  const out = new Set<string>()
  try {
    const { prjctDb } = require('../storage/database') as typeof import('../storage/database')
    const rows = prjctDb.query<MemoryRow>(
      projectId,
      "SELECT data FROM events WHERE type = 'memory.remember.learning' ORDER BY id DESC LIMIT 200"
    )
    const cutoffMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
    for (const row of rows) {
      let parsed: unknown
      try {
        parsed = JSON.parse(row.data)
      } catch {
        continue
      }
      if (!parsed || typeof parsed !== 'object') continue
      const tags = (parsed as { tags?: Record<string, unknown> }).tags
      if (!tags || tags.source !== HOT_FILE_SOURCE_TAG) continue
      // Tags carry the marker; the row's timestamp is the event's
      // outer field, not in `data`. Conservative: if we have a hit on
      // source+pattern+file, treat as marked regardless of age and let
      // the LIMIT 200 window handle staleness.
      const file = tags.file
      const ts = (parsed as { rememberedAt?: unknown }).rememberedAt
      if (typeof file !== 'string') continue
      if (typeof ts === 'string') {
        const t = Date.parse(ts)
        if (!Number.isNaN(t) && t < cutoffMs) continue
      }
      out.add(file)
    }
  } catch {
    // Best-effort: a missing dedup index just means a duplicate this
    // turn. The user can prune.
  }
  return out
}

// =============================================================================
// Test exports
// =============================================================================

export const _internal = {
  detectHotFiles,
  isIgnored,
  IGNORE_PATTERNS,
  HOT_THRESHOLD,
  WINDOW_DAYS,
}
