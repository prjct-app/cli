/**
 * Code Intelligence Tools Tests
 *
 * Tests import graph, co-change, impact analysis, and related context backends.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { affectedDomains, propagateChanges } from '../../domain/change-propagator'
import { loadMatrix, saveMatrix, scoreFromSeeds } from '../../domain/git-cochange'
import { loadGraph, saveGraph } from '../../domain/import-graph'
import prjctDb from '../../storage/database'
import type { ImportGraph } from '../../types/domain.js'

const TEST_PROJECT_ID = `test-mcp-codeintel-${Date.now()}`

const TEST_GRAPH: ImportGraph = {
  forward: {
    'src/auth.ts': ['src/db.ts', 'src/config.ts'],
    'src/user-service.ts': ['src/auth.ts', 'src/db.ts'],
    'src/api.ts': ['src/user-service.ts'],
  },
  reverse: {
    'src/db.ts': ['src/auth.ts', 'src/user-service.ts'],
    'src/config.ts': ['src/auth.ts'],
    'src/auth.ts': ['src/user-service.ts'],
    'src/user-service.ts': ['src/api.ts'],
  },
  fileCount: 5,
  edgeCount: 5,
  builtAt: new Date().toISOString(),
}

describe('MCP Code Intelligence Tools (backend)', () => {
  afterAll(() => {
    prjctDb.close(TEST_PROJECT_ID)
  })

  describe('propagateChanges', () => {
    it('should find affected files via import graph', () => {
      saveGraph(TEST_PROJECT_ID, TEST_GRAPH)

      const diff = {
        added: [],
        modified: ['src/auth.ts'],
        deleted: [],
        unchanged: [],
      }

      const result = propagateChanges(diff, TEST_PROJECT_ID)

      expect(result.directlyChanged).toEqual(['src/auth.ts'])
      expect(result.affectedByImports).toContain('src/user-service.ts')
      expect(result.allAffected.length).toBeGreaterThan(1)
    })

    it('should return only direct changes when no graph exists', () => {
      const diff = {
        added: [],
        modified: ['src/new-file.ts'],
        deleted: [],
        unchanged: [],
      }

      const result = propagateChanges(diff, `nonexistent-${Date.now()}`)

      expect(result.directlyChanged).toEqual(['src/new-file.ts'])
      expect(result.affectedByImports).toEqual([])
    })
  })

  describe('affectedDomains', () => {
    it('should detect frontend domains', () => {
      const domains = affectedDomains(['src/components/Button.tsx', 'src/app.css'])
      expect(domains.has('frontend')).toBe(true)
    })

    it('should detect backend domains', () => {
      const domains = affectedDomains(['src/server.ts'])
      expect(domains.has('backend')).toBe(true)
    })

    it('should detect testing domains', () => {
      const domains = affectedDomains(['src/__tests__/auth.test.ts'])
      expect(domains.has('testing')).toBe(true)
    })

    it('should detect multiple domains', () => {
      const domains = affectedDomains(['src/components/Login.tsx', 'src/auth.ts', 'Dockerfile'])
      expect(domains.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('import graph load/save', () => {
    it('should roundtrip graph through SQLite', () => {
      saveGraph(TEST_PROJECT_ID, TEST_GRAPH)
      const loaded = loadGraph(TEST_PROJECT_ID)

      expect(loaded).not.toBeNull()
      expect(loaded!.fileCount).toBe(5)
      expect(loaded!.edgeCount).toBe(5)
      expect(loaded!.forward['src/auth.ts']).toEqual(['src/db.ts', 'src/config.ts'])
    })
  })

  describe('co-change scoring', () => {
    it('should find co-change partners from seed files', () => {
      const index = {
        matrix: {
          'src/auth.ts': { 'src/middleware.ts': 0.8, 'src/config.ts': 0.3 },
          'src/middleware.ts': { 'src/auth.ts': 0.8 },
          'src/config.ts': { 'src/auth.ts': 0.3 },
        },
        commitsAnalyzed: 50,
        filesAnalyzed: 20,
        builtAt: new Date().toISOString(),
      }

      saveMatrix(TEST_PROJECT_ID, index)
      const loaded = loadMatrix(TEST_PROJECT_ID)
      expect(loaded).not.toBeNull()

      const scores = scoreFromSeeds(['src/auth.ts'], loaded!)
      expect(scores.length).toBeGreaterThan(0)
      expect(scores[0].path).toBe('src/middleware.ts')
      expect(scores[0].score).toBe(0.8)
    })

    it('should return empty for unknown seed files', () => {
      const index = {
        matrix: {},
        commitsAnalyzed: 10,
        filesAnalyzed: 5,
        builtAt: new Date().toISOString(),
      }

      const scores = scoreFromSeeds(['unknown-file.ts'], index)
      expect(scores).toEqual([])
    })
  })
})
