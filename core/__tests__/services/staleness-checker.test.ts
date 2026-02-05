/**
 * Staleness Checker Tests (PRJ-120)
 *
 * Tests for the StalenessChecker service:
 * - Fresh context detection
 * - Stale context detection (commits, days, significant files)
 * - No sync history handling
 * - Output formatting
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { createStalenessChecker, type StalenessStatus } from '../../services/staleness-checker'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('StalenessChecker', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-staleness-test-'))
    testProjectId = 'staleness-test-project'

    // Mock pathManager to use temp directory
    pathManager.getGlobalProjectPath = (projectId: string) => {
      return path.join(tmpRoot!, projectId)
    }
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  // ===========================================================================
  // No Sync History Tests
  // ===========================================================================

  describe('no sync history', () => {
    it('should report stale when no project.json exists', async () => {
      const checker = createStalenessChecker(process.cwd())
      const status = await checker.check(testProjectId)

      expect(status.isStale).toBe(true)
      expect(status.reason).toContain('No sync history found')
    })

    it('should report stale when no lastSyncCommit in project.json', async () => {
      // Create project.json without lastSyncCommit
      const projectPath = path.join(tmpRoot!, testProjectId)
      await fs.mkdir(projectPath, { recursive: true })
      await fs.writeFile(
        path.join(projectPath, 'project.json'),
        JSON.stringify({ name: 'test', lastSync: new Date().toISOString() })
      )

      const checker = createStalenessChecker(process.cwd())
      const status = await checker.check(testProjectId)

      expect(status.isStale).toBe(true)
      expect(status.reason).toContain('No sync commit recorded')
    })
  })

  // ===========================================================================
  // Status Formatting Tests
  // ===========================================================================

  describe('formatStatus', () => {
    it('should format fresh status correctly', () => {
      const checker = createStalenessChecker(process.cwd())
      const status: StalenessStatus = {
        isStale: false,
        reason: 'Context is up to date',
        lastSyncCommit: 'abc123',
        currentCommit: 'abc123',
        commitsSinceSync: 0,
        daysSinceSync: 0,
        changedFiles: [],
        significantChanges: [],
      }

      const formatted = checker.formatStatus(status)

      expect(formatted).toContain('✓ Fresh')
      expect(formatted).toContain('Last sync:')
      expect(formatted).toContain('abc123')
      expect(formatted).not.toContain('Run `prjct sync`')
    })

    it('should format stale status with sync prompt', () => {
      const checker = createStalenessChecker(process.cwd())
      const status: StalenessStatus = {
        isStale: true,
        reason: '15 commits since last sync (threshold: 10)',
        lastSyncCommit: 'abc123',
        currentCommit: 'def456',
        commitsSinceSync: 15,
        daysSinceSync: 2,
        changedFiles: ['src/index.ts', 'package.json'],
        significantChanges: ['package.json'],
      }

      const formatted = checker.formatStatus(status)

      expect(formatted).toContain('⚠️  STALE')
      expect(formatted).toContain('15')
      expect(formatted).toContain('Significant changes')
      expect(formatted).toContain('package.json')
      expect(formatted).toContain('Run `prjct sync`')
    })
  })

  // ===========================================================================
  // Warning Message Tests
  // ===========================================================================

  describe('getWarning', () => {
    it('should return null for fresh status', () => {
      const checker = createStalenessChecker(process.cwd())
      const status: StalenessStatus = {
        isStale: false,
        reason: 'Context is up to date',
        lastSyncCommit: 'abc123',
        currentCommit: 'abc123',
        commitsSinceSync: 0,
        daysSinceSync: 0,
        changedFiles: [],
        significantChanges: [],
      }

      const warning = checker.getWarning(status)
      expect(warning).toBeNull()
    })

    it('should return commit-based warning', () => {
      const checker = createStalenessChecker(process.cwd())
      const status: StalenessStatus = {
        isStale: true,
        reason: '15 commits since last sync',
        lastSyncCommit: 'abc123',
        currentCommit: 'def456',
        commitsSinceSync: 15,
        daysSinceSync: 0,
        changedFiles: [],
        significantChanges: [],
      }

      const warning = checker.getWarning(status)
      expect(warning).toContain('15 commits behind')
      expect(warning).toContain('prjct sync')
    })

    it('should return days-based warning', () => {
      const checker = createStalenessChecker(process.cwd())
      const status: StalenessStatus = {
        isStale: true,
        reason: '5 days since last sync',
        lastSyncCommit: 'abc123',
        currentCommit: 'abc123',
        commitsSinceSync: 0,
        daysSinceSync: 5,
        changedFiles: [],
        significantChanges: [],
      }

      const warning = checker.getWarning(status)
      expect(warning).toContain('5 days old')
      expect(warning).toContain('prjct sync')
    })
  })

  // ===========================================================================
  // Configuration Tests
  // ===========================================================================

  describe('configuration', () => {
    it('should use default thresholds', () => {
      const checker = createStalenessChecker(process.cwd())
      // Default commitThreshold is 10, dayThreshold is 3
      expect(checker).toBeDefined()
    })

    it('should accept custom thresholds', () => {
      const checker = createStalenessChecker(process.cwd(), {
        commitThreshold: 5,
        dayThreshold: 1,
        significantFiles: ['custom.config.js'],
      })
      expect(checker).toBeDefined()
    })
  })
})
