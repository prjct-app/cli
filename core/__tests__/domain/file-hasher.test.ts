import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { computeHashes, diffHashes } from '../../domain/file-hasher'
import type { FileHash } from '../../types/domain.js'

describe('file-hasher', () => {
  // diffHashes

  describe('diffHashes', () => {
    const makeHash = (filePath: string, hash: string): FileHash => ({
      path: filePath,
      hash,
      size: 100,
      mtime: '2026-01-01T00:00:00.000Z',
    })

    test('detects added files', () => {
      const current = new Map<string, FileHash>([
        ['src/new-file.ts', makeHash('src/new-file.ts', 'xxh64:abc')],
        ['src/existing.ts', makeHash('src/existing.ts', 'xxh64:def')],
      ])
      const stored = new Map<string, FileHash>([
        ['src/existing.ts', makeHash('src/existing.ts', 'xxh64:def')],
      ])

      const diff = diffHashes(current, stored)
      expect(diff.added).toEqual(['src/new-file.ts'])
      expect(diff.modified).toEqual([])
      expect(diff.unchanged).toEqual(['src/existing.ts'])
      expect(diff.deleted).toEqual([])
    })

    test('detects modified files', () => {
      const current = new Map<string, FileHash>([
        ['src/changed.ts', makeHash('src/changed.ts', 'xxh64:new-hash')],
      ])
      const stored = new Map<string, FileHash>([
        ['src/changed.ts', makeHash('src/changed.ts', 'xxh64:old-hash')],
      ])

      const diff = diffHashes(current, stored)
      expect(diff.added).toEqual([])
      expect(diff.modified).toEqual(['src/changed.ts'])
      expect(diff.unchanged).toEqual([])
      expect(diff.deleted).toEqual([])
    })

    test('detects deleted files', () => {
      const current = new Map<string, FileHash>()
      const stored = new Map<string, FileHash>([
        ['src/removed.ts', makeHash('src/removed.ts', 'xxh64:abc')],
      ])

      const diff = diffHashes(current, stored)
      expect(diff.added).toEqual([])
      expect(diff.modified).toEqual([])
      expect(diff.unchanged).toEqual([])
      expect(diff.deleted).toEqual(['src/removed.ts'])
    })

    test('handles empty maps', () => {
      const diff = diffHashes(new Map(), new Map())
      expect(diff.added).toEqual([])
      expect(diff.modified).toEqual([])
      expect(diff.unchanged).toEqual([])
      expect(diff.deleted).toEqual([])
    })

    test('handles first sync (no stored hashes)', () => {
      const current = new Map<string, FileHash>([
        ['src/a.ts', makeHash('src/a.ts', 'xxh64:1')],
        ['src/b.ts', makeHash('src/b.ts', 'xxh64:2')],
        ['src/c.ts', makeHash('src/c.ts', 'xxh64:3')],
      ])
      const stored = new Map<string, FileHash>()

      const diff = diffHashes(current, stored)
      expect(diff.added).toHaveLength(3)
      expect(diff.modified).toEqual([])
      expect(diff.unchanged).toEqual([])
      expect(diff.deleted).toEqual([])
    })

    test('mixed changes: added + modified + deleted + unchanged', () => {
      const current = new Map<string, FileHash>([
        ['src/new.ts', makeHash('src/new.ts', 'xxh64:new')],
        ['src/changed.ts', makeHash('src/changed.ts', 'xxh64:v2')],
        ['src/same.ts', makeHash('src/same.ts', 'xxh64:same')],
      ])
      const stored = new Map<string, FileHash>([
        ['src/changed.ts', makeHash('src/changed.ts', 'xxh64:v1')],
        ['src/same.ts', makeHash('src/same.ts', 'xxh64:same')],
        ['src/gone.ts', makeHash('src/gone.ts', 'xxh64:gone')],
      ])

      const diff = diffHashes(current, stored)
      expect(diff.added).toEqual(['src/new.ts'])
      expect(diff.modified).toEqual(['src/changed.ts'])
      expect(diff.unchanged).toEqual(['src/same.ts'])
      expect(diff.deleted).toEqual(['src/gone.ts'])
    })
  })

  // computeHashes (integration — reads actual files)

  describe('computeHashes', () => {
    test('computes hashes for project files', async () => {
      // Hash the prjct-cli project itself (small subset)
      const projectPath = path.resolve(__dirname, '..', '..', '..')
      const hashes = await computeHashes(projectPath)

      // Should find many files
      expect(hashes.size).toBeGreaterThan(50)

      // Check a known file exists
      const packageJson = hashes.get('package.json')
      expect(packageJson).toBeDefined()
      expect(packageJson!.hash).toMatch(/^(xxh64|fnv1a):/)
      expect(packageJson!.size).toBeGreaterThan(0)
    })

    test('excludes node_modules and .git', async () => {
      const projectPath = path.resolve(__dirname, '..', '..', '..')
      const hashes = await computeHashes(projectPath)

      for (const [filePath] of hashes) {
        expect(filePath).not.toContain('node_modules')
        expect(filePath).not.toContain('.git/')
      }
    })

    test('hash is deterministic', async () => {
      const projectPath = path.resolve(__dirname, '..', '..', '..')
      const hashes1 = await computeHashes(projectPath)
      const hashes2 = await computeHashes(projectPath)

      // Same file should produce same hash
      const pkg1 = hashes1.get('package.json')
      const pkg2 = hashes2.get('package.json')
      expect(pkg1?.hash).toBe(pkg2?.hash)
    })
  })
})
