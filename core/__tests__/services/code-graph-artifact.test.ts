import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { hasSymbolIndex, indexSymbols, listAllSymbols } from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import {
  exportCodeGraphArtifact,
  importCodeGraphArtifact,
} from '../../services/code-graph-artifact'
import prjctDb from '../../storage/database'

describe('code-graph-artifact', () => {
  let testDir: string
  let testProjectId: string
  const original = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `prjct-artifact-${Date.now()}`)
    testProjectId = `test-artifact-${Date.now()}`
    await fs.mkdir(testDir, { recursive: true })
    pathManager.getGlobalProjectPath = () => testDir
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = original
    prjctDb.close()
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('exports and re-imports symbols', async () => {
    await fs.writeFile(
      path.join(testDir, 'svc.ts'),
      `export function doWork() { return 1 }\nexport class Svc {}\n`
    )
    await indexSymbols(testDir, testProjectId)
    const before = listAllSymbols(testProjectId).length
    expect(before).toBeGreaterThan(0)

    const exp = await exportCodeGraphArtifact(testDir, testProjectId)
    expect(exp).not.toBeNull()
    expect(exp!.bytes).toBeGreaterThan(20)

    // Wipe index
    prjctDb.transaction(testProjectId, (db) => {
      db.prepare('DELETE FROM code_symbols').run()
      db.prepare('DELETE FROM code_symbol_edges').run()
    })
    expect(hasSymbolIndex(testProjectId)).toBe(false)

    const imp = await importCodeGraphArtifact(testDir, testProjectId)
    expect(imp.imported).toBe(true)
    expect(listAllSymbols(testProjectId).length).toBe(before)
  })
})
