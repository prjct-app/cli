import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { indexProject, queryFiles, updateProjectIndex } from '../../domain/bm25'
import { indexImports, loadGraph, updateImportGraph } from '../../domain/import-graph'
import pathManager from '../../infrastructure/path-manager'
import { detectIncrementalChanges } from '../../services/sync/incremental'
import prjctDb from '../../storage/database'

let projectId: string
let projectPath: string
let originalProjectsDir: string | undefined
let tempProjectsDir: string

beforeEach(async () => {
  prjctDb.close()
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-perf-projects-'))
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-perf-worktree-'))
  originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
  process.env.PRJCT_PROJECTS_DIR = tempProjectsDir
  projectId = `perf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await pathManager.ensureProjectStructure(projectId)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
})

afterEach(async () => {
  if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
  else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
  prjctDb.close()
  await fs.rm(tempProjectsDir, { recursive: true, force: true })
  await fs.rm(projectPath, { recursive: true, force: true })
})

describe('sync incremental performance guards', () => {
  test('BM25 incremental update retokenizes only changed files', async () => {
    await fs.mkdir(path.join(projectPath, 'src'))
    await fs.writeFile(
      path.join(projectPath, 'src', 'alpha.ts'),
      'export function alphaSearchTarget() { return true }\n'
    )
    await fs.writeFile(
      path.join(projectPath, 'src', 'beta.ts'),
      'export function betaBaseline() { return true }\n'
    )

    await indexProject(projectPath, projectId)
    await fs.writeFile(
      path.join(projectPath, 'src', 'beta.ts'),
      'export function betaTelemetryCache() { return true }\n'
    )

    const readSpy = spyOn(fs, 'readFile')
    await updateProjectIndex(projectPath, projectId, [path.join('src', 'beta.ts')])

    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(String(readSpy.mock.calls[0]?.[0])).toEndWith(path.join('src', 'beta.ts'))
    expect(queryFiles(projectId, 'telemetry cache')[0]?.path).toBe(path.join('src', 'beta.ts'))
    readSpy.mockRestore()
  })

  test('import graph incremental update reparses changed edges without stale reverse links', async () => {
    await fs.mkdir(path.join(projectPath, 'src'))
    await fs.writeFile(path.join(projectPath, 'src', 'a.ts'), "import { b } from './b'\n")
    await fs.writeFile(path.join(projectPath, 'src', 'b.ts'), 'export const b = 1\n')
    await fs.writeFile(path.join(projectPath, 'src', 'c.ts'), 'export const c = 1\n')

    await indexImports(projectPath, projectId)
    await fs.writeFile(path.join(projectPath, 'src', 'a.ts'), "import { c } from './c'\n")

    const readSpy = spyOn(fs, 'readFile')
    const graph = await updateImportGraph(projectPath, projectId, [path.join('src', 'a.ts')])

    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(String(readSpy.mock.calls[0]?.[0])).toEndWith(path.join('src', 'a.ts'))
    expect(graph.forward[path.join('src', 'a.ts')]).toEqual([path.join('src', 'c.ts')])
    expect(graph.reverse[path.join('src', 'b.ts')]).toBeUndefined()
    expect(graph.reverse[path.join('src', 'c.ts')]).toContain(path.join('src', 'a.ts'))
    expect(loadGraph(projectId)?.forward[path.join('src', 'a.ts')]).toEqual([
      path.join('src', 'c.ts'),
    ])
    readSpy.mockRestore()
  })

  test('import graph incremental update removes deleted target edges from importers and storage', async () => {
    await fs.mkdir(path.join(projectPath, 'src'))
    await fs.writeFile(path.join(projectPath, 'src', 'a.ts'), "import { b } from './b'\n")
    await fs.writeFile(path.join(projectPath, 'src', 'b.ts'), 'export const b = 1\n')

    await indexImports(projectPath, projectId)
    await fs.rm(path.join(projectPath, 'src', 'b.ts'))

    const graph = await updateImportGraph(projectPath, projectId, [], [path.join('src', 'b.ts')])

    expect(graph.forward[path.join('src', 'a.ts')]).toBeUndefined()
    expect(graph.reverse[path.join('src', 'b.ts')]).toBeUndefined()
    expect(loadGraph(projectId)?.forward[path.join('src', 'a.ts')]).toBeUndefined()
    expect(loadGraph(projectId)?.reverse[path.join('src', 'b.ts')]).toBeUndefined()
  })

  test('no-change incremental detection reuses stored checksums without reading file contents', async () => {
    await fs.mkdir(path.join(projectPath, 'src'))
    for (let i = 0; i < 20; i++) {
      await fs.writeFile(
        path.join(projectPath, 'src', `file-${i}.ts`),
        `export const v${i} = ${i}\n`
      )
    }

    await detectIncrementalChanges({
      projectId,
      projectPath,
      isFullSync: false,
      changedFilesHint: undefined,
    })

    const readSpy = spyOn(fs, 'readFile')
    const result = await detectIncrementalChanges({
      projectId,
      projectPath,
      isFullSync: false,
      changedFilesHint: undefined,
    })

    expect(result.incrementalInfo?.filesChanged).toBe(0)
    expect(result.shouldRebuildIndexes).toBe(false)
    expect(readSpy).not.toHaveBeenCalled()
    readSpy.mockRestore()
  })
})
