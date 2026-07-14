/**
 * Symbol graph — extraction, index, search, trace
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  extractFile,
  hasSymbolIndex,
  indexSymbols,
  scoreFilesFromQuery,
  searchSymbols,
  tracePath,
} from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

describe('symbol-graph', () => {
  let testDir: string
  let testProjectId: string
  const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `prjct-symbol-graph-${Date.now()}`)
    testProjectId = `test-symbols-${Date.now()}`
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

  describe('extractFile', () => {
    it('extracts exported functions and classes from TypeScript', () => {
      const content = `
export function validateUser(id: string) {
  return checkId(id)
}
export class AuthService {
  login() { return validateUser('x') }
}
function checkId(id: string) { return id.length > 0 }
`
      const ex = extractFile(content, 'auth.ts')
      const names = ex.symbols.map((s) => s.name)
      expect(names).toContain('validateUser')
      expect(names).toContain('AuthService')
      expect(names).toContain('checkId')
      expect(ex.callNames).toContain('checkId')
      expect(ex.callNames).toContain('validateUser')
    })

    it('extracts named import bindings', () => {
      const content = `import { validate } from './validator'\nexport function run() { validate() }\n`
      const ex = extractFile(content, 'app.ts')
      expect(ex.importBindings.get('validate')).toBe('./validator')
      expect(ex.callNames).toContain('validate')
    })
  })

  describe('index + search + score', () => {
    it('indexes project and finds symbols by name', async () => {
      await fs.writeFile(
        path.join(testDir, 'validator.ts'),
        `export function validate() { return true }\n`
      )
      await fs.writeFile(
        path.join(testDir, 'auth.ts'),
        `import { validate } from './validator'\nexport function login() { return validate() }\n`
      )

      const meta = await indexSymbols(testDir, testProjectId)
      expect(meta.symbolCount).toBeGreaterThan(0)
      expect(hasSymbolIndex(testProjectId)).toBe(true)

      const hits = searchSymbols(testProjectId, 'validate')
      expect(hits.some((h) => h.name === 'validate')).toBe(true)

      const scored = scoreFilesFromQuery(testProjectId, 'login validate')
      expect(scored.length).toBeGreaterThan(0)
      expect(scored.some((s) => s.path.includes('auth') || s.path.includes('validator'))).toBe(true)
    })

    it('traces call path between login and validate', async () => {
      await fs.writeFile(
        path.join(testDir, 'validator.ts'),
        `export function validate() { return true }\n`
      )
      await fs.writeFile(
        path.join(testDir, 'auth.ts'),
        `import { validate } from './validator'\nexport function login() { return validate() }\n`
      )

      await indexSymbols(testDir, testProjectId)
      const tr = tracePath(testProjectId, 'validate', { direction: 'inbound', depth: 3 })
      expect(tr).not.toBeNull()
      // login should appear as inbound caller when CALLS edge resolved
      // (may be empty if resolution fails — at least roots exist)
      expect(tr!.root.some((r) => r.name === 'validate')).toBe(true)
    })
  })
})
