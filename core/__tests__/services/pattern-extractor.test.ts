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

  it('extracts baseline + repo anti-patterns and stores isolated rules', async () => {
    await fs.writeFile(
      path.join(projectPath, 'component.tsx'),
      "import Image from 'next/image'\nexport function C(){ const value:any = 1; return <img src='/x' /> }"
    )

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
    expect(result.antiPatterns.some((a) => a.issue.toLowerCase().includes('any'))).toBe(true)
    expect(result.patterns.some((p) => p.source === 'context7')).toBe(true)

    const saved = prjctDb.getDoc<{
      repoPathHash: string
      patterns: Array<{ source: string }>
      antiPatterns: Array<{ source: string }>
    }>(projectId, `analysis:derived-rules:${result.repoPathHash}`)

    expect(saved).not.toBeNull()
    expect(saved?.repoPathHash).toBe(result.repoPathHash)
    expect(saved?.patterns.length).toBeGreaterThan(0)
    expect(saved?.antiPatterns.length).toBeGreaterThan(0)
  })
})
