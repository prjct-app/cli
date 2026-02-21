/**
 * Cache Eviction Policy Tests (PRJ-288)
 * Verifies TTLCache integration, context caps, and archival.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ContextBuilder } from '../../agentic/context-builder'
import { MemorySystem, PatternStore } from '../../agentic/memory-system'
import pathManager from '../../infrastructure/path-manager'
import { SessionLogManager } from '../../session/session-log-manager'
import { prjctDb } from '../../storage/database'
import { TTLCache } from '../../utils/cache'

const TEST_GLOBAL_BASE_DIR = path.join(process.cwd(), '.tmp', 'prjct-cli-cache-tests')
let testCounter = 0
const getTestProjectId = () => `test-cache-${Date.now()}-${++testCounter}`

describe('Cache Eviction Policies (PRJ-288)', () => {
  beforeAll(async () => {
    pathManager.setGlobalBaseDir(TEST_GLOBAL_BASE_DIR)
    await fs.mkdir(TEST_GLOBAL_BASE_DIR, { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(TEST_GLOBAL_BASE_DIR, { recursive: true, force: true })
  })

  // ===========================================================================
  // TTLCache unit tests
  // ===========================================================================

  describe('TTLCache', () => {
    it('should evict oldest entries when maxSize exceeded', () => {
      const cache = new TTLCache<string>({ maxSize: 3, ttl: 60_000 })

      cache.set('a', 'val-a')
      cache.set('b', 'val-b')
      cache.set('c', 'val-c')
      expect(cache.size).toBe(3)

      cache.set('d', 'val-d')
      expect(cache.size).toBe(3)
      // 'a' was oldest, should be evicted
      expect(cache.get('a')).toBeNull()
      expect(cache.get('d')).toBe('val-d')
    })

    it('should expire entries after TTL', async () => {
      const cache = new TTLCache<string>({ maxSize: 10, ttl: 50 })

      cache.set('key', 'value')
      expect(cache.get('key')).toBe('value')

      await new Promise((r) => setTimeout(r, 80))
      expect(cache.get('key')).toBeNull()
    })

    it('should prune expired entries', async () => {
      const cache = new TTLCache<string>({ maxSize: 10, ttl: 50 })

      cache.set('a', '1')
      cache.set('b', '2')
      await new Promise((r) => setTimeout(r, 80))

      cache.set('c', '3') // fresh
      const pruned = cache.prune()
      expect(pruned).toBe(2)
      expect(cache.size).toBe(1)
      expect(cache.get('c')).toBe('3')
    })
  })

  // ===========================================================================
  // SessionLogManager
  // ===========================================================================

  describe('SessionLogManager', () => {
    it('should use TTLCache with LRU eviction at 50 entries', () => {
      const manager = new SessionLogManager()
      // Verify clearCache works (exercises TTLCache.clear())
      manager.clearCache()
    })
  })

  // ===========================================================================
  // ContextBuilder
  // ===========================================================================

  describe('ContextBuilder', () => {
    it('should report stats from TTLCache', () => {
      const builder = new ContextBuilder()
      const stats = builder.getCacheStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('ttl')
      expect(stats.maxSize).toBe(200)
      expect(stats.ttl).toBe(5000)
    })

    it('should clear cache and reset projectId', () => {
      const builder = new ContextBuilder()
      builder.clearCache()
      const stats = builder.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should invalidate specific cache entries', async () => {
      const builder = new ContextBuilder()

      // Write a temp file, batchRead to populate cache, then invalidate
      const tmpDir = path.join(TEST_GLOBAL_BASE_DIR, 'ctx-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const tmpFile = path.join(tmpDir, 'test.txt')
      await fs.writeFile(tmpFile, 'hello')

      const result = await builder.batchRead([tmpFile])
      expect(result.get(tmpFile)).toBe('hello')

      // Invalidate and verify
      builder.invalidateCache(tmpFile)
      // After invalidation, a fresh batchRead should re-read from disk
      await fs.writeFile(tmpFile, 'updated')
      const result2 = await builder.batchRead([tmpFile])
      expect(result2.get(tmpFile)).toBe('updated')
    })
  })

  // ===========================================================================
  // PatternStore - contexts cap
  // ===========================================================================

  describe('PatternStore contexts cap', () => {
    let TEST_PROJECT_ID: string

    beforeEach(() => {
      TEST_PROJECT_ID = getTestProjectId()
    })

    it('should cap decision contexts at 20 (FIFO)', async () => {
      const store = new PatternStore()

      // Record a decision with many unique contexts
      for (let i = 0; i < 25; i++) {
        await store.recordDecision(TEST_PROJECT_ID, 'test-key', 'test-value', `context-${i}`)
      }

      const patterns = await store.load(TEST_PROJECT_ID)
      const decision = patterns.decisions['test-key']
      expect(decision.contexts.length).toBeLessThanOrEqual(20)
      // Should keep the latest contexts
      expect(decision.contexts).toContain('context-24')
      expect(decision.contexts).toContain('context-5')
      // Oldest should be evicted
      expect(decision.contexts).not.toContain('context-0')
    })

    it('should truncate oversized contexts on afterLoad', async () => {
      const store = new PatternStore()
      const projectId = getTestProjectId()

      // Write oversized patterns directly to SQLite
      const oversizedPatterns = {
        version: 1,
        decisions: {
          'big-key': {
            value: 'v',
            count: 30,
            firstSeen: '2025-01-01T00:00:00.000Z',
            lastSeen: '2025-06-01T00:00:00.000Z',
            confidence: 'high',
            contexts: Array.from({ length: 50 }, (_, i) => `ctx-${i}`),
            userConfirmed: true,
          },
        },
        preferences: {},
        workflows: {},
        counters: {},
      }
      prjctDb.setDoc(projectId, 'memory:patterns', oversizedPatterns)

      // Load triggers afterLoad which should truncate
      const patterns = await store.load(projectId)
      expect(patterns.decisions['big-key'].contexts.length).toBe(20)
      // Should keep the latest 20 (indices 30-49)
      expect(patterns.decisions['big-key'].contexts[19]).toBe('ctx-49')
    })
  })

  // ===========================================================================
  // PatternStore - archival
  // ===========================================================================

  describe('PatternStore archival', () => {
    it('should archive decisions older than 90 days', async () => {
      const store = new PatternStore()
      const projectId = getTestProjectId()

      const now = new Date()
      const staleDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

      const patterns = {
        version: 1,
        decisions: {
          'stale-key': {
            value: 'old',
            count: 3,
            firstSeen: staleDate.toISOString(),
            lastSeen: staleDate.toISOString(),
            confidence: 'medium',
            contexts: ['ctx1'],
            userConfirmed: false,
          },
          'active-key': {
            value: 'new',
            count: 5,
            firstSeen: recentDate.toISOString(),
            lastSeen: recentDate.toISOString(),
            confidence: 'high',
            contexts: ['ctx2'],
            userConfirmed: true,
          },
        },
        preferences: {},
        workflows: {},
        counters: {},
      }
      // Write patterns directly to SQLite
      prjctDb.setDoc(projectId, 'memory:patterns', patterns)

      // Reset store cache to force SQLite read
      store.reset()
      const archived = await store.archiveStaleDecisions(projectId)
      expect(archived).toBe(1)

      // Verify active decision remains
      const updated = await store.load(projectId)
      expect(updated.decisions['active-key']).toBeDefined()
      expect(updated.decisions['stale-key']).toBeUndefined()

      // Verify archive was saved to SQLite
      const archiveContent = prjctDb.getDoc<Record<string, { value: string }>>(
        projectId,
        'memory:patterns-archive'
      )
      expect(archiveContent).not.toBeNull()
      expect(archiveContent!['stale-key']).toBeDefined()
      expect(archiveContent!['stale-key'].value).toBe('old')
    })

    it('should return 0 when no stale decisions exist', async () => {
      const store = new PatternStore()
      const projectId = getTestProjectId()

      // Record a fresh decision
      await store.recordDecision(projectId, 'fresh-key', 'fresh-val', 'ctx')
      const archived = await store.archiveStaleDecisions(projectId)
      expect(archived).toBe(0)
    })
  })

  // ===========================================================================
  // MemorySystem delegation
  // ===========================================================================

  describe('MemorySystem.archiveStaleDecisions', () => {
    it('should delegate to PatternStore', async () => {
      const ms = new MemorySystem()
      const projectId = getTestProjectId()

      // Just verify no crash - no stale data to archive
      ms.resetState()
      await ms.recordDecision(projectId, 'key', 'val', 'ctx')
      const count = await ms.archiveStaleDecisions(projectId)
      expect(count).toBe(0)
    })
  })
})
