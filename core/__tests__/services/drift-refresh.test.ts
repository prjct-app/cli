import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { shouldRefreshDrift } from '../../services/drift-refresh'

describe('shouldRefreshDrift', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0
  })

  function tmpHome(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-drift-'))
    dirs.push(d)
    return d
  }

  test('<3 commits → no refresh', () => {
    expect(shouldRefreshDrift(tmpHome(), 0)).toBe(false)
    expect(shouldRefreshDrift(tmpHome(), 2)).toBe(false)
  })

  test('≥3 commits + no stamp → refresh', () => {
    expect(shouldRefreshDrift(tmpHome(), 3)).toBe(true)
  })

  test('≥3 commits + fresh stamp → skip', () => {
    const home = tmpHome()
    const stateDir = path.join(home, 'state')
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(
      path.join(stateDir, 'drift-refresh-last.json'),
      JSON.stringify({ at: Date.now() }),
      'utf-8'
    )
    expect(shouldRefreshDrift(home, 5)).toBe(false)
  })

  test('≥3 commits + stale stamp (>1h) → refresh', () => {
    const home = tmpHome()
    const stateDir = path.join(home, 'state')
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(
      path.join(stateDir, 'drift-refresh-last.json'),
      JSON.stringify({ at: Date.now() - 2 * 60 * 60 * 1000 }),
      'utf-8'
    )
    expect(shouldRefreshDrift(home, 5)).toBe(true)
  })
})
