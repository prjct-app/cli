#!/usr/bin/env bun
/**
 * One-time maintenance: remove legacy write-through orphan files from
 * ~/.prjct-cli/projects/*.
 *
 * Background: `prjct init` historically seeded write-through stub files
 * (core/*.md, progress/*.md, planning/*.md incl. planning/tasks/,
 * memory/patterns.json, memory/context.jsonl) into the global project
 * folder. Nothing ever read them back — real state lives in prjct.db —
 * so they accumulated as orphaned garbage with no DB record. The init
 * writer is fixed; this clears the historical residue.
 *
 * SAFE BY DEFAULT: dry-run unless `--apply` is passed. Idempotent —
 * re-running after a successful pass is a no-op. Before deleting any
 * planning/architect-session.md it prints the FULL file content so a
 * real idea is never lost without a record (capture the run output).
 *
 * Preserved, never touched: prjct.db*, context/, analysis/, config/,
 * storage/, sync/, sessions/, and the memory/ dir itself (only the two
 * named legacy files inside are removed).
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const projectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')

const LEGACY_DIRS = ['core', 'progress', 'planning'] as const
const LEGACY_FILES = [
  path.join('memory', 'patterns.json'),
  path.join('memory', 'context.jsonl'),
] as const

const exists = (p: string): Promise<boolean> =>
  fs
    .stat(p)
    .then(() => true)
    .catch(() => false)

async function main(): Promise<void> {
  if (!(await exists(projectsDir))) {
    console.log(`No projects dir at ${projectsDir} — nothing to do.`)
    return
  }

  const entries = await fs.readdir(projectsDir, { withFileTypes: true })
  const projects = entries.filter((e) => e.isDirectory()).map((e) => e.name)

  let scanned = 0
  let dirsRemoved = 0
  let filesRemoved = 0
  const ideaDumps: string[] = []

  for (const id of projects) {
    scanned++
    const base = path.join(projectsDir, id)

    // Preserve the idea: dump architect-session.md before its dir goes.
    const arch = path.join(base, 'planning', 'architect-session.md')
    if (await exists(arch)) {
      const body = await fs.readFile(arch, 'utf-8')
      const dump = `\n──── ${id}/planning/architect-session.md ────\n${body.trimEnd()}\n`
      ideaDumps.push(dump)
      console.log(dump)
    }

    for (const dir of LEGACY_DIRS) {
      const target = path.join(base, dir)
      if (await exists(target)) {
        if (APPLY) await fs.rm(target, { recursive: true, force: true })
        dirsRemoved++
      }
    }
    for (const rel of LEGACY_FILES) {
      const target = path.join(base, rel)
      if (await exists(target)) {
        if (APPLY) await fs.rm(target, { force: true })
        filesRemoved++
      }
    }
  }

  const mode = APPLY ? 'APPLIED' : 'DRY-RUN (no changes written — pass --apply to delete)'
  console.log(
    [
      '',
      `=== legacy-orphan cleanup — ${mode} ===`,
      `projects scanned:           ${scanned}`,
      `${APPLY ? 'legacy dirs removed:' : 'legacy dirs to remove:'}        ${dirsRemoved}`,
      `${APPLY ? 'legacy files removed:' : 'legacy files to remove:'}       ${filesRemoved}`,
      `architect-session.md found: ${ideaDumps.length} (full content printed above — keep this log)`,
      'preserved: prjct.db*, context/, analysis/, config/, storage/, sync/, sessions/, memory/ (dir)',
    ].join('\n')
  )
}

main().catch((err) => {
  console.error('cleanup failed:', err)
  process.exitCode = 1
})
