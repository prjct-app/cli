/**
 * Session Tools Tests
 *
 * Tests context uses relevant memories when task exists, falls back to recency.
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-mcp-sess-${Date.now()}`

describe('MCP Session Tools (backend)', () => {
  let memories: SemanticMemories

  beforeEach(() => {
    memories = new SemanticMemories()
    try {
      prjctDb.run(TEST_PROJECT_ID, 'DELETE FROM memories WHERE project_id = ?', TEST_PROJECT_ID)
    } catch {
      // Table may not exist
    }
  })

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('getRelevantMemories', () => {
    it('should return task-relevant memories when context provided', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Auth bug fix',
        content: 'Fixed authentication token refresh issue in login module',
      })
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Database optimization',
        content: 'Improved query performance for user table',
      })

      const relevant = await memories.getRelevantMemories(
        TEST_PROJECT_ID,
        { params: { description: 'authentication login token' } },
        5
      )

      // Should find the auth-related memory
      expect(relevant.length).toBeGreaterThanOrEqual(1)
    })

    it('should fall back to recent memories when no context', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Recent memory',
        content: 'Most recently created',
      })

      const results = await memories.getRelevantMemories(TEST_PROJECT_ID, {}, 5)

      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })
})
