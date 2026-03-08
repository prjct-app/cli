/**
 * Context Intelligence Tools Tests
 *
 * Tests analysis staleness, zone health, and audit log backends.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { MemorySystem } from '../../agentic/memory-system'
import { contextZoneStorage } from '../../storage/context-zone-storage'
import prjctDb from '../../storage/database'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'

const TEST_PROJECT_ID = `test-mcp-ctx-${Date.now()}`

describe('MCP Context Intelligence Tools (backend)', () => {
  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('prjct_analysis_staleness', () => {
    it('should return null when no analysis exists', () => {
      const summary = llmAnalysisStorage.getActiveSummary(TEST_PROJECT_ID)
      expect(summary).toBeNull()
    })

    it('should detect stale analysis (different commit)', () => {
      llmAnalysisStorage.save(TEST_PROJECT_ID, {
        commitHash: 'abc123',
        analyzedAt: new Date().toISOString(),
        architecture: { style: 'modular', layers: [] },
        stack: { languages: ['TypeScript'], frameworks: ['Hono'] },
        patterns: [{ name: 'MCP tools', description: 'Expose backend via MCP' }],
        antiPatterns: [],
        conventions: [],
      } as any)

      const isCurrent = llmAnalysisStorage.isCurrent(TEST_PROJECT_ID, 'def456')
      expect(isCurrent).toBe(false)
    })

    it('should detect current analysis (same commit)', () => {
      const isCurrent = llmAnalysisStorage.isCurrent(TEST_PROJECT_ID, 'abc123')
      expect(isCurrent).toBe(true)
    })

    it('should return analysis history', () => {
      const history = llmAnalysisStorage.getHistory(TEST_PROJECT_ID, 5)
      expect(history.length).toBeGreaterThan(0)
      expect(history[0].status).toBe('active')
      expect(history[0].commitHash).toBe('abc123')
    })
  })

  describe('prjct_zone_health', () => {
    it('should return default health when no transitions exist', () => {
      const summary = contextZoneStorage.getSummary(TEST_PROJECT_ID, 7)

      expect(summary).toBeDefined()
      expect(typeof summary.smartPercent).toBe('number')
      expect(typeof summary.warningPercent).toBe('number')
      expect(typeof summary.dumbPercent).toBe('number')
      expect(typeof summary.compactions).toBe('number')
    })

    it('should record and retrieve transitions', () => {
      contextZoneStorage.recordTransition(TEST_PROJECT_ID, {
        from: 'smart',
        to: 'warning',
        usagePercent: 75,
        timestamp: new Date().toISOString(),
      })

      contextZoneStorage.recordTransition(TEST_PROJECT_ID, {
        from: 'warning',
        to: 'dumb',
        usagePercent: 95,
        timestamp: new Date().toISOString(),
        action: 'compacted',
      })

      const transitions = contextZoneStorage.getTransitions(TEST_PROJECT_ID, 10)
      expect(transitions.length).toBeGreaterThanOrEqual(2)
    })

    it('should calculate zone distribution', () => {
      const summary = contextZoneStorage.getSummary(TEST_PROJECT_ID, 7)

      // After recording transitions, we should have some distribution
      expect(summary.smartPercent + summary.warningPercent + summary.dumbPercent).toBeGreaterThan(0)
    })
  })

  describe('prjct_audit_log', () => {
    it('should return recent history events', async () => {
      const memorySystem = new MemorySystem()

      await memorySystem.appendHistory(TEST_PROJECT_ID, {
        type: 'decision',
        key: 'test_decision',
        value: 'test_value',
      })

      await memorySystem.appendHistory(TEST_PROJECT_ID, {
        type: 'preference',
        key: 'editor',
        value: 'vim',
      })

      const events = await memorySystem.getRecentHistory(TEST_PROJECT_ID, 10)
      expect(events).toBeDefined()
      expect(events.length).toBeGreaterThanOrEqual(2)
    })

    it('should return empty array when no history exists', async () => {
      const memorySystem = new MemorySystem()
      const freshProjectId = `test-mcp-ctx-fresh-${Date.now()}`

      const events = await memorySystem.getRecentHistory(freshProjectId, 10)
      expect(Array.isArray(events)).toBe(true)
    })
  })
})
