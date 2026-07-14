import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { indexSymbols } from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import { findDeadCode } from '../../services/dead-code'
import prjctDb from '../../storage/database'

describe('dead-code', () => {
  let testDir: string
  let testProjectId: string
  const original = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `prjct-dead-${Date.now()}`)
    testProjectId = `test-dead-${Date.now()}`
    await fs.mkdir(testDir, { recursive: true })
    pathManager.getGlobalProjectPath = () => testDir
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = original
    prjctDb.close()
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('flags uncalled functions and skips entry main', async () => {
    await fs.writeFile(
      path.join(testDir, 'lib.ts'),
      `export function used() { return 1 }\nexport function orphan() { return 2 }\n`
    )
    await fs.writeFile(
      path.join(testDir, 'main.ts'),
      `import { used } from './lib'\nexport function main() { return used() }\n`
    )
    await indexSymbols(testDir, testProjectId)
    const r = findDeadCode(testProjectId, { limit: 20 })
    expect(r.ready).toBe(true)
    const names = r.dead.map((d) => d.symbol.name)
    expect(names).toContain('orphan')
    // main is entry — not dead
    expect(names).not.toContain('main')
    // used has inbound CALLS from main
    expect(names).not.toContain('used')
  })
})
