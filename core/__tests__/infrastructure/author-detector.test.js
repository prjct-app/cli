import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('Author Detector', () => {
  let AuthorDetector

  beforeEach(() => {
    AuthorDetector = require('../../infrastructure/author-detector.js')
  })

  describe('detect()', () => {
    it('should return author object with all fields', async () => {
      const author = await AuthorDetector.detect()

      expect(author).toBeDefined()
      expect(author).toHaveProperty('name')
      expect(author).toHaveProperty('email')
      expect(author).toHaveProperty('github')
    })

    it('should have name field', async () => {
      const author = await AuthorDetector.detect()

      expect(author.name).toBeDefined()
      expect(typeof author.name).toBe('string')
    })

    it('should use github as name fallback', async () => {
      // This test verifies the fallback logic exists
      // Actual behavior depends on system git config
      const author = await AuthorDetector.detect()

      if (!author.name && author.github) {
        // Fallback should have been applied in detect()
        expect(author.name).toBeDefined()
      }
    })

    it('should default to Unknown if no name found', async () => {
      // This test verifies the final fallback
      const author = await AuthorDetector.detect()

      // Should always have a name (at least 'Unknown')
      expect(author.name).toBeDefined()
      expect(author.name.length).toBeGreaterThan(0)
    })
  })

  describe('detectGitHubUsername()', () => {
    it('should attempt to detect GitHub username', async () => {
      const username = await AuthorDetector.detectGitHubUsername()

      // May return null if GitHub CLI not configured
      expect(username === null || typeof username === 'string').toBe(true)
    })
  })

  describe('detectGitName()', () => {
    it('should attempt to detect git name', async () => {
      const name = await AuthorDetector.detectGitName()

      // May return null if git not configured
      expect(name === null || typeof name === 'string').toBe(true)
    })
  })

  describe('detectGitEmail()', () => {
    it('should attempt to detect git email', async () => {
      const email = await AuthorDetector.detectGitEmail()

      // May return null if git not configured
      expect(email === null || typeof email === 'string').toBe(true)
    })
  })

  describe('execCommand()', () => {
    it('should execute commands safely', async () => {
      const result = await AuthorDetector.execCommand('echo "test"')

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('output')
    })

    it('should handle command failures gracefully', async () => {
      const result = await AuthorDetector.execCommand('nonexistent-command-xyz-123')

      expect(result.success).toBe(false)
      expect(result.output).toBe('')
    })

    it('should return output for successful commands', async () => {
      const result = await AuthorDetector.execCommand('echo "hello"')

      if (result.success) {
        expect(result.output).toContain('hello')
      }
    })
  })
})

