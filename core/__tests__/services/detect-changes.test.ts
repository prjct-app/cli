/**
 * detect_changes — risk classification + blast radius
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { indexImports } from '../../domain/import-graph'
import { indexSymbols } from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import { detectChanges } from '../../services/detect-changes'
import prjctDb from '../../storage/database'

describe('detect-changes', () => {
  let testDir: string
  let testProjectId: string
  const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `prjct-detect-changes-${Date.now()}`)
    testProjectId = `test-detect-${Date.now()}`
    await fs.mkdir(testDir, { recursive: true })
    pathManager.getGlobalProjectPath = () => testDir
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    prjctDb.close()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('classifies explicit changed files with import blast radius', async () => {
    await fs.writeFile(path.join(testDir, 'core.ts'), `export function core() {}\n`)
    await fs.writeFile(
      path.join(testDir, 'app.ts'),
      `import { core } from './core'\nexport function app() { return core() }\n`
    )
    await indexImports(testDir, testProjectId)
    await indexSymbols(testDir, testProjectId)

    const result = await detectChanges(testDir, testProjectId, {
      files: ['core.ts'],
    })

    expect(result.changedFiles).toEqual(['core.ts'])
    expect(result.affectedFiles).toContain('core.ts')
    // app imports core → in blast radius
    expect(result.affectedFiles).toContain('app.ts')
    expect(result.changes[0]?.file).toBe('core.ts')
    expect(['critical', 'high', 'medium', 'low']).toContain(result.changes[0]!.risk)
  })

  it('flags auth path as elevated risk', async () => {
    await fs.mkdir(path.join(testDir, 'auth'), { recursive: true })
    await fs.writeFile(path.join(testDir, 'auth', 'login.ts'), `export function login() {}\n`)
    await indexSymbols(testDir, testProjectId)

    const result = await detectChanges(testDir, testProjectId, {
      files: ['auth/login.ts'],
    })
    expect(result.changes[0]?.risk).toBe('critical')
    expect(result.summary.critical).toBe(1)
  })
})
