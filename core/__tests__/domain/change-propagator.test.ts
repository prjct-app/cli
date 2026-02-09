import { describe, expect, test } from 'bun:test'
import { affectedDomains, propagateChanges } from '../../domain/change-propagator'
import type { FileDiff } from '../../domain/file-hasher'

describe('change-propagator', () => {
  // =========================================================================
  // propagateChanges
  // =========================================================================

  describe('propagateChanges', () => {
    test('returns direct changes when no import graph exists', () => {
      const diff: FileDiff = {
        added: ['src/new.ts'],
        modified: ['src/changed.ts'],
        deleted: ['src/removed.ts'],
        unchanged: ['src/same.ts'],
      }

      // Use a fake projectId that won't have a graph
      const result = propagateChanges(diff, 'nonexistent-project')

      expect(result.directlyChanged).toEqual(['src/new.ts', 'src/changed.ts'])
      expect(result.affectedByImports).toEqual([])
      expect(result.allAffected).toEqual(['src/new.ts', 'src/changed.ts'])
      expect(result.deleted).toEqual(['src/removed.ts'])
    })

    test('empty diff returns empty propagation', () => {
      const diff: FileDiff = {
        added: [],
        modified: [],
        deleted: [],
        unchanged: ['src/a.ts', 'src/b.ts'],
      }

      const result = propagateChanges(diff, 'nonexistent-project')

      expect(result.directlyChanged).toEqual([])
      expect(result.affectedByImports).toEqual([])
      expect(result.allAffected).toEqual([])
    })
  })

  // =========================================================================
  // affectedDomains
  // =========================================================================

  describe('affectedDomains', () => {
    test('detects frontend files', () => {
      const domains = affectedDomains([
        'src/components/Button.tsx',
        'src/pages/Home.jsx',
        'styles/main.css',
      ])
      expect(domains.has('frontend')).toBe(true)
      expect(domains.has('uxui')).toBe(true)
    })

    test('detects backend files', () => {
      const domains = affectedDomains(['core/services/auth.ts', 'core/domain/user.ts'])
      expect(domains.has('backend')).toBe(true)
    })

    test('detects testing files', () => {
      const domains = affectedDomains([
        'core/__tests__/auth.test.ts',
        'src/components/Button.spec.tsx',
      ])
      expect(domains.has('testing')).toBe(true)
    })

    test('detects devops files', () => {
      const domains = affectedDomains(['Dockerfile', '.github/workflows/ci.yml'])
      expect(domains.has('devops')).toBe(true)
    })

    test('detects database files', () => {
      const domains = affectedDomains(['prisma/schema.prisma', 'db/migrations/001.sql'])
      expect(domains.has('database')).toBe(true)
    })

    test('handles mixed domain files', () => {
      const domains = affectedDomains([
        'src/components/Form.tsx', // frontend + uxui
        'core/services/api.ts', // backend
        'Dockerfile', // devops
        'core/__tests__/api.test.ts', // testing + backend
      ])
      expect(domains.has('frontend')).toBe(true)
      expect(domains.has('backend')).toBe(true)
      expect(domains.has('devops')).toBe(true)
      expect(domains.has('testing')).toBe(true)
    })

    test('empty file list returns empty domains', () => {
      const domains = affectedDomains([])
      expect(domains.size).toBe(0)
    })
  })
})
