/**
 * cloud-registry — the small durable list of linked projects the daemon reads
 * on boot (instead of scanning thousands of project dirs).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import {
  addLinkedProject,
  listLinkedProjects,
  removeLinkedProject,
} from '../../sync/cloud-registry'

let tempHome: string
let originalBase: string

describe('cloud-registry', () => {
  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cloud-reg-'))
    // getStatePath() reads globalBaseDir at access time, so point it at a temp
    // dir per test and restore after (the registry file lives under <base>/state).
    originalBase = pathManager.getGlobalBasePath()
    pathManager.setGlobalBaseDir(tempHome)
  })

  afterEach(async () => {
    pathManager.setGlobalBaseDir(originalBase)
    await fs.rm(tempHome, { recursive: true, force: true })
  })

  test('empty by default', async () => {
    expect(await listLinkedProjects()).toEqual([])
  })

  test('add → list → remove round-trips', async () => {
    await addLinkedProject('p1', '/repo/one')
    await addLinkedProject('p2', '/repo/two')
    let list = await listLinkedProjects()
    expect(list.map((p) => p.projectId).sort()).toEqual(['p1', 'p2'])

    await removeLinkedProject('p1')
    list = await listLinkedProjects()
    expect(list).toEqual([{ projectId: 'p2', projectPath: '/repo/two' }])
  })

  test('add is idempotent on projectId (no duplicates)', async () => {
    await addLinkedProject('p1', '/repo/one')
    await addLinkedProject('p1', '/repo/one-moved')
    const list = await listLinkedProjects()
    expect(list.length).toBe(1)
    expect(list[0].projectPath).toBe('/repo/one-moved')
  })
})
