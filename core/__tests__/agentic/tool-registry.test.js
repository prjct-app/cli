import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import toolRegistry from '../../agentic/tool-registry.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('Tool Registry', () => {
  const testDir = path.join(os.tmpdir(), 'prjct-test-' + Date.now())
  const testFile = path.join(testDir, 'test.txt')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('get()', () => {
    it('should get Read tool', () => {
      const tool = toolRegistry.get('Read')

      expect(tool).toBeDefined()
      expect(typeof tool).toBe('function')
    })

    it('should get Write tool', () => {
      const tool = toolRegistry.get('Write')

      expect(tool).toBeDefined()
      expect(typeof tool).toBe('function')
    })

    it('should get Bash tool', () => {
      const tool = toolRegistry.get('Bash')

      expect(tool).toBeDefined()
      expect(typeof tool).toBe('function')
    })

    it('should get Exec tool (alias for Bash)', () => {
      const tool = toolRegistry.get('Exec')

      expect(tool).toBeDefined()
      expect(typeof tool).toBe('function')
    })

    it('should throw error for unknown tool', () => {
      expect(() => toolRegistry.get('UnknownTool')).toThrow('Unknown tool: UnknownTool')
    })
  })

  describe('isAllowed()', () => {
    it('should return true for allowed tool', () => {
      const allowed = toolRegistry.isAllowed('Read', ['Read', 'Write', 'Bash'])

      expect(allowed).toBe(true)
    })

    it('should return false for disallowed tool', () => {
      const allowed = toolRegistry.isAllowed('Exec', ['Read', 'Write'])

      expect(allowed).toBe(false)
    })

    it('should handle empty allowed list', () => {
      const allowed = toolRegistry.isAllowed('Read', [])

      expect(allowed).toBe(false)
    })
  })

  describe('read()', () => {
    it('should read file content', async () => {
      const content = 'Test content for reading'
      await fs.writeFile(testFile, content)

      const result = await toolRegistry.read(testFile)

      expect(result).toBe(content)
    })

    it('should return null for non-existent file', async () => {
      const result = await toolRegistry.read('/nonexistent/file.txt')

      expect(result).toBeNull()
    })

    it('should read UTF-8 encoded content', async () => {
      const content = 'UTF-8: ñ é ü 中文 日本語'
      await fs.writeFile(testFile, content)

      const result = await toolRegistry.read(testFile)

      expect(result).toBe(content)
    })
  })

  describe('write()', () => {
    it('should write file content', async () => {
      const content = 'Test content for writing'

      await toolRegistry.write(testFile, content)

      const result = await fs.readFile(testFile, 'utf-8')
      expect(result).toBe(content)
    })

    it('should create directory if not exists', async () => {
      const nestedFile = path.join(testDir, 'nested', 'dir', 'file.txt')
      const content = 'Nested content'

      await toolRegistry.write(nestedFile, content)

      const result = await fs.readFile(nestedFile, 'utf-8')
      expect(result).toBe(content)
    })

    it('should overwrite existing file', async () => {
      await toolRegistry.write(testFile, 'First content')
      await toolRegistry.write(testFile, 'Second content')

      const result = await fs.readFile(testFile, 'utf-8')
      expect(result).toBe('Second content')
    })
  })

  describe('bash()', () => {
    it('should execute simple command', async () => {
      const result = await toolRegistry.bash('echo "hello"')

      expect(result.stdout).toContain('hello')
      expect(result.stderr).toBe('')
    })

    it('should return stdout and stderr', async () => {
      const result = await toolRegistry.bash('echo "output"')

      expect(result).toHaveProperty('stdout')
      expect(result).toHaveProperty('stderr')
    })

    it('should handle command errors', async () => {
      const result = await toolRegistry.bash('invalid-command-xyz-123')

      expect(result.error).toBe(true)
      expect(result.stderr).toBeTruthy()
    })

    it('should execute pwd command', async () => {
      const result = await toolRegistry.bash('pwd')

      expect(result.stdout).toBeTruthy()
      expect(result.stderr).toBe('')
    })
  })

  describe('exists()', () => {
    it('should return true for existing file', async () => {
      await fs.writeFile(testFile, 'content')

      const exists = await toolRegistry.exists(testFile)

      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await toolRegistry.exists('/nonexistent/file.txt')

      expect(exists).toBe(false)
    })

    it('should work with directories', async () => {
      const exists = await toolRegistry.exists(testDir)

      expect(exists).toBe(true)
    })
  })

  describe('list()', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2')

      const files = await toolRegistry.list(testDir)

      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })

    it('should return empty array for non-existent directory', async () => {
      const files = await toolRegistry.list('/nonexistent/directory')

      expect(files).toEqual([])
    })

    it('should list empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty')
      await fs.mkdir(emptyDir)

      const files = await toolRegistry.list(emptyDir)

      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(0)
    })
  })

  describe('Integration', () => {
    it('should write and then read file', async () => {
      const content = 'Integration test content'

      await toolRegistry.write(testFile, content)
      const result = await toolRegistry.read(testFile)

      expect(result).toBe(content)
    })

    it('should check existence, write, and list', async () => {
      const newFile = path.join(testDir, 'integration.txt')

      // Check doesn't exist
      const existsBefore = await toolRegistry.exists(newFile)
      expect(existsBefore).toBe(false)

      // Write
      await toolRegistry.write(newFile, 'content')

      // Check exists
      const existsAfter = await toolRegistry.exists(newFile)
      expect(existsAfter).toBe(true)

      // List directory
      const files = await toolRegistry.list(testDir)
      expect(files).toContain('integration.txt')
    })
  })
})
