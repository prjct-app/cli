/**
 * Archive Storage Tests (PRJ-267)
 *
 * Tests for the archive infrastructure and archival policies:
 * - Archive table operations (insert, query, restore)
 * - Shipped features archival (>90 days)
 * - Ideas dormancy (>180 days pending)
 * - Queue cleanup (>7 days completed)
 * - Paused task archival (>30 days)
 * - Memory log capping (500 entries)
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { ARCHIVE_POLICIES, archiveStorage } from '../../storage/archive-storage'
import { prjctDb } from '../../storage/database'
import { ideasStorage } from '../../storage/ideas-storage'
import { queueStorage } from '../../storage/queue-storage'
import { shippedStorage } from '../../storage/shipped-storage'
import { stateStorage } from '../../storage/state-storage'
import { getTimestamp } from '../../utils/date-helper'

// Test Setup

let tmpRoot: string
let testProjectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

describe('Archive Storage', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-archive-test-'))
    testProjectId = 'test-archive-project'

    pathManager.getGlobalProjectPath = (projectId: string) => path.join(tmpRoot, projectId)

    pathManager.getFilePath = (projectId: string, layer: string, filename: string) =>
      path.join(tmpRoot, projectId, layer, filename)

    // Ensure all required dirs exist
    const dirs = ['context', 'memory', 'core', 'progress', 'planning', 'sync']
    await Promise.all(
      dirs.map((d) => fs.mkdir(path.join(tmpRoot, testProjectId, d), { recursive: true }))
    )

    // Create empty pending.json for event bus
    await fs.writeFile(path.join(tmpRoot, testProjectId, 'sync', 'pending.json'), '[]', 'utf-8')

    // Initialize the database (triggers migrations including archives table)
    prjctDb.getDb(testProjectId)
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    pathManager.getFilePath = originalGetFilePath

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    }
  })

  // Archive Table Operations

  describe('archive table', () => {
    it('should archive a single item', () => {
      const id = archiveStorage.archive(testProjectId, {
        entityType: 'shipped',
        entityId: 'ship-1',
        entityData: { name: 'Feature A', version: '1.0.0' },
        summary: 'Feature A v1.0.0',
        reason: 'age',
      })

      expect(id).toBeTruthy()

      const records = archiveStorage.getArchived(testProjectId, 'shipped')
      expect(records).toHaveLength(1)
      expect(records[0].entity_id).toBe('ship-1')
      expect(records[0].summary).toBe('Feature A v1.0.0')
    })

    it('should archive multiple items in a transaction', () => {
      const count = archiveStorage.archiveMany(testProjectId, [
        { entityType: 'shipped', entityId: 's1', entityData: { a: 1 }, reason: 'age' },
        { entityType: 'shipped', entityId: 's2', entityData: { a: 2 }, reason: 'age' },
        { entityType: 'idea', entityId: 'i1', entityData: { b: 1 }, reason: 'dormant' },
      ])

      expect(count).toBe(3)

      const stats = archiveStorage.getStats(testProjectId)
      expect(stats.shipped).toBe(2)
      expect(stats.idea).toBe(1)
      expect(stats.total).toBe(3)
    })

    it('should restore an archived item', () => {
      archiveStorage.archive(testProjectId, {
        entityType: 'shipped',
        entityId: 'ship-1',
        entityData: { name: 'restored' },
        reason: 'age',
      })

      const records = archiveStorage.getArchived(testProjectId)
      expect(records).toHaveLength(1)

      const data = archiveStorage.restore(testProjectId, records[0].id)
      expect(data).toEqual({ name: 'restored' })

      // Should be removed from archive
      const after = archiveStorage.getArchived(testProjectId)
      expect(after).toHaveLength(0)
    })

    it('should prune old archives', () => {
      // Insert an archive with old timestamp
      const db = prjctDb.getDb(testProjectId)
      const oldDate = daysAgoISO(400)
      db.prepare(
        'INSERT INTO archives (id, entity_type, entity_id, entity_data, archived_at, reason) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('old-1', 'shipped', 's1', '{}', oldDate, 'age')

      archiveStorage.archive(testProjectId, {
        entityType: 'shipped',
        entityId: 's2',
        entityData: {},
        reason: 'age',
      })

      const pruned = archiveStorage.pruneOldArchives(testProjectId, 365)
      expect(pruned).toBe(1)

      const remaining = archiveStorage.getArchived(testProjectId)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].entity_id).toBe('s2')
    })
  })

  // Shipped Features Archival

  describe('shipped archival', () => {
    it('should archive shipped features older than 90 days', async () => {
      // Write shipped data with old and recent items
      await shippedStorage.write(testProjectId, {
        shipped: [
          { id: 'recent', name: 'Recent', version: '2.0.0', shippedAt: daysAgoISO(10) },
          { id: 'old', name: 'Old', version: '1.0.0', shippedAt: daysAgoISO(100) },
        ],
        lastUpdated: getTimestamp(),
      })

      const archived = await shippedStorage.archiveOldShipped(testProjectId)
      expect(archived).toBe(1)

      // Verify active storage only has recent
      const data = await shippedStorage.read(testProjectId)
      expect(data.shipped).toHaveLength(1)
      expect(data.shipped[0].id).toBe('recent')

      // Verify archive table has old item
      const records = archiveStorage.getArchived(testProjectId, 'shipped')
      expect(records).toHaveLength(1)
      expect(records[0].entity_id).toBe('old')
      expect(records[0].summary).toBe('Old v1.0.0')
    })

    it('should not archive recent shipped features', async () => {
      await shippedStorage.write(testProjectId, {
        shipped: [
          { id: 'r1', name: 'R1', version: '1.0.0', shippedAt: daysAgoISO(5) },
          { id: 'r2', name: 'R2', version: '1.1.0', shippedAt: daysAgoISO(30) },
        ],
        lastUpdated: getTimestamp(),
      })

      const archived = await shippedStorage.archiveOldShipped(testProjectId)
      expect(archived).toBe(0)

      const data = await shippedStorage.read(testProjectId)
      expect(data.shipped).toHaveLength(2)
    })
  })

  // Ideas Dormancy

  describe('ideas dormancy', () => {
    it('should mark pending ideas older than 180 days as dormant', async () => {
      await ideasStorage.write(testProjectId, {
        ideas: [
          {
            id: 'new',
            text: 'New idea',
            status: 'pending',
            priority: 'medium',
            tags: [],
            addedAt: daysAgoISO(10),
          },
          {
            id: 'stale',
            text: 'Stale idea',
            status: 'pending',
            priority: 'low',
            tags: [],
            addedAt: daysAgoISO(200),
          },
          {
            id: 'converted',
            text: 'Converted',
            status: 'converted',
            priority: 'high',
            tags: [],
            addedAt: daysAgoISO(300),
          },
        ],
        lastUpdated: getTimestamp(),
      })

      const dormant = await ideasStorage.markDormantIdeas(testProjectId)
      expect(dormant).toBe(1)

      const data = await ideasStorage.read(testProjectId)
      const stale = data.ideas.find((i) => i.id === 'stale')
      expect(stale?.status).toBe('dormant')

      // New idea should remain pending
      const fresh = data.ideas.find((i) => i.id === 'new')
      expect(fresh?.status).toBe('pending')

      // Converted should remain converted
      const conv = data.ideas.find((i) => i.id === 'converted')
      expect(conv?.status).toBe('converted')

      // Archive table should have the dormant idea
      const records = archiveStorage.getArchived(testProjectId, 'idea')
      expect(records).toHaveLength(1)
    })

    it('should track dormant status in SQLite', async () => {
      await ideasStorage.write(testProjectId, {
        ideas: [
          {
            id: 'active',
            text: 'Active idea',
            status: 'pending',
            priority: 'medium',
            tags: [],
            addedAt: daysAgoISO(5),
          },
          {
            id: 'dormant',
            text: 'Dormant idea',
            status: 'dormant',
            priority: 'low',
            tags: [],
            addedAt: daysAgoISO(200),
          },
        ],
        lastUpdated: getTimestamp(),
      })

      // Read back from storage — dormant ideas preserved in SQLite
      const data = await ideasStorage.read(testProjectId)
      const active = data.ideas.filter((i) => i.status === 'pending')
      const dormant = data.ideas.filter((i) => i.status === 'dormant')

      expect(active).toHaveLength(1)
      expect(active[0].text).toBe('Active idea')
      expect(dormant).toHaveLength(1)
      expect(dormant[0].text).toBe('Dormant idea')
    })
  })

  // Queue Cleanup

  describe('queue cleanup', () => {
    it('should remove completed tasks older than 7 days', async () => {
      await queueStorage.write(testProjectId, {
        tasks: [
          {
            id: 'active',
            description: 'Active',
            type: 'feature',
            priority: 'medium',
            section: 'active',
            createdAt: daysAgoISO(1),
            completed: false,
          },
          {
            id: 'recent-done',
            description: 'Recent done',
            type: 'feature',
            priority: 'medium',
            section: 'active',
            createdAt: daysAgoISO(5),
            completed: true,
            completedAt: daysAgoISO(2),
          },
          {
            id: 'old-done',
            description: 'Old done',
            type: 'feature',
            priority: 'low',
            section: 'active',
            createdAt: daysAgoISO(30),
            completed: true,
            completedAt: daysAgoISO(10),
          },
        ],
        lastUpdated: getTimestamp(),
      })

      const removed = await queueStorage.removeStaleCompleted(testProjectId)
      expect(removed).toBe(1)

      const data = await queueStorage.read(testProjectId)
      expect(data.tasks).toHaveLength(2)
      expect(data.tasks.map((t) => t.id).sort()).toEqual(['active', 'recent-done'])

      // Archive should have the old completed task
      const records = archiveStorage.getArchived(testProjectId, 'queue_task')
      expect(records).toHaveLength(1)
      expect(records[0].entity_id).toBe('old-done')
    })
  })

  // Paused Task Archival

  describe('paused task archival', () => {
    it('should archive paused tasks older than 30 days', async () => {
      await stateStorage.write(testProjectId, {
        currentTask: null,
        previousTask: null,
        pausedTasks: [
          {
            id: 'recent',
            description: 'Recent pause',
            status: 'paused',
            startedAt: daysAgoISO(35),
            pausedAt: daysAgoISO(5),
          },
          {
            id: 'stale',
            description: 'Stale pause',
            status: 'paused',
            startedAt: daysAgoISO(60),
            pausedAt: daysAgoISO(40),
          },
        ],
        lastUpdated: getTimestamp(),
      })

      const archived = await stateStorage.archiveStalePausedTasks(testProjectId)
      expect(archived).toHaveLength(1)
      expect(archived[0].id).toBe('stale')

      // Active state should only have recent
      const state = await stateStorage.read(testProjectId)
      expect(state.pausedTasks).toHaveLength(1)
      expect(state.pausedTasks![0].id).toBe('recent')

      // Archive table should have stale
      const records = archiveStorage.getArchived(testProjectId, 'paused_task')
      expect(records).toHaveLength(1)
      expect(records[0].entity_id).toBe('stale')
    })
  })

  // Memory Log Capping

  describe('memory log capping', () => {
    it('should cap memory entries at max limit', async () => {
      // Write more entries than the limit to SQLite events table
      const total = ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES + 50
      for (let i = 0; i < total; i++) {
        prjctDb.appendEvent(testProjectId, `memory.action-${i}`, {
          action: `action-${i}`,
          index: i,
        })
      }

      // Import and use memoryService
      const { memoryService } = await import('../../services/memory-service')
      const capped = await memoryService.capEntries(testProjectId)
      expect(capped).toBe(50)

      // SQLite should now have exactly max entries
      const countRow = prjctDb.get<{ cnt: number }>(
        testProjectId,
        "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.%'"
      )
      expect(countRow!.cnt).toBe(ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES)

      // Archive should have the overflow
      const records = archiveStorage.getArchived(testProjectId, 'memory_entry')
      expect(records).toHaveLength(50)
    })

    it('NEVER deletes memory.remember.* knowledge, regardless of age or volume', async () => {
      // The real-world incident: hundreds of memory.post_edit telemetry
      // rows pushed the combined count past the cap, and the age-ordered
      // delete destroyed the OLDEST remembered decisions/gotchas while
      // keeping newer telemetry. Knowledge must be invisible to the cap
      // (both the count and the delete) — it leaves via `prjct forget`.
      for (let i = 0; i < 30; i++) {
        prjctDb.appendEvent(testProjectId, 'memory.remember.decision', {
          content: `old precious decision ${i}`,
          tags: {},
        })
      }
      const total = ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES + 20
      for (let i = 0; i < total; i++) {
        prjctDb.appendEvent(testProjectId, 'memory.post_edit', { file: `f${i}.ts` })
      }

      const { memoryService } = await import('../../services/memory-service')
      const capped = await memoryService.capEntries(testProjectId)
      expect(capped).toBe(20)

      // Every remember row survives — even though they are the oldest.
      const remembered = prjctDb.get<{ cnt: number }>(
        testProjectId,
        "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.remember.%'"
      )
      expect(remembered!.cnt).toBe(30)

      // Telemetry got capped to the limit.
      const telemetry = prjctDb.get<{ cnt: number }>(
        testProjectId,
        "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.%' AND type NOT LIKE 'memory.remember.%'"
      )
      expect(telemetry!.cnt).toBe(ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES)
    })

    it('should not cap if under limit', async () => {
      // Write a few entries under the limit to SQLite
      for (let i = 0; i < 10; i++) {
        prjctDb.appendEvent(testProjectId, `memory.a-${i}`, { action: `a-${i}`, data: {} })
      }

      const { memoryService } = await import('../../services/memory-service')
      const capped = await memoryService.capEntries(testProjectId)
      expect(capped).toBe(0)
    })
  })

  // Archive Policies Constants

  describe('archive policies', () => {
    it('should have correct default policy values', () => {
      expect(ARCHIVE_POLICIES.SHIPPED_RETENTION_DAYS).toBe(90)
      expect(ARCHIVE_POLICIES.IDEA_DORMANT_DAYS).toBe(180)
      expect(ARCHIVE_POLICIES.QUEUE_COMPLETED_DAYS).toBe(7)
      expect(ARCHIVE_POLICIES.PAUSED_TASK_DAYS).toBe(30)
      expect(ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES).toBe(500)
    })
  })
})
