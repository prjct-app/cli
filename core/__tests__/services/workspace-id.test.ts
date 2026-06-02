/**
 * Workspace identity derivation. Builds a REAL git repo + worktree in a temp
 * dir so the git-common-dir detection runs for real (not mocked), then asserts
 * the identity rules the multi-agent layer relies on: deterministic per
 * worktree, distinct across worktrees, stable from a subdirectory, and the
 * main-worktree sentinel.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { deriveWorkspace, MAIN_WORKSPACE_ID } from '../../services/workspace-id'

const execAsync = promisify(exec)

let root: string
let mainRepo: string
let wtA: string
let wtB: string

beforeAll(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ws-')))
  mainRepo = path.join(root, 'repo')
  await fs.mkdir(mainRepo, { recursive: true })

  const git = (cmd: string, cwd: string) => execAsync(`git ${cmd}`, { cwd })
  await git('init -q', mainRepo)
  await git('config user.email t@t.io', mainRepo)
  await git('config user.name test', mainRepo)
  await fs.writeFile(path.join(mainRepo, 'f.txt'), 'hi')
  await git('add -A', mainRepo)
  await git('commit -q -m init', mainRepo)

  wtA = path.join(root, 'wt-a')
  wtB = path.join(root, 'wt-b')
  await git(`worktree add -q "${wtA}" -b feat-a`, mainRepo)
  await git(`worktree add -q "${wtB}" -b feat-b`, mainRepo)
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true }).catch(() => {})
})

describe('deriveWorkspace', () => {
  test('main worktree → sentinel id, isMain', async () => {
    const ws = await deriveWorkspace(mainRepo)
    expect(ws.workspaceId).toBe(MAIN_WORKSPACE_ID)
    expect(ws.isMain).toBe(true)
    expect(ws.shortId).toBe(MAIN_WORKSPACE_ID)
  })

  test('child worktree → hashed id, not main', async () => {
    const ws = await deriveWorkspace(wtA)
    expect(ws.workspaceId).not.toBe(MAIN_WORKSPACE_ID)
    expect(ws.isMain).toBe(false)
    expect(ws.workspaceId).toHaveLength(16)
    expect(ws.branch).toBe('feat-a')
    expect(ws.label).toContain('feat-a')
  })

  test('deterministic — same worktree, same id', async () => {
    const a1 = await deriveWorkspace(wtA)
    const a2 = await deriveWorkspace(wtA)
    expect(a1.workspaceId).toBe(a2.workspaceId)
  })

  test('distinct worktrees → distinct ids', async () => {
    const a = await deriveWorkspace(wtA)
    const b = await deriveWorkspace(wtB)
    expect(a.workspaceId).not.toBe(b.workspaceId)
  })

  test('subdirectory of a worktree → same id as its root', async () => {
    const sub = path.join(wtA, 'src', 'deep')
    await fs.mkdir(sub, { recursive: true })
    const rootWs = await deriveWorkspace(wtA)
    const subWs = await deriveWorkspace(sub)
    expect(subWs.workspaceId).toBe(rootWs.workspaceId)
    expect(subWs.isMain).toBe(false)
  })

  test('non-git path → main sentinel (degrade, never throw)', async () => {
    const plain = path.join(root, 'not-a-repo')
    await fs.mkdir(plain, { recursive: true })
    const ws = await deriveWorkspace(plain)
    expect(ws.workspaceId).toBe(MAIN_WORKSPACE_ID)
    expect(ws.isMain).toBe(true)
  })
})
