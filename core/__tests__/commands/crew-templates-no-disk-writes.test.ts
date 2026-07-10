/**
 * Architecture guard: shipped crew templates must not instruct subagents to
 * write reports into the customer's working tree.
 *
 * Customer #1 (pre-2.19.7): `.prjct/sessions/<task>/<role>.md` ghost files
 * because templates told subagents to persist output there.
 * Customer #2 (post-2.23.7): `.prjct/audits/*.md`, `.prjct/CHECKPOINTS.md`,
 * `.prjct/deploy/RAILWAY-CHECKLIST.md` because the leader template said
 * "Edits to `.prjct/` ... you may edit directly" — the leader treated the
 * whole .prjct/ subtree as a free-write zone.
 *
 * Product invariant: SQLite is the only allowed persistence surface. The
 * ONLY hand-editable file under .prjct/ is .prjct/prjct.config.json.
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const CREW_DIR = path.join(REPO_ROOT, 'templates', 'crew')
const FORBIDDEN = ['.prjct/sessions/', '.prjct/audits/', '.prjct/deploy/', '.prjct/CHECKPOINTS.md']

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full)))
    } else {
      out.push(full)
    }
  }
  return out
}

describe('crew templates: no disk-write instructions', () => {
  test('no template under templates/crew/ references forbidden persistence paths', async () => {
    const files = await collectFiles(CREW_DIR)
    expect(files.length).toBeGreaterThan(0)

    const offenders: Array<{ file: string; needle: string }> = []
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      // Allow the CHECKPOINTS bundled template itself (it is the canonical
      // checkpoints content, not a path instruction). Everything else that
      // mentions a forbidden path is an offender.
      const isCheckpointsBundle = file.endsWith(path.join('crew', 'CHECKPOINTS.md'))
      for (const needle of FORBIDDEN) {
        if (!content.includes(needle)) continue
        if (isCheckpointsBundle && needle === '.prjct/CHECKPOINTS.md') continue
        offenders.push({ file: path.relative(REPO_ROOT, file), needle })
      }
    }

    expect(offenders).toEqual([])
  })

  test('leader templates scope the .prjct/ edit-allowlist to prjct.config.json', async () => {
    // Regression guard for the post-2.23.7 client report: the leader and
    // CLAUDE-leader-mode templates previously said "Edits to `.prjct/`,
    // docs, configuration, or this file itself → you may edit directly"
    // which the leader read as license to write audits/checklists/deploys
    // anywhere under .prjct/. Two invariants every leader template must
    // satisfy:
    //   1. The canonical config file path is named as the allowlist scope.
    //   2. The bad grant phrase "Edits to `.prjct/`," (broad, comma-grouped
    //      with other targets) is gone.
    const targets = [
      path.join(CREW_DIR, 'agents', 'leader.md'),
      path.join(CREW_DIR, 'leader-mode.md'),
    ]
    for (const file of targets) {
      const content = await fs.readFile(file, 'utf-8')
      expect(content).toContain('`.prjct/prjct.config.json`')
      expect(content).not.toContain('Edits to `.prjct/`,')
      expect(content).not.toContain('Edits to `.prjct/`')
    }
  })
})
