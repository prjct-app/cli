/**
 * Legacy-disk sweep for crew persistence v7.
 *
 * Detects `.prjct/CHECKPOINTS.md` and `.prjct/team.json` from pre-spec-
 * a50b32d1 installs and migrates their content into kv_store:
 *
 *   .prjct/CHECKPOINTS.md  →  kv_store['crew:checkpoints']    source='migrated'
 *   .prjct/team.json       →  kv_store['team:enrollment']     + atomic mirror regen
 *
 * Idempotent: on second sync, the disk content is compared by mtime to
 * the last-flagged mtime cached in kv_store. Unchanged → no-op. Changed
 * after migration → emit a one-shot inbox warning (hand-edit detected;
 * we do NOT auto-apply because the user moved the source of truth back
 * to DB and shouldn't be silently re-clobbered).
 *
 * Never auto-deletes either file. The user removes them on their own.
 *
 * See spec a50b32d1 AC #10.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import checkpointsStorage from '../storage/checkpoints-storage'
import prjctDb from '../storage/database'
import teamEnrollmentStorage, { type TeamEnrollment } from '../storage/team-enrollment-storage'
import { writeFileAtomic } from '../utils/file-helper'
import log from '../utils/logger'

const LEGACY_CHECKPOINTS_PATH = '.prjct/CHECKPOINTS.md'
const LEGACY_TEAM_PATH = '.prjct/team.json'

const FLAG_CHECKPOINTS = 'migration:v2.19.8:last-flagged-checkpoints'
const FLAG_TEAM = 'migration:v2.19.8:last-flagged-team'

interface FlagRow {
  mtime_ms: number
  migrated_at: string
}

export interface LegacySweepResult {
  checkpointsMigrated: boolean
  checkpointsHandEditWarned: boolean
  teamMigrated: boolean
  teamHandEditWarned: boolean
  errors: Array<{ file: string; reason: string }>
}

function renderMirror(enrollment: TeamEnrollment): string {
  const mirror: Record<string, unknown> = {
    required: enrollment.required,
    minVersion: enrollment.minVersion,
    enrolledAt: enrollment.enrolledAt,
  }
  if (enrollment.enrolledBy !== null) mirror.enrolledBy = enrollment.enrolledBy
  return `${JSON.stringify(mirror, null, 2)}\n`
}

async function statMtimeMs(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath)
    return stat.mtimeMs
  } catch {
    return null
  }
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

function readFlag(projectId: string, key: string): FlagRow | null {
  return prjctDb.getDoc<FlagRow>(projectId, key)
}

function writeFlag(projectId: string, key: string, mtimeMs: number): void {
  prjctDb.setDoc<FlagRow>(projectId, key, {
    mtime_ms: mtimeMs,
    migrated_at: new Date().toISOString(),
  })
}

/**
 * Capture a one-shot inbox warning. The flag mtime guards against
 * repeated noise — `prjct sync` runs on every SessionStart hook, so a
 * persistent legacy file would otherwise re-fire on every session.
 */
