/**
 * Architecture guard: shipped crew templates must not instruct subagents to
 * write reports into the customer's working tree.
 *
 * A real customer reported `.prjct/sessions/<task>/<role>.md` files dirtying
 * their repo because the crew templates told the leader/implementer/reviewer
 * to persist output there. The product invariant is: SQLite + regenerated
 * vault are the only allowed persistence surfaces. This test fails fast if
 * any template under templates/crew/ reintroduces the pattern.
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const CREW_DIR = path.join(REPO_ROOT, 'templates', 'crew')
const FORBIDDEN = ['.prjct/sessions/']

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
      for (const needle of FORBIDDEN) {
        if (content.includes(needle)) {
          offenders.push({ file: path.relative(REPO_ROOT, file), needle })
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
