/**
 * Project Tools Tests
 *
 * Tests patterns (returns objects not counts) and outcomes search.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { PatternStore } from '../../agentic/pattern-store'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-mcp-proj-${Date.now()}`

describe('MCP Project Tools (backend)', () => {
  const patternStore = new PatternStore()

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('getPatternsSummaryDetailed', () => {
    it('should return decision objects (not counts)', async () => {
      await patternStore.recordDecision(
        TEST_PROJECT_ID,
        'commit_style',
        'conventional',
        'initial observation'
      )
      await patternStore.recordDecision(
        TEST_PROJECT_ID,
        'commit_style',
        'conventional',
        'confirmed'
      )

      const summary = await patternStore.getPatternsSummaryDetailed(TEST_PROJECT_ID)

      expect(summary.decisions).toBeDefined()
      expect(summary.decisions.commit_style).toBeDefined()
      expect(summary.decisions.commit_style.value).toBe('conventional')
      expect(summary.decisions.commit_style.count).toBe(2)
      expect(typeof summary.decisions.commit_style.confidence).toBe('string')
    })

    it('should return preferences as objects', async () => {
      await patternStore.setPreference(TEST_PROJECT_ID, 'editor', 'vim', {
        userConfirmed: true,
      })

      const summary = await patternStore.getPatternsSummaryDetailed(TEST_PROJECT_ID)

      expect(summary.preferences).toBeDefined()
      expect(summary.preferences.editor).toBeDefined()
      expect(summary.preferences.editor.value).toBe('vim')
      expect(summary.preferences.editor.confidence).toBe('high')
    })

    it('should return workflows as objects', async () => {
      await patternStore.recordWorkflow(TEST_PROJECT_ID, 'deploy', { steps: ['build', 'test'] })

      const summary = await patternStore.getPatternsSummaryDetailed(TEST_PROJECT_ID)

      expect(summary.workflows).toBeDefined()
      expect(summary.workflows.deploy).toBeDefined()
      expect(summary.workflows.deploy.count).toBe(1)
    })
  })

  describe('getPatternsSummary (backward compat)', () => {
    it('should still return counts', async () => {
      const summary = await patternStore.getPatternsSummary(TEST_PROJECT_ID)

      expect(typeof summary.decisions).toBe('number')
      expect(typeof summary.preferences).toBe('number')
      expect(typeof summary.workflows).toBe('number')
    })
  })
})
