/**
 * Memory Tools Tests
 *
 * Tests save, search, get (O(1)), update, delete, stats, tags.
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-mcp-mem-${Date.now()}`

describe('MCP Memory Tools (backend)', () => {
  let memories: SemanticMemories

  beforeEach(() => {
    memories = new SemanticMemories()
    try {
      prjctDb.run(TEST_PROJECT_ID, 'DELETE FROM memories WHERE project_id = ?', TEST_PROJECT_ID)
    } catch {
      // Table may not exist yet
    }
  })

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('getMemoryById (O(1))', () => {
    it('should return a memory by ID without loading all', async () => {
      // Create multiple memories
      const id1 = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'First memory',
        content: 'Content one',
      })
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Second memory',
        content: 'Content two',
      })
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Third memory',
        content: 'Content three',
      })

      // Get by ID — should be O(1) direct SELECT
      const result = await memories.getMemoryById(TEST_PROJECT_ID, id1)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('First memory')
      expect(result!.content).toBe('Content one')
    })

    it('should return null for non-existent ID', async () => {
      const result = await memories.getMemoryById(TEST_PROJECT_ID, 'nonexistent-id')
      expect(result).toBeNull()
    })

    it('should not return soft-deleted memories', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'To delete',
        content: 'Will be deleted',
      })
      await memories.deleteMemory(TEST_PROJECT_ID, id)

      const result = await memories.getMemoryById(TEST_PROJECT_ID, id)
      expect(result).toBeNull()
    })
  })

  describe('updateMemory', () => {
    it('should update title and content', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Original',
        content: 'Original content',
      })

      const updated = await memories.updateMemory(TEST_PROJECT_ID, id, {
        title: 'Updated title',
        content: 'Updated content',
      })
      expect(updated).toBe(true)

      const memory = await memories.getMemoryById(TEST_PROJECT_ID, id)
      expect(memory!.title).toBe('Updated title')
      expect(memory!.content).toBe('Updated content')
    })

    it('should return false for non-existent memory', async () => {
      const result = await memories.updateMemory(TEST_PROJECT_ID, 'fake-id', {
        title: 'New',
      })
      expect(result).toBe(false)
    })
  })

  describe('getMemoryStats', () => {
    it('should return correct statistics', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'User memory',
        content: 'User triggered',
        userTriggered: true,
        tags: ['code_style'],
      })
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Auto memory',
        content: 'Auto captured',
        userTriggered: false,
      })

      const stats = await memories.getMemoryStats(TEST_PROJECT_ID)
      expect(stats.totalMemories).toBeGreaterThanOrEqual(2)
      expect(stats.userTriggered).toBeGreaterThanOrEqual(1)
      expect(stats.oldestMemory).toBeTruthy()
      expect(stats.newestMemory).toBeTruthy()
    })
  })

  describe('findByTags', () => {
    it('should find memories by tag (match any)', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Styled code',
        content: 'Code style memory',
        tags: ['code_style'],
      })
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'No tags',
        content: 'Untagged memory',
      })

      const results = await memories.findByTags(TEST_PROJECT_ID, ['code_style'])
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((m) => m.title === 'Styled code')).toBe(true)
    })
  })

  describe('searchMemories with pagination', () => {
    it('should respect limit and offset', async () => {
      // Create several memories
      for (let i = 0; i < 5; i++) {
        await memories.createMemory(TEST_PROJECT_ID, {
          title: `Pagination test ${i}`,
          content: `Pagination content item number ${i} for testing search`,
        })
      }

      const page1 = await memories.searchMemories(TEST_PROJECT_ID, 'pagination', 2, 0)
      const page2 = await memories.searchMemories(TEST_PROJECT_ID, 'pagination', 2, 2)

      expect(page1.length).toBeLessThanOrEqual(2)
      expect(page2.length).toBeLessThanOrEqual(2)
    })
  })
})
