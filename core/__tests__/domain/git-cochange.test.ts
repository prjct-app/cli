/**
 * Tests for Git Co-Change Analyzer
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { exec as execCallback } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { buildMatrix, scoreFromSeeds } from '../../domain/git-cochange'

const exec = promisify(execCallback)

describe('GitCoChange', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `prjct-cochange-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })

    // Initialize a git repo
    await exec('git init', { cwd: testDir })
    await exec('git config user.email "test@test.com"', { cwd: testDir })
    await exec('git config user.name "Test"', { cwd: testDir })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('buildMatrix', () => {
    it('should detect co-changed files', async () => {
      // Create files that change together
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(testDir, 'auth.ts'), `export const v${i} = ${i}`)
        await fs.writeFile(path.join(testDir, 'middleware.ts'), `export const v${i} = ${i}`)
        await exec('git add -A', { cwd: testDir })
        await exec(`git commit -m "commit ${i}"`, { cwd: testDir })
      }

      // Create a file that changes independently
      await fs.writeFile(path.join(testDir, 'unrelated.ts'), 'export const x = 1')
      await exec('git add -A', { cwd: testDir })
      await exec('git commit -m "unrelated"', { cwd: testDir })

      const index = await buildMatrix(testDir, 100)

      expect(index.commitsAnalyzed).toBeGreaterThan(0)
      expect(index.matrix['auth.ts']).toBeDefined()
      expect(index.matrix['auth.ts']['middleware.ts']).toBeGreaterThan(0)

      // Auth and middleware should have high co-change
      const similarity = index.matrix['auth.ts']['middleware.ts']
      expect(similarity).toBeGreaterThan(0.5)
    })

    it('should be symmetric', async () => {
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(path.join(testDir, 'a.ts'), `const v${i} = ${i}`)
        await fs.writeFile(path.join(testDir, 'b.ts'), `const v${i} = ${i}`)
        await exec('git add -A', { cwd: testDir })
        await exec(`git commit -m "commit ${i}"`, { cwd: testDir })
      }

      const index = await buildMatrix(testDir, 100)

      if (index.matrix['a.ts'] && index.matrix['b.ts']) {
        expect(index.matrix['a.ts']['b.ts']).toBe(index.matrix['b.ts']['a.ts'])
      }
    })

    it('should handle no git history', async () => {
      const emptyDir = path.join(os.tmpdir(), `prjct-cochange-empty-${Date.now()}`)
      await fs.mkdir(emptyDir, { recursive: true })

      const index = await buildMatrix(emptyDir, 100)
      expect(index.commitsAnalyzed).toBe(0)
      expect(Object.keys(index.matrix)).toHaveLength(0)

      await fs.rm(emptyDir, { recursive: true, force: true })
    })
  })

  describe('scoreFromSeeds', () => {
    it('should score co-changed files', async () => {
      // Create co-change history
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(testDir, 'auth.ts'), `v${i}`)
        await fs.writeFile(path.join(testDir, 'session.ts'), `v${i}`)
        await exec('git add -A', { cwd: testDir })
        await exec(`git commit -m "commit ${i}"`, { cwd: testDir })
      }

      const index = await buildMatrix(testDir, 100)
      const scores = scoreFromSeeds(['auth.ts'], index)

      const sessionScore = scores.find((s) => s.path === 'session.ts')
      expect(sessionScore).toBeDefined()
      expect(sessionScore!.score).toBeGreaterThan(0)
    })

    it('should not include seed files in results', async () => {
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(path.join(testDir, 'a.ts'), `v${i}`)
        await fs.writeFile(path.join(testDir, 'b.ts'), `v${i}`)
        await exec('git add -A', { cwd: testDir })
        await exec(`git commit -m "commit ${i}"`, { cwd: testDir })
      }

      const index = await buildMatrix(testDir, 100)
      const scores = scoreFromSeeds(['a.ts'], index)

      expect(scores.find((s) => s.path === 'a.ts')).toBeUndefined()
    })
  })
})