async function captureInboxWarning(
  projectPath: string,
  text: string,
  tags: Record<string, string>
): Promise<void> {
  try {
    const { projectMemory } = await import('../memory/project-memory')
    await projectMemory.remember(projectPath, {
      type: 'inbox',
      content: text,
      tags,
      provenance: 'declared',
    })
  } catch (error) {
    log.debug('Legacy sweep inbox capture failed (non-critical)', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function sweepCheckpoints(
  projectPath: string,
  projectId: string,
  out: LegacySweepResult
): Promise<void> {
  const filePath = path.join(projectPath, LEGACY_CHECKPOINTS_PATH)
  const mtimeMs = await statMtimeMs(filePath)
  if (mtimeMs === null) return // file doesn't exist — nothing to do

  const flag = readFlag(projectId, FLAG_CHECKPOINTS)

  // First-time detection — migrate content into kv_store.
  if (flag === null) {
    const content = await tryReadFile(filePath)
    if (content === null) {
      out.errors.push({ file: LEGACY_CHECKPOINTS_PATH, reason: 'read failed' })
      return
    }
    try {
      checkpointsStorage.set(projectId, content, 'migrated')
      writeFlag(projectId, FLAG_CHECKPOINTS, mtimeMs)
      out.checkpointsMigrated = true
      await captureInboxWarning(
        projectPath,
        `Legacy .prjct/CHECKPOINTS.md migrated into kv_store crew:checkpoints. Manage with 'prjct crew checkpoints show|set|reset|export'. Original file left in place (not authoritative).`,
        { 'migration:v2.19.8': '1', topic: 'crew-checkpoints' }
      )
    } catch (error) {
      out.errors.push({
        file: LEGACY_CHECKPOINTS_PATH,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  // Already migrated. If disk mtime advanced past the last-flagged
  // mtime, the user hand-edited the file after migration. Warn once
  // (update the flag so we don't re-fire on every sync).
  if (mtimeMs > flag.mtime_ms) {
    await captureInboxWarning(
      projectPath,
      `Legacy .prjct/CHECKPOINTS.md hand-edited after migration — content NOT applied. Run 'prjct crew checkpoints set --file ${LEGACY_CHECKPOINTS_PATH}' to adopt, or delete the legacy file.`,
      { 'migration:v2.19.8': '1', topic: 'crew-checkpoints', state: 'hand-edited' }
    )
    writeFlag(projectId, FLAG_CHECKPOINTS, mtimeMs)
    out.checkpointsHandEditWarned = true
  }
}

async function sweepTeamJson(
  projectPath: string,
  projectId: string,
  out: LegacySweepResult
): Promise<void> {
  const filePath = path.join(projectPath, LEGACY_TEAM_PATH)
  const mtimeMs = await statMtimeMs(filePath)
  if (mtimeMs === null) return

  const flag = readFlag(projectId, FLAG_TEAM)
  const dbRow = teamEnrollmentStorage.get(projectId)

  // First-time detection. If DB is empty, adopt disk; otherwise the row
  // was likely set by `prjct team` post-migration — we just need to
  // record the mtime so future hand-edits get flagged once.
  if (flag === null) {
    const content = await tryReadFile(filePath)
    if (content === null) {
      out.errors.push({ file: LEGACY_TEAM_PATH, reason: 'read failed' })
      return
    }
    try {
      if (dbRow === null) {
        const parsed = JSON.parse(content) as Record<string, unknown>
        const enrollment: TeamEnrollment = {
          required: parsed.required === true,
          minVersion: typeof parsed.minVersion === 'string' ? parsed.minVersion : '0.0.0',
          enrolledAt:
            typeof parsed.enrolledAt === 'string' ? parsed.enrolledAt : new Date().toISOString(),
          enrolledBy: typeof parsed.enrolledBy === 'string' ? parsed.enrolledBy : null,
        }
        teamEnrollmentStorage.set(projectId, enrollment)
        // Regenerate the mirror so a future `prjct team check` finds
        // identical canonical content on both sides. Render shape mirrors
        // renderTeamMirror() in core/commands/team.ts — keep them in sync.
        await writeFileAtomic(filePath, renderMirror(enrollment))
        out.teamMigrated = true
        await captureInboxWarning(
          projectPath,
          `Legacy .prjct/team.json adopted into kv_store team:enrollment. The disk file is now a derived mirror — do not hand-edit; run 'prjct team check' to detect drift.`,
          { 'migration:v2.19.8': '1', topic: 'team-enrollment' }
        )
      }
      writeFlag(projectId, FLAG_TEAM, mtimeMs)
    } catch (error) {
      out.errors.push({
        file: LEGACY_TEAM_PATH,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  if (mtimeMs > flag.mtime_ms) {
    await captureInboxWarning(
      projectPath,
      `.prjct/team.json hand-edited after migration — your edit was NOT applied (file is a derived mirror). Run 'prjct team check' to rewrite the mirror from DB, or 'prjct team' to re-enroll with new values.`,
      { 'migration:v2.19.8': '1', topic: 'team-enrollment', state: 'hand-edited' }
    )
    writeFlag(projectId, FLAG_TEAM, mtimeMs)
    out.teamHandEditWarned = true
  }
}

/**
 * Run the legacy sweep. Best-effort: errors are collected and returned
 * but never thrown (sync must not fail on this — it runs every session
 * start and should be a quiet no-op once the user has migrated).
 */
export async function legacyCrewSweep(
  projectPath: string,
  projectId: string
): Promise<LegacySweepResult> {
  const out: LegacySweepResult = {
    checkpointsMigrated: false,
    checkpointsHandEditWarned: false,
    teamMigrated: false,
    teamHandEditWarned: false,
    errors: [],
  }
  await sweepCheckpoints(projectPath, projectId, out).catch((error) => {
    out.errors.push({
      file: LEGACY_CHECKPOINTS_PATH,
      reason: error instanceof Error ? error.message : String(error),
    })
  })
  await sweepTeamJson(projectPath, projectId, out).catch((error) => {
    out.errors.push({
      file: LEGACY_TEAM_PATH,
      reason: error instanceof Error ? error.message : String(error),
    })
  })
  return out
}
