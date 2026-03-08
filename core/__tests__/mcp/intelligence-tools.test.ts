/**
 * Memory Intelligence Tools Tests
 *
 * Tests confirm, archive_stale, mem_topic, and feedback_aggregate backends.
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { MemorySystem } from '../../agentic/memory-system'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-mcp-intel-${Date.now()}`

describe('MCP Memory Intelligence Tools (backend)', () => {
  let memorySystem: MemorySystem
  const memories = new SemanticMemories()

  beforeEach(() => {
    memorySystem = new MemorySystem()
    memorySystem.resetState()
  })

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('prjct_confirm', () => {
    it('should confirm a decision and boost confidence', async () => {
      await memorySystem.learnDecision(TEST_PROJECT_ID, 'test_key', 'test_value', 'context')
      const confirmed = await memorySystem.confirmDecision(TEST_PROJECT_ID, 'test_key')
      expect(confirmed).toBe(true)
    })

    it('should confirm a preference', async () => {
      await memorySystem.setPreference(TEST_PROJECT_ID, 'editor', 'vim')
      const confirmed = await memorySystem.confirmPreference(TEST_PROJECT_ID, 'editor')
      expect(confirmed).toBe(true)
    })

    it('should confirm a workflow', async () => {
      await memorySystem.recordWorkflow(TEST_PROJECT_ID, 'deploy', { steps: ['build'] })
      const confirmed = await memorySystem.confirmWorkflow(TEST_PROJECT_ID, 'deploy')
      expect(confirmed).toBe(true)
    })

    it('should return false for nonexistent key', async () => {
      const confirmed = await memorySystem.confirmDecision(TEST_PROJECT_ID, 'nonexistent')
      expect(confirmed).toBe(false)
    })
  })

  describe('prjct_archive_stale', () => {
    it('should archive stale decisions', async () => {
      const archived = await memorySystem.archiveStaleDecisions(TEST_PROJECT_ID)
      expect(typeof archived).toBe('number')
    })
  })

  describe('prjct_mem_topic', () => {
    it('should find memories by topic_key prefix', async () => {
      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Bug: CORS issue',
        content: 'Fixed CORS headers in middleware',
        topicKey: 'bug/cors-issue',
        userTriggered: true,
      })

      await memories.createMemory(TEST_PROJECT_ID, {
        title: 'Bug: Auth timeout',
        content: 'Auth tokens were expiring too quickly',
        topicKey: 'bug/auth-timeout',
        userTriggered: true,
      })

      const rows = prjctDb.query<{ id: string; title: string; topic_key: string }>(
        TEST_PROJECT_ID,
        `SELECT id, title, topic_key FROM memories
         WHERE project_id = ? AND topic_key LIKE ? AND deleted_at IS NULL`,
        TEST_PROJECT_ID,
        'bug/%'
      )

      expect(rows.length).toBeGreaterThanOrEqual(2)
      expect(rows.every((r) => r.topic_key.startsWith('bug/'))).toBe(true)
    })

    it('should return empty for unmatched prefix', () => {
      const rows = prjctDb.query<{ id: string }>(
        TEST_PROJECT_ID,
        `SELECT id FROM memories
         WHERE project_id = ? AND topic_key LIKE ? AND deleted_at IS NULL`,
        TEST_PROJECT_ID,
        'nonexistent/%'
      )

      expect(rows.length).toBe(0)
    })
  })

  describe('prjct_feedback_aggregate', () => {
    it('should return aggregated feedback structure', async () => {
      // Import stateStorage to test getAggregatedFeedback directly
      const { stateStorage } = await import('../../storage/state-storage')
      const feedback = await stateStorage.getAggregatedFeedback(TEST_PROJECT_ID)

      expect(feedback).toBeDefined()
      expect(Array.isArray(feedback.stackConfirmed)).toBe(true)
      expect(Array.isArray(feedback.patternsDiscovered)).toBe(true)
      expect(Array.isArray(feedback.agentAccuracy)).toBe(true)
      expect(Array.isArray(feedback.issuesEncountered)).toBe(true)
      expect(Array.isArray(feedback.knownGotchas)).toBe(true)
    })
  })
})
