/**
 * ContextCheckpointCommands — save / restore round-trip tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ContextCheckpointCommands } from '../../commands/context-checkpoint'
import pathManager from '../../infrastructure/path-manager'
import { execFileAsync } from '../../utils/exec'

let dir: string
let globalDir: string
let projectId: string
const cmd = new ContextCheckpointCommands()

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ctx-test-'))
  globalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ctx-global-'))
  projectId = `ctx-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  pathManager.getGlobalProjectPath = (id: string) => path.join(globalDir, id)

  await fs.mkdir(path.join(dir, '.prjct'), { recursive: true })
  // configManager.validateConfig() requires both projectId AND dataPath
  // — without dataPath, ensureProjectInit() reruns the full init flow
  // and overwrites our test projectId.
  await fs.writeFile(
    path.join(dir, '.prjct/prjct.config.json'),
    JSON.stringify({ projectId, dataPath: path.join(globalDir, projectId) })
  )

  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.email', 't@example.com'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: dir })
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir })
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  await fs.rm(globalDir, { recursive: true, force: true }).catch(() => {})
})

describe('prjct context-save / restore', () => {
  it('save writes a JSON checkpoint and reports the filename', async () => {
    const result = await cmd.save('refactor auth flow', dir, { md: true, notes: 'pause point' })
    expect(result.success).toBe(true)
    expect(typeof result.file).toBe('string')
    expect(result.file).toMatch(/refactor-auth-flow\.json$/)

    const ckptDir = path.join(globalDir, projectId, 'checkpoints')
    const files = await fs.readdir(ckptDir)
    expect(files.length).toBe(1)
    const raw = await fs.readFile(path.join(ckptDir, files[0]!), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.title).toBe('refactor auth flow')
    expect(parsed.notes).toBe('pause point')
    expect(parsed.git.branch).toBe('main')
  })

  it('reports "no checkpoints" when restore runs against an empty store', async () => {
    const r = await cmd.restore(null, dir, { md: false })
    expect(r.success).toBe(true)
    expect(r.checkpoint).toBeNull()
  })

  it('round-trips: save twice, restore returns the newer one by default', async () => {
    await cmd.save('first', dir, {})
    await new Promise((r) => setTimeout(r, 1100)) // filenames carry seconds; bump past
    await cmd.save('second', dir, {})

    const r = await cmd.restore(null, dir, { md: false })
    expect(r.success).toBe(true)
    expect((r.checkpoint as { title: string }).title).toBe('second')
  })

  it('--list mode emits all checkpoint filenames', async () => {
    await cmd.save('one', dir, {})
    await new Promise((r) => setTimeout(r, 1100))
    await cmd.save('two', dir, {})
    const r = await cmd.restore(null, dir, { md: false, list: true })
    expect(r.success).toBe(true)
    expect(r.files).toBe(2)
  })

  it('captures git status with uncommitted changes', async () => {
    await fs.writeFile(path.join(dir, 'foo.txt'), 'hi')
    const r = await cmd.save('with-uncommitted', dir, {})
    expect(r.success).toBe(true)
    const r2 = await cmd.restore(null, dir, { md: false })
    const ckpt = r2.checkpoint as { git: { statusShort: string[] } }
    expect(ckpt.git.statusShort.some((l) => l.includes('foo.txt'))).toBe(true)
  })
})
