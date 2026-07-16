import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import {
  getActiveProjectStyle,
  getProjectEvolution,
  persistProjectStyleSnapshot,
  recomputeProjectStyle,
  renderProjectEvolution,
} from '../../services/project-style-evolution'
import { buildProjectStyleSnapshot } from '../../services/project-style-profile'

async function freshProject(): Promise<{ projectPath: string; projectId: string }> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-style-evo-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'style-evo-test',
      version: '1.0.0',
      dependencies: { hono: '4.0.0', zod: '3.0.0' },
      devDependencies: { typescript: '5.0.0', vitest: '2.0.0' },
    }),
    'utf-8'
  )
  await fs.writeFile(path.join(projectPath, 'tsconfig.json'), '{}', 'utf-8')
  await fs.writeFile(path.join(projectPath, 'bun.lock'), '', 'utf-8')
  const projectId = `test-style-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  })
  await pathManager.ensureProjectStructure(projectId)
  return { projectPath, projectId }
}

describe('project-style-evolution', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    ;({ projectPath, projectId } = await freshProject())
  })

  afterEach(async () => {
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('persist + getActive + evolution render', () => {
    const snap = buildProjectStyleSnapshot({
      stats: {
        fileCount: 10,
        version: '1.0.0',
        name: 't',
        ecosystem: 'JavaScript',
        projectType: 'simple',
        languages: ['TypeScript'],
        frameworks: [],
      },
      stack: {
        hasFrontend: false,
        hasBackend: true,
        hasDatabase: false,
        hasDocker: false,
        hasTesting: true,
        frontendType: null,
        frameworks: ['Hono'],
      },
      packageDeps: { hono: '4', zod: '3' },
      commitHash: 'abc1234',
    })
    persistProjectStyleSnapshot(projectId, snap)
    const active = getActiveProjectStyle(projectId)
    expect(active?.id).toBe(snap.id)
    expect(active?.payload.stack.frameworks).toContain('Hono')
    const evo = getProjectEvolution(projectId, 5)
    expect(evo.length).toBe(1)
    const md = renderProjectEvolution(projectId)
    expect(md).toContain('Project evolution')
  })

  test('recomputeProjectStyle on real package.json', async () => {
    const { detectStack, gatherStats, detectCommands } = await import(
      '../../services/sync-analyzer'
    )
    const [stats, stack, commands] = await Promise.all([
      gatherStats(projectPath),
      detectStack(projectPath),
      detectCommands(projectPath),
    ])
    const result = await recomputeProjectStyle({
      projectId,
      projectPath,
      stats,
      stack,
      commands,
      commitHash: 'fff',
      bridgeMemory: false,
    })
    expect(result.isFirst).toBe(true)
    expect(result.snapshot.payload.stack.ecosystem).toBe('JavaScript')
    expect(result.snapshot.payload.stack.languages).toContain('TypeScript')
    // key libs from package.json
    expect(
      result.snapshot.payload.stack.keyLibraries.some((l) =>
        ['Hono', 'Zod', 'Vitest', 'TypeScript'].includes(l)
      )
    ).toBe(true)
    const active = getActiveProjectStyle(projectId)
    expect(active).not.toBeNull()

    // Second recompute without changes → no new history spam (still active)
    const again = await recomputeProjectStyle({
      projectId,
      projectPath,
      stats,
      stack,
      commands,
      commitHash: 'fff',
      bridgeMemory: false,
    })
    expect(again.isFirst).toBe(false)
    expect(again.delta.hasChanges).toBe(false)
    expect(getProjectEvolution(projectId).length).toBe(1)
  })
})
