/**
 * Lean detector — track deferred-simplification debt accumulating in source.
 *
 * A `lean:` annotation marks a deliberate shortcut plus its upgrade path
 * (the prjct-native equivalent of ponytail's `ponytail:` comments). When
 * their count climbs, simplification debt is piling up unaddressed — the
 * same signal shape as `pattern-detector`'s tech-debt-growth detector,
 * applied to lean markers.
 *
 * OPT-IN: runs only when `config.lean.mode` (or `PRJCT_LEAN_MODE`) is a
 * mode other than `off`. Projects that prefer completeness over minimalism
 * see zero new memory entries and zero behaviour change.
 *
 * Design contract (matches pattern-detector, mem_899):
 *   - Best-effort, never blocks the Stop hook.
 *   - Idempotent: growth measured against the last persisted snapshot.
 *   - Conservative: only flags growth >= threshold, never on first run.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import configManager from '../infrastructure/config-manager'
import { projectMemory } from '../memory/project-memory'
import type { LocalConfig } from '../types/config'

const execFileP = promisify(execFile)

const LEAN_DEBT_SOURCE_TAG = 'lean-detector'
const LEAN_DEBT_PATTERN_TAG = 'lean-debt-growth'

// Only flag when markers grew by >= 3 since the last snapshot. Smaller
// deltas are noise — a refactor flushes some markers and adds others in
// passing. First run (previous === 0) never flags.
const LEAN_DEBT_GROWTH_THRESHOLD = 3

const LEAN_MODES = ['off', 'lite', 'full', 'ultra'] as const
type LeanMode = (typeof LEAN_MODES)[number]

interface DetectResult {
  active: boolean
  total: number
  previous: number
  persisted: boolean
}

/**
 * Inlined here (not imported from the `lean` command) so the warm Stop-hook
 * path never pulls the command module + its dependency graph. Config wins;
 * `PRJCT_LEAN_MODE` is the fallback default.
 */
function effectiveMode(config: LocalConfig | null): LeanMode {
  const fromConfig = config?.lean?.mode
  if (fromConfig && (LEAN_MODES as readonly string[]).includes(fromConfig)) return fromConfig
  const fromEnv = process.env.PRJCT_LEAN_MODE?.toLowerCase()
  if (fromEnv && (LEAN_MODES as readonly string[]).includes(fromEnv)) return fromEnv as LeanMode
  return 'off'
}

/**
 * Public entry: measure lean-marker count, compare to the last snapshot,
 * persist a `lean-debt` entry if the count grew past the threshold. Stop
 * hook awaits this best-effort.
 */
export async function detectAndPersistLeanDebt(
  projectPath: string,
  preloadedConfig?: LocalConfig | null
): Promise<DetectResult> {
  const result: DetectResult = { active: false, total: 0, previous: 0, persisted: false }

  const config =
    preloadedConfig !== undefined
      ? preloadedConfig
      : await configManager.readConfig(projectPath).catch(() => null)
  if (!config?.projectId) return result
  if (effectiveMode(config) === 'off') return result
  result.active = true

  try {
    const total = await measureLeanMarkers(projectPath)
    result.total = total
    if (total === 0) return result

    const previous = collectPreviousSnapshot(config.projectId)
    result.previous = previous
    const delta = total - previous
    if (previous > 0 && delta >= LEAN_DEBT_GROWTH_THRESHOLD) {
      await projectMemory.remember(projectPath, {
        type: 'lean-debt',
        content:
          `Lean debt growing: \`lean:\` markers rose by ${delta} (now ${total}, was ${previous}). ` +
          `Deferred simplifications are accumulating — consider a leaning pass via \`prjct lean debt\`.`,
        tags: {
          source: LEAN_DEBT_SOURCE_TAG,
          pattern: LEAN_DEBT_PATTERN_TAG,
          total: String(total),
          previous: String(previous),
          delta: String(delta),
        },
        provenance: 'inferred',
        projectId: config.projectId,
      })
      result.persisted = true
    }
  } catch {
    // git missing / non-repo → swallow; nothing to do here.
  }
  return result
}

/**
 * Count `lean:` markers across the working tree via `git grep` (respects
 * .gitignore, skips binaries). Counts the markers themselves so the
 * comparison stays meaningful turn-over-turn.
 */
async function measureLeanMarkers(projectPath: string): Promise<number> {
  try {
    const { stdout } = await execFileP('git', ['grep', '-cI', '-e', 'lean:'], {
      cwd: projectPath,
      maxBuffer: 16 * 1024 * 1024,
    })
    let total = 0
    for (const line of stdout.split('\n')) {
      // `git grep -c` emits "<file>:<count>" per file.
      const idx = line.lastIndexOf(':')
      if (idx <= 0) continue
      const num = Number.parseInt(line.slice(idx + 1), 10)
      if (Number.isFinite(num)) total += num
    }
    return total
  } catch (err) {
    // git grep exits 1 when there are no matches — treat as zero.
    if ((err as { code?: number }).code === 1) return 0
    throw err
  }
}

interface DebtMemoryRow {
  data: string
}

/** Read the most recent lean-debt snapshot we persisted. Returns 0 on the
 *  first run so the comparison (gated on previous > 0) never flags noise. */
function collectPreviousSnapshot(projectId: string): number {
  try {
    const { prjctDb } = require('../storage/database') as typeof import('../storage/database')
    const rows = prjctDb.query<DebtMemoryRow>(
      projectId,
      "SELECT data FROM events WHERE type = 'memory.remember.lean-debt' ORDER BY id DESC LIMIT 50"
    )
    for (const row of rows) {
      let parsed: unknown
      try {
        parsed = JSON.parse(row.data)
      } catch {
        continue
      }
      if (!parsed || typeof parsed !== 'object') continue
      const tags = (parsed as { tags?: Record<string, unknown> }).tags
      if (!tags || tags.source !== LEAN_DEBT_SOURCE_TAG) continue
      const total = typeof tags.total === 'string' ? Number.parseInt(tags.total, 10) : 0
      if (Number.isFinite(total)) return total
    }
  } catch {
    /* fall through — best-effort */
  }
  return 0
}

// Test exports
export const _internal = {
  effectiveMode,
  measureLeanMarkers,
  LEAN_DEBT_GROWTH_THRESHOLD,
}
