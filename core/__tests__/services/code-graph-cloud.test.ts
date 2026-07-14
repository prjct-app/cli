import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { indexSymbols } from '../../domain/symbol-graph'
import pathManager from '../../infrastructure/path-manager'
import { buildCloudCodeGraphSnapshot, isUploadableGraph } from '../../services/code-graph-cloud'
import prjctDb from '../../storage/database'

describe('code-graph-cloud compact structural snapshot', () => {
  let testDir: string
  let testProjectId: string
  let sourceDir: string
  const originalGet = pathManager.getGlobalProjectPath.bind(pathManager)

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `prjct-cloud-graph-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    sourceDir = path.join(testDir, 'src-repo')
    testProjectId = `test-cloud-graph-${Date.now()}`
    await fs.mkdir(path.join(sourceDir, 'src'), { recursive: true })
    pathManager.getGlobalProjectPath = (id: string) => path.join(testDir, 'projects', id)

    await fs.writeFile(
      path.join(sourceDir, 'src', 'svc.ts'),
      `
export class Service {
  run() {
    return helper()
  }
}
export function helper() {
  return 1
}
export function unused() {
  return 2
}
`
    )
    await fs.writeFile(
      path.join(sourceDir, 'src', 'main.ts'),
      `
import { Service } from './svc'
export function main() {
  const s = new Service()
  return s.run()
}
`
    )
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGet
    try {
      prjctDb.close(testProjectId)
    } catch {
      /* ok */
    }
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('builds Function/Class/File nodes with structural edges (not knowledge)', async () => {
    await indexSymbols(sourceDir, testProjectId)
    const snap = buildCloudCodeGraphSnapshot(testProjectId)
    expect(isUploadableGraph(snap)).toBe(true)
    expect(snap!.version).toBe(1)
    expect(snap!.nodes.length).toBeGreaterThan(0)

    const kinds = new Set(snap!.nodes.map((n) => n.kind))
    // Must be structural kinds only
    for (const k of kinds) {
      expect([
        'Function',
        'Method',
        'Class',
        'Interface',
        'Type',
        'Enum',
        'Const',
        'Route',
        'File',
        'Symbol',
      ]).toContain(k)
    }
    expect(kinds.has('Function') || kinds.has('Class') || kinds.has('Method')).toBe(true)

    // No contribution/knowledge fake hubs
    expect(snap!.nodes.every((n) => n.kind !== 'knowledge' && n.kind !== 'project')).toBe(true)

    const types = new Set(snap!.links.map((l) => l.type))
    // At least DEFINES (file→symbol) or CALLS/IMPORTS when resolvable
    expect(types.size).toBeGreaterThan(0)
    for (const t of types) {
      expect(['CALLS', 'IMPORTS', 'DEFINES', 'HANDLES', 'TESTS']).toContain(t)
    }
  })

  it('returns null without symbol index', () => {
    expect(buildCloudCodeGraphSnapshot('no-such-project-xyz')).toBeNull()
  })

  it('respects maxNodes cap', async () => {
    await indexSymbols(sourceDir, testProjectId)
    const snap = buildCloudCodeGraphSnapshot(testProjectId, { maxNodes: 3, maxLinks: 20 })
    expect(snap).not.toBeNull()
    // File nodes are extra on top of picked symbols — total can be slightly over maxNodes
    // but should stay bounded (picked ≤ 3 + file hubs ≤ 3)
    expect(snap!.nodes.length).toBeLessThanOrEqual(10)
  })
})
