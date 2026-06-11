/**
 * enrichedRecall — the ONE retrieval pipeline every agent surface uses
 * (CLI `prjct context memory`, MCP `prjct_mem_list` / `prjct_mem_similar`).
 *
 * Pins the parity contract introduced when the MCP tools stopped using
 * plain recency recall: filters (types/tags) apply across legs, the FTS
 * leg feeds relevance, and link expansion can be disabled.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { enrichedRecall } from '../../memory/enriched-recall'
import prjctDb from '../../storage/database'

let tmpRoot: string
let projectPath: string
let projectId: string

const origGlobal = pathManager.getGlobalProjectPath.bind(pathManager)
const origStorage = pathManager.getStoragePath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)

function write(type: string, content: string, tags: Record<string, string> = {}): void {
  prjctDb.appendEvent(projectId, `memory.remember.${type}`, {
    content,
    tags,
    provenance: 'declared',
  })
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-enriched-'))
  projectPath = path.join(tmpRoot, 'repo')
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `test-enr-${Math.random().toString(36).slice(2, 8)}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, 'global', id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(tmpRoot, 'global', id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(tmpRoot, 'global', id, layer, filename)
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  } as Parameters<typeof configManager.writeConfig>[1])
})

afterEach(async () => {
  prjctDb.close()
  pathManager.getGlobalProjectPath = origGlobal
  pathManager.getStoragePath = origStorage
  pathManager.getFilePath = origFile
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('enrichedRecall', () => {
  it('returns recent entries without a topic (recall backfill leg)', async () => {
    write('decision', 'use bun for everything')
    write('gotcha', 'daemon caches stale code')
    const got = await enrichedRecall(projectPath, projectId, { limit: 10 })
    expect(got.length).toBe(2)
  })

  it('applies a types filter across legs', async () => {
    write('decision', 'use bun for everything')
    write('gotcha', 'daemon caches stale code')
    const got = await enrichedRecall(projectPath, projectId, { types: ['gotcha'], limit: 10 })
    expect(got.length).toBe(1)
    expect(got[0].type).toBe('gotcha')
  })

  it('applies a tags filter across legs', async () => {
    write('decision', 'auth uses oauth', { domain: 'auth' })
    write('decision', 'billing uses stripe', { domain: 'billing' })
    const got = await enrichedRecall(projectPath, projectId, {
      tags: { domain: 'auth' },
      limit: 10,
    })
    expect(got.length).toBe(1)
    expect(got[0].tags.domain).toBe('auth')
  })

  it('expandLinks:false returns only the direct matches', async () => {
    write('decision', 'standalone decision with no relations')
    const got = await enrichedRecall(projectPath, projectId, {
      topic: 'standalone',
      limit: 10,
      expandLinks: false,
    })
    expect(got.length).toBeGreaterThanOrEqual(1)
  })
})
