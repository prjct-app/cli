/**
 * Dependency Validator Tests
 * Tests for graceful degradation when system dependencies are missing
 *
 * @see PRJ-114
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import { DependencyError, dependencyValidator, TOOLS } from '../../services/dependency-validator'

describe('DependencyValidator', () => {
  beforeEach(() => {
    // Clear cache before each test
    dependencyValidator.clearCache()
  })

  describe('checkTool', () => {
    it('should return available: true for installed tools (git)', () => {
      const result = dependencyValidator.checkTool('git')
      expect(result.available).toBe(true)
      expect(result.version).toBeDefined()
    })

    it('should return available: true for installed tools (node)', () => {
      const result = dependencyValidator.checkTool('node')
      expect(result.available).toBe(true)
      expect(result.version).toBeDefined()
    })

    it('should return available: false for non-existent tools', () => {
      const result = dependencyValidator.checkTool('definitely-not-a-real-tool-xyz123')
      expect(result.available).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('not installed')
    })

    it('should cache results', () => {
      const result1 = dependencyValidator.checkTool('git')
      const result2 = dependencyValidator.checkTool('git')
      // Same object reference means cached
      expect(result1).toBe(result2)
    })
  })

  describe('isAvailable', () => {
    it('should return true for available tools', () => {
      expect(dependencyValidator.isAvailable('git')).toBe(true)
      expect(dependencyValidator.isAvailable('node')).toBe(true)
    })

    it('should return false for unavailable tools', () => {
      expect(dependencyValidator.isAvailable('fake-tool-abc')).toBe(false)
    })
  })

  describe('getVersion', () => {
    it('should return version string for available tools', () => {
      const version = dependencyValidator.getVersion('git')
      expect(version).toBeDefined()
      expect(typeof version).toBe('string')
      // Git version is like "2.39.0" or similar
      expect(version).toMatch(/^\d+\.\d+/)
    })

    it('should return undefined for unavailable tools', () => {
      const version = dependencyValidator.getVersion('fake-tool-xyz')
      expect(version).toBeUndefined()
    })
  })

  describe('ensureTool', () => {
    it('should not throw for available tools', () => {
      expect(() => dependencyValidator.ensureTool('git')).not.toThrow()
      expect(() => dependencyValidator.ensureTool('node')).not.toThrow()
    })

    it('should throw DependencyError for unavailable tools', () => {
      expect(() => dependencyValidator.ensureTool('fake-tool-xyz')).toThrow(DependencyError)
    })

    it('should include helpful hint in error', () => {
      try {
        dependencyValidator.ensureTool('fake-tool-xyz')
      } catch (error) {
        expect(error).toBeInstanceOf(DependencyError)
        expect((error as DependencyError).hint).toBeDefined()
      }
    })
  })

  describe('ensureTools', () => {
    it('should not throw when all tools are available', () => {
      expect(() => dependencyValidator.ensureTools(['git', 'node'])).not.toThrow()
    })

    it('should throw when any tool is unavailable', () => {
      expect(() => dependencyValidator.ensureTools(['git', 'fake-tool-xyz'])).toThrow(
        DependencyError
      )
    })

    it('should list all missing tools in error', () => {
      try {
        dependencyValidator.ensureTools(['fake-tool-1', 'fake-tool-2'])
      } catch (error) {
        expect(error).toBeInstanceOf(DependencyError)
        expect((error as DependencyError).message).toContain('fake-tool-1')
        expect((error as DependencyError).message).toContain('fake-tool-2')
      }
    })
  })

  describe('checkAll', () => {
    it('should return status for all default tools', () => {
      const results = dependencyValidator.checkAll()
      expect(results.size).toBeGreaterThan(0)
      expect(results.has('git')).toBe(true)
      expect(results.has('node')).toBe(true)
    })

    it('should return status for specified tools', () => {
      const results = dependencyValidator.checkAll(['git', 'node'])
      expect(results.size).toBe(2)
      expect(results.get('git')?.available).toBe(true)
      expect(results.get('node')?.available).toBe(true)
    })
  })

  describe('clearCache', () => {
    it('should clear cached results', () => {
      const result1 = dependencyValidator.checkTool('git')
      dependencyValidator.clearCache()
      const result2 = dependencyValidator.checkTool('git')
      // Different object reference after cache clear
      expect(result1).not.toBe(result2)
    })
  })

  describe('TOOLS definitions', () => {
    it('should have required tools marked as required', () => {
      expect(TOOLS.git.required).toBe(true)
      expect(TOOLS.node.required).toBe(true)
    })

    it('should have optional tools marked as not required', () => {
      expect(TOOLS.bun.required).toBe(false)
      expect(TOOLS.gh.required).toBe(false)
    })

    it('should have install hints for all tools', () => {
      for (const tool of Object.values(TOOLS)) {
        expect(tool.installHint).toBeDefined()
        expect(tool.installHint.length).toBeGreaterThan(0)
      }
    })
  })

  describe('DependencyError', () => {
    it('should have correct name', () => {
      const error = new DependencyError({ message: 'test' })
      expect(error.name).toBe('DependencyError')
    })

    it('should preserve hint and docs', () => {
      const error = new DependencyError({
        message: 'Tool not found',
        hint: 'Install it',
        docs: 'https://example.com',
      })
      expect(error.message).toBe('Tool not found')
      expect(error.hint).toBe('Install it')
      expect(error.docs).toBe('https://example.com')
    })
  })
})
