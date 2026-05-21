/**
 * Wiki manifest sweep — the contract that closes the `_generated/memory 2/`
 * and `tags 2/` ghost-dir regression.
 *
 * Before the fix: `sweepStaleFiles` only deleted `.md` files. macOS Finder
 * dropped a `.DS_Store` into a duplicate dir; the bottom-up `rmdir()`
 * couldn't prune it because the dir was not technically empty.
 *
 * Lock down:
 *   1. Files NOT in the manifest are deleted regardless of extension.
 *   2. The generator's own state files (.manifest.json, .regen-fingerprint)
 *      survive the sweep so the regen never has to rewrite them.
 *   3. Empty directories left behind after sweep get pruned bottom-up.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sweepStaleFiles } from '../../services/wiki/manifest'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-sweep-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
})

const touch = async (rel: string, body = ''): Promise<void> => {
  const full = path.join(tmpDir, rel)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, body, 'utf-8')
}

const exists = async (rel: string): Promise<boolean> => {
  try {
    await fs.access(path.join(tmpDir, rel))
    return true
  } catch {
    return false
  }
}

describe('sweepStaleFiles — beyond .md', () => {
  it('deletes a .DS_Store that is not in the manifest', async () => {
    await touch('memory/decision.md', 'kept')
    await touch('memory 2/.DS_Store', '')
    const removed = await sweepStaleFiles(tmpDir, { 'memory/decision.md': 'h1' })
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await exists('memory 2/.DS_Store')).toBe(false)
  })

  it('prunes the empty parent dir after sweeping its only file', async () => {
    await touch('memory/decision.md', 'kept')
    await touch('tags 2/.DS_Store', '')
    await sweepStaleFiles(tmpDir, { 'memory/decision.md': 'h1' })
    expect(await exists('tags 2')).toBe(false)
    // The legitimate sibling dir survives
    expect(await exists('memory')).toBe(true)
  })

  it('deletes a stale .json that is not in the manifest', async () => {
    await touch('index.md', 'kept')
    await touch('orphan.json', '{}')
    const removed = await sweepStaleFiles(tmpDir, { 'index.md': 'h1' })
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await exists('orphan.json')).toBe(false)
  })
})

describe('sweepStaleFiles — preserves generator state', () => {
  it('does not delete .manifest.json at the root even when not in the keep set', async () => {
    await touch('.manifest.json', '{"old":"manifest"}')
    await touch('.regen-fingerprint', 'abcd')
    await touch('index.md', 'kept')
    await sweepStaleFiles(tmpDir, { 'index.md': 'h1' })
    expect(await exists('.manifest.json')).toBe(true)
    expect(await exists('.regen-fingerprint')).toBe(true)
  })

  it('still deletes a stale .md alongside preserved state files', async () => {
    await touch('.manifest.json', '{}')
    await touch('stale.md', 'old')
    await sweepStaleFiles(tmpDir, {})
    expect(await exists('.manifest.json')).toBe(true)
    expect(await exists('stale.md')).toBe(false)
  })
})

describe('sweepStaleFiles — manifest hits are kept', () => {
  it('keeps a file whose relative path matches the keep set', async () => {
    await touch('memory/learning.md', 'body')
    await sweepStaleFiles(tmpDir, { 'memory/learning.md': 'h1' })
    expect(await exists('memory/learning.md')).toBe(true)
  })
})
