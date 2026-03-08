/**
 * Pattern Tools Tests
 *
 * Tests decision record/get roundtrip, preference set/get roundtrip.
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { MemorySystem } from '../../agentic/memory-system'
import prjctDb from '../../storage/database'

const TEST_PROJECT_ID = `test-mcp-pat-${Date.now()}`

describe('MCP Pattern Tools (backend)', () => {
  let memorySystem: MemorySystem

  beforeEach(() => {
    memorySystem = new MemorySystem()
    memorySystem.resetState()
  })

  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('decision record/get roundtrip', () => {
    it('should record and retrieve a decision', async () => {
      await memorySystem.learnDecision(
        TEST_PROJECT_ID,
        'test_framework',
        'bun:test',
        'Using bun for testing'
      )

      const value = await memorySystem.getSmartDecision(TEST_PROJECT_ID, 'test_framework')
      expect(value).toBe('bun:test')
    })

    it('should check session cache first', async () => {
      memorySystem.setSession('decision:cached_key', 'session_value')

      const value = await memorySystem.getSmartDecision(TEST_PROJECT_ID, 'cached_key')
      expect(value).toBe('session_value')
    })

    it('should return null for unknown decisions', async () => {
      const value = await memorySystem.getSmartDecision(TEST_PROJECT_ID, 'nonexistent_key')
      expect(value).toBeNull()
    })
  })

  describe('preference set/get roundtrip', () => {
    it('should set and retrieve a preference', async () => {
      await memorySystem.setPreference(TEST_PROJECT_ID, 'verbosity', 'concise', {
        userConfirmed: true,
      })

      const value = await memorySystem.getPreference(TEST_PROJECT_ID, 'verbosity')
      expect(value).toBe('concise')
    })

    it('should return default for unknown preferences', async () => {
      const value = await memorySystem.getPreference(TEST_PROJECT_ID, 'unknown_pref', 'default')
      expect(value).toBe('default')
    })

    it('should increase confidence on repeated observations', async () => {
      await memorySystem.setPreference(TEST_PROJECT_ID, 'indent', 'tabs')
      await memorySystem.setPreference(TEST_PROJECT_ID, 'indent', 'tabs')
      await memorySystem.setPreference(TEST_PROJECT_ID, 'indent', 'tabs')

      const value = await memorySystem.getPreference(TEST_PROJECT_ID, 'indent')
      expect(value).toBe('tabs')
    })
  })
})
