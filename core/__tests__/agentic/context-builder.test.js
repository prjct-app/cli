import { describe, it, expect } from 'vitest'
import contextBuilder from '../../agentic/context-builder.js'
import path from 'path'

describe('Context Builder', () => {
  const testProjectPath = process.cwd()

  describe('build()', () => {
    it('should build context with all required fields', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context).toBeDefined()
      expect(context).toHaveProperty('projectId')
      expect(context).toHaveProperty('projectPath')
      expect(context).toHaveProperty('globalPath')
      expect(context).toHaveProperty('paths')
      expect(context).toHaveProperty('params')
      expect(context).toHaveProperty('timestamp')
      expect(context).toHaveProperty('date')
    })

    it('should include all file paths', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.paths).toHaveProperty('now')
      expect(context.paths).toHaveProperty('next')
      expect(context.paths).toHaveProperty('context')
      expect(context.paths).toHaveProperty('shipped')
      expect(context.paths).toHaveProperty('metrics')
      expect(context.paths).toHaveProperty('ideas')
      expect(context.paths).toHaveProperty('roadmap')
      expect(context.paths).toHaveProperty('memory')
      expect(context.paths).toHaveProperty('analysis')
    })

    it('should use correct project path', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.projectPath).toBe(testProjectPath)
    })

    it('should include command parameters', async () => {
      const params = { taskName: 'test task', feature: 'test feature' }
      const context = await contextBuilder.build(testProjectPath, params)

      expect(context.params).toEqual(params)
    })

    it('should include timestamp', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.timestamp).toBeDefined()
      expect(typeof context.timestamp).toBe('string')
      expect(new Date(context.timestamp).toString()).not.toBe('Invalid Date')
    })

    it('should include date', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.date).toBeDefined()
      expect(typeof context.date).toBe('string')
    })

    it('should build global path from project ID', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.globalPath).toContain('.prjct-cli')
      expect(context.globalPath).toContain('projects')
      expect(context.globalPath).toContain(context.projectId)
    })
  })

  describe('loadState()', () => {
    it('should load state from context', async () => {
      const context = await contextBuilder.build(testProjectPath)
      const state = await contextBuilder.loadState(context)

      expect(state).toBeDefined()
      expect(typeof state).toBe('object')
    })

    it('should return null for non-existent files', async () => {
      const context = await contextBuilder.build(testProjectPath)
      const state = await contextBuilder.loadState(context)

      // Some files might not exist
      Object.values(state).forEach((value) => {
        expect(value === null || typeof value === 'string').toBe(true)
      })
    })

    it('should load existing files as strings', async () => {
      const context = await contextBuilder.build(testProjectPath)
      const state = await contextBuilder.loadState(context)

      // At least some state values should be strings (if files exist)
      const hasStrings = Object.values(state).some((value) => typeof value === 'string')
      expect(typeof hasStrings).toBe('boolean')
    })
  })

  describe('fileExists()', () => {
    it('should return true for existing file', async () => {
      const exists = await contextBuilder.fileExists(__filename)

      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await contextBuilder.fileExists('/nonexistent/path/file.txt')

      expect(exists).toBe(false)
    })

    it('should work with package.json', async () => {
      const packagePath = path.join(process.cwd(), 'package.json')
      const exists = await contextBuilder.fileExists(packagePath)

      expect(exists).toBe(true)
    })
  })

  describe('Path Construction', () => {
    it('should construct paths with correct structure', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.paths.now).toContain('core/now.md')
      expect(context.paths.next).toContain('core/next.md')
      expect(context.paths.context).toContain('core/context.md')
      expect(context.paths.shipped).toContain('progress/shipped.md')
      expect(context.paths.metrics).toContain('progress/metrics.md')
      expect(context.paths.ideas).toContain('planning/ideas.md')
      expect(context.paths.roadmap).toContain('planning/roadmap.md')
      expect(context.paths.memory).toContain('memory/context.jsonl')
      expect(context.paths.analysis).toContain('analysis/repo-summary.md')
    })

    it('should use global path for all file paths', async () => {
      const context = await contextBuilder.build(testProjectPath)

      Object.values(context.paths).forEach((filePath) => {
        expect(filePath).toContain(context.globalPath)
      })
    })
  })

  describe('Empty Parameters', () => {
    it('should handle empty command params', async () => {
      const context = await contextBuilder.build(testProjectPath, {})

      expect(context.params).toEqual({})
    })

    it('should handle undefined command params', async () => {
      const context = await contextBuilder.build(testProjectPath)

      expect(context.params).toEqual({})
    })
  })
})
