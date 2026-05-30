/**
 * Architecture guard: every SQLite connection must go through the single
 * factory in core/storage/database/sqlite-compat.ts.
 *
 * That factory (`openDatabase`) bakes in the daemon-safety PRAGMAs on every
 * connection:
 *   - journal_mode = WAL   — concurrent reads + single writer
 *   - busy_timeout = 5000  — wait on lock contention instead of failing with
 *                            SQLITE_BUSY when the daemon holds an overlapping
 *                            connection
 *
 * A raw `new Database(...)` / `require('bun:sqlite')` / `require('node:sqlite')`
 * anywhere else opens a connection WITHOUT those pragmas, silently
 * reintroducing the HIGH-severity daemon-vs-CLI write-lock contention bug.
 * This test fails fast if any file under core/ or bin/ acquires a SQLite
 * driver or instantiates a connection outside the sanctioned factory.
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const SCAN_DIRS = ['core', 'bin']

// The only file allowed to touch a raw SQLite driver is the factory itself.
// This guard test is also allowlisted: it necessarily contains the forbidden
// patterns (as regexes / prose) and would otherwise flag itself.
const ALLOWLIST = new Set(
  [
    'core/storage/database/sqlite-compat.ts',
    'core/__tests__/storage/sqlite-factory-guard.test.ts',
  ].map((p) => path.normalize(p))
)

/**
 * Patterns that indicate a SQLite driver is being acquired or instantiated
 * directly. Deliberately tight so comments/strings that merely mention a
 * driver name (e.g. stack-detector's package list, doc comments) do NOT match.
 */
const FORBIDDEN: Array<{ label: string; re: RegExp }> = [
  { label: "require('bun:sqlite')", re: /require\(\s*['"]bun:sqlite['"]\s*\)/ },
  { label: "require('node:sqlite')", re: /require\(\s*['"]node:sqlite['"]\s*\)/ },
  { label: "require('better-sqlite3')", re: /require\(\s*['"]better-sqlite3['"]\s*\)/ },
  { label: "import from 'bun:sqlite'", re: /from\s+['"]bun:sqlite['"]/ },
  { label: "import from 'node:sqlite'", re: /from\s+['"]node:sqlite['"]/ },
  { label: "import from 'better-sqlite3'", re: /from\s+['"]better-sqlite3['"]/ },
  { label: 'new Database(', re: /\bnew\s+Database\s*\(/ },
]

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      out.push(...(await collectTsFiles(full)))
    } else if (entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('sqlite factory guard', () => {
  test('no SQLite driver is acquired/instantiated outside sqlite-compat.ts', async () => {
    const files: string[] = []
    for (const d of SCAN_DIRS) {
      files.push(...(await collectTsFiles(path.join(REPO_ROOT, d))))
    }
    expect(files.length).toBeGreaterThan(0)

    const offenders: Array<{ file: string; pattern: string }> = []
    for (const file of files) {
      const rel = path.normalize(path.relative(REPO_ROOT, file))
      if (ALLOWLIST.has(rel)) continue
      const content = await fs.readFile(file, 'utf-8')
      for (const { label, re } of FORBIDDEN) {
        if (re.test(content)) {
          offenders.push({ file: rel, pattern: label })
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test('the sanctioned factory still sets WAL + busy_timeout', async () => {
    const factory = await fs.readFile(
      path.join(REPO_ROOT, 'core/storage/database/sqlite-compat.ts'),
      'utf-8'
    )
    expect(factory).toMatch(/PRAGMA\s+journal_mode\s*=\s*WAL/i)
    expect(factory).toMatch(/PRAGMA\s+busy_timeout\s*=\s*5000/i)
  })
})
