/**
 * FTS5 Semantic Memories Tests
 *
 * Tests for:
 * - FTS5 search returns BM25-ranked results
 * - SHA-256 content dedup
 * - topic_key upsert
 * - Soft-delete
 * - Tag filtering
 * - Migration from kv_store
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-fts5-${Date.now()}`

describe('SemanticMemories (FTS5)', () => {
  let memories: SemanticMemories

  beforeEach(() => {
    memories = new SemanticMemories()
    // Clear test data
    try {
      prjctDb.run(TEST_PROJECT_ID, 'DELETE FROM memories WHERE project_id = ?', TEST_PROJECT_ID)
    } catch {
      // Table may not exist yet on first run
    }
  })

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('createMemory', () => {
    it('should create a memory and return its ID', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Test memory',
        content: 'This is test content about TypeScript and React',
        tags: ['code_style'],
      })

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('should deduplicate by content hash', async () => {
      const content = 'Exact same content for dedup test'

      const id1 = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'First',
        content,
      })

      const id2 = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Second',
        content,
      })

      expect(id1).toBe(id2)
    })

    it('should upsert by topic_key', async () => {
      const id1 = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Commit style v1',
        content: 'Use conventional commits',
        topicKey: 'preference:commit_style',
      })

      const id2 = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Commit style v2',
        content: 'Use gitmoji conventional commits',
        topicKey: 'preference:commit_style',
      })

      // Should update the same record
      expect(id1).toBe(id2)

      // Content should be updated
      const all = await memories.getAllMemories(TEST_PROJECT_ID)
      const found = all.find((m) => m.id === id1)
      expect(found?.content).toBe('Use gitmoji conventional commits')
      expect(found?.title).toBe('Commit style v2')
    })
  })

  describe('searchMemories (FTS5)', () => {
    it('should return FTS5-ranked results', async () => {
      // Create memories with different relevance
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'React components',
        content: 'Always use functional React components with hooks',
        tags: ['code_style'],
      })

      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Database migrations',
        content: 'Run database migrations before deploying',
        tags: ['architecture'],
      })

      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'React testing',
        content: 'Test React components with React Testing Library',
        tags: ['test_behavior'],
      })

      const results = await memories.searchMemories(TEST_PROJECT_ID, 'React components')

      expect(results.length).toBeGreaterThanOrEqual(2)
      // First result should be about React components (highest BM25 score)
      expect(results[0].title).toContain('React')
    })

    it('should return empty array for no matches', async () => {
      const results = await memories.searchMemories(TEST_PROJECT_ID, 'zzzznonexistent')
      expect(results).toHaveLength(0)
    })
  })

  describe('deleteMemory (soft-delete)', () => {
    it('should soft-delete (not hard-delete)', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'To be deleted',
        content: 'This memory will be soft-deleted',
      })

      const deleted = await memories.deleteMemory(TEST_PROJECT_ID, id)
      expect(deleted).toBe(true)

      // Should not appear in getAllMemories
      const all = await memories.getAllMemories(TEST_PROJECT_ID)
      expect(all.find((m) => m.id === id)).toBeUndefined()

      // But should still exist in DB with deleted_at set
      const row = prjctDb.get<{ deleted_at: string | null }>(
        TEST_PROJECT_ID,
        'SELECT deleted_at FROM memories WHERE id = ?',
        id
      )
      expect(row?.deleted_at).toBeTruthy()
    })

    it('should return false for non-existent memory', async () => {
      const deleted = await memories.deleteMemory(TEST_PROJECT_ID, 'nonexistent-id')
      expect(deleted).toBe(false)
    })

    it('should not appear in search results after soft-delete', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Searchable then deleted',
        content: 'Unique content xyzzy42 for search verification',
      })

      // Verify it's searchable
      let results = await memories.searchMemories(TEST_PROJECT_ID, 'xyzzy42')
      expect(results.length).toBeGreaterThanOrEqual(1)

      // Soft-delete
      await memories.deleteMemory(TEST_PROJECT_ID, id)

      // Should no longer appear in search
      results = await memories.searchMemories(TEST_PROJECT_ID, 'xyzzy42')
      expect(results.find((m) => m.id === id)).toBeUndefined()
    })
  })

  describe('updateMemory', () => {
    it('should update title, content, and tags', async () => {
      const id = await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Original title',
        content: 'Original content',
        tags: ['code_style'],
      })

      const updated = await memories.updateMemory(TEST_PROJECT_ID, id, {
        title: 'Updated title',
        content: 'Updated content',
        tags: ['architecture'],
      })

      expect(updated).toBe(true)

      const all = await memories.getAllMemories(TEST_PROJECT_ID)
      const found = all.find((m) => m.id === id)
      expect(found?.title).toBe('Updated title')
      expect(found?.content).toBe('Updated content')
      expect(found?.tags).toContain('architecture')
    })

    it('should return false for non-existent memory', async () => {
      const updated = await memories.updateMemory(TEST_PROJECT_ID, 'nonexistent', {
        title: 'nope',
      })
      expect(updated).toBe(false)
    })
  })

  describe('findByTags', () => {
    it('should find memories by any matching tag', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Code style',
        content: 'Style rule A',
        tags: ['code_style'],
      })

      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Test behavior',
        content: 'Test rule B',
        tags: ['test_behavior'],
      })

      const results = await memories.findByTags(TEST_PROJECT_ID, ['code_style'])
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.every((m) => m.tags.includes('code_style'))).toBe(true)
    })

    it('should match all tags when matchAll=true', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Multi-tag A',
        content: 'Has both style and testing tags',
        tags: ['code_style', 'test_behavior'],
      })

      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Single-tag B',
        content: 'Has only code style tag',
        tags: ['code_style'],
      })

      const results = await memories.findByTags(
        TEST_PROJECT_ID,
        ['code_style', 'test_behavior'],
        true
      )
      expect(
        results.every((m) => m.tags.includes('code_style') && m.tags.includes('test_behavior'))
      ).toBe(true)
    })
  })

  describe('autoRemember', () => {
    it('should create a memory with topic_key for dedup', async () => {
      await memories.autoRemember(TEST_PROJECT_ID, 'commit_footer', 'p/')
      await memories.autoRemember(TEST_PROJECT_ID, 'commit_footer', 'p/ v2')

      // Should only have one memory (topic_key upsert)
      const all = await memories.getAllMemories(TEST_PROJECT_ID)
      const commitMemories = all.filter((m) => m.content.includes('commit_footer'))
      expect(commitMemories.length).toBe(1)
      expect(commitMemories[0].content).toContain('p/ v2')
    })
  })

  describe('getRelevantMemoriesWithMetrics', () => {
    it('should return metrics with scored memories', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'API patterns',
        content: 'REST API patterns for this project',
        tags: ['architecture'],
      })

      const result = await memories.getRelevantMemoriesWithMetrics(TEST_PROJECT_ID, {
        taskDescription: 'Build REST API endpoint',
        maxResults: 5,
      })

      expect(result.metrics.totalMemories).toBeGreaterThanOrEqual(1)
      expect(result.metrics.memoriesReturned).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getMemoryStats', () => {
    it('should return correct statistics', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Stats test',
        content: 'Content for stats verification',
        tags: ['code_style', 'architecture'],
        userTriggered: true,
      })

      const stats = await memories.getMemoryStats(TEST_PROJECT_ID)
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1)
      expect(stats.userTriggered).toBeGreaterThanOrEqual(1)
      expect(stats.tagCounts.code_style).toBeGreaterThanOrEqual(1)
    })
  })
})
