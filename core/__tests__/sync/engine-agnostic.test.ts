/**
 * Engine-agnostic guard (HARD RULE).
 *
 * The open-source CLI must reveal NOTHING about how the cloud stores data —
 * it knows only "a storage API at api.prjct.app". This test fails CI if any
 * backend-engine name leaks into the sync/cloud subsystem, so a future change
 * can't quietly couple the client to a specific backend. The backend lives in
 * a separate repo.
 *
 * Scope is the cloud client surface (`core/sync/**` + `core/commands/cloud.ts`),
 * NOT the whole repo: elsewhere these words legitimately appear as domain
 * examples (describing a USER's project), a "PostgreSQL UUID format" comment,
 * and the third-party MCP registry (`mcp-service.ts`) — none of which is our
 * cloud backend.
 */

import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const FORBIDDEN = /@supabase|supabase|postgres|railway|\bstripe\b/i

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      out.push(...tsFilesUnder(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('engine-agnostic cloud client', () => {
  const root = path.resolve(__dirname, '../..')
  const targets = [
    ...tsFilesUnder(path.join(root, 'sync')),
    path.join(root, 'commands', 'cloud.ts'),
  ]

  it('mentions no backend engine in core/sync/** or cloud.ts', () => {
    const offenders: string[] = []
    for (const file of targets) {
      const content = fs.readFileSync(file, 'utf-8')
      content.split('\n').forEach((line, i) => {
        if (FORBIDDEN.test(line))
          offenders.push(`${path.relative(root, file)}:${i + 1}  ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('actually scanned the cloud client files (guard is wired)', () => {
    expect(targets.length).toBeGreaterThan(5)
    expect(targets.some((f) => f.endsWith('sync-client.ts'))).toBe(true)
    expect(targets.some((f) => f.endsWith('cloud.ts'))).toBe(true)
  })
})
