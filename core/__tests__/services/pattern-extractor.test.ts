import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import patternExtractor from '../../services/pattern-extractor'
import { prjctDb } from '../../storage/database'

let tmpRoot: string | null = null
let projectPath: string
const projectId = 'pattern-extractor-test'
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('patternExtractor', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-patterns-'))
    projectPath = path.join(tmpRoot, 'repo')
    await fs.mkdir(projectPath, { recursive: true })

    pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot!, id)
  })

  afterEach(async () => {
    prjctDb.close(projectId)
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  it('extracts context7 + feedback patterns and stores rules', async () => {
    const result = await patternExtractor.extract({
      projectId,
      projectPath,
      languages: ['TypeScript'],
      frameworks: ['Next.js'],
      context7Verified: true,
      feedback: {
        patternsDiscovered: ['Use UiButton'],
        knownGotchas: ['Avoid direct DOM mutation'],
      },
    })

    expect(result.patterns.length).toBeGreaterThan(0)
    expect(result.antiPatterns.length).toBeGreaterThan(0)
    expect(result.patterns.some((p) => p.source === 'context7')).toBe(true)
    expect(result.patterns.some((p) => p.source === 'feedback')).toBe(true)
    expect(result.antiPatterns.some((a) => a.source === 'feedback')).toBe(true)

    // The rules flow through the RETURN into the analysis draft; the old
    // write-only `analysis:derived-rules:<hash>` kv row must NOT come back
    // (zero readers — migration 55 swept the accumulated ones).
    const saved = prjctDb.getDoc(projectId, `analysis:derived-rules:${result.repoPathHash}`)
    expect(saved).toBeNull()
  })

  it('returns empty patterns when no feedback or context7', async () => {
    const result = await patternExtractor.extract({
      projectId,
      projectPath,
      languages: ['TypeScript'],
      frameworks: ['Next.js'],
      context7Verified: false,
    })

    expect(result.patterns).toEqual([])
    expect(result.antiPatterns).toEqual([])
  })
})
