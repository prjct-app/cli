import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { hasSymbolIndex, indexSymbols, listAllSymbols } from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import {
  artifactPath,
  exportCodeGraphArtifact,
  importCodeGraphArtifact,
} from '../../services/code-graph-artifact'
import prjctDb from '../../storage/database'

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

describe('code-graph-artifact', () => {
  let testDir: string
  let testProjectId: string
  let sourceDir: string
  const originalGet = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `prjct-artifact-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    sourceDir = path.join(testDir, 'src-repo')
    testProjectId = `test-artifact-${Date.now()}`
    await fs.mkdir(sourceDir, { recursive: true })
    // Project storage (where artifact MUST live) separate from client source
    pathManager.getGlobalProjectPath = (id: string) => path.join(testDir, 'projects', id)
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGet
    prjctDb.close()
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('exports under projects/<id>/ — never into client source tree', async () => {
    await fs.writeFile(
      path.join(sourceDir, 'svc.ts'),
      `export function doWork() { return 1 }\nexport class Svc {}\n`
    )
    await indexSymbols(sourceDir, testProjectId)
    const before = listAllSymbols(testProjectId).length
    expect(before).toBeGreaterThan(0)

    const exp = await exportCodeGraphArtifact(testProjectId)
    expect(exp).not.toBeNull()
    expect(exp!.bytes).toBeGreaterThan(20)
    expect(exp!.path).toBe(artifactPath(testProjectId))
    // Must NOT appear under the client source tree
    expect(await exists(path.join(sourceDir, 'code-graph.json.gz'))).toBe(false)
    expect(await exists(path.join(sourceDir, '.prjct', 'code-graph.json.gz'))).toBe(false)
    // Must exist under project storage
    expect(await exists(artifactPath(testProjectId))).toBe(true)
    // Path must not be under sourceDir
    expect(exp!.path.startsWith(sourceDir)).toBe(false)
    expect(exp!.path.includes(path.join('projects', testProjectId))).toBe(true)

    // Wipe SQLite index
    prjctDb.transaction(testProjectId, (db) => {
      db.prepare('DELETE FROM code_symbols').run()
      db.prepare('DELETE FROM code_symbol_edges').run()
    })
    expect(hasSymbolIndex(testProjectId)).toBe(false)

    const imp = await importCodeGraphArtifact(testProjectId)
    expect(imp.imported).toBe(true)
    expect(listAllSymbols(testProjectId).length).toBe(before)
  })

  it('refuses restore when artifact projectId mismatches', async () => {
    await fs.writeFile(path.join(sourceDir, 'svc.ts'), `export function doWork() { return 1 }\n`)
    const meta = await indexSymbols(sourceDir, testProjectId)
    expect(meta.symbolCount).toBeGreaterThan(0)
    expect(hasSymbolIndex(testProjectId)).toBe(true)

    const exp = await exportCodeGraphArtifact(testProjectId)
    expect(exp).not.toBeNull()
    expect(await exists(artifactPath(testProjectId))).toBe(true)

    const otherId = `${testProjectId}-other`
    await fs.mkdir(path.dirname(artifactPath(otherId)), { recursive: true })
    await fs.copyFile(artifactPath(testProjectId), artifactPath(otherId))
    const imp = await importCodeGraphArtifact(otherId)
    expect(imp.imported).toBe(false)
    expect(imp.reason).toMatch(/mismatch/)
  })
})
