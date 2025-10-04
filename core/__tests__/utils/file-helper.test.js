import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fileHelper from '../../utils/file-helper.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('File Helper', () => {
  const testDir = path.join(os.tmpdir(), 'prjct-file-helper-test-' + Date.now())

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

  describe('readJson()', () => {
    it('should read and parse JSON file', async () => {
      const testFile = path.join(testDir, 'test.json')
      const data = { name: 'test', value: 123 }
      await fs.writeFile(testFile, JSON.stringify(data))

      const result = await fileHelper.readJson(testFile)

      expect(result).toEqual(data)
    })

    it('should return default value for non-existent file', async () => {
      const result = await fileHelper.readJson('/nonexistent/file.json', { default: true })

      expect(result).toEqual({ default: true })
    })

    it('should return null by default for non-existent file', async () => {
      const result = await fileHelper.readJson('/nonexistent/file.json')

      expect(result).toBeNull()
    })

    it('should handle complex JSON structures', async () => {
      const testFile = path.join(testDir, 'complex.json')
      const data = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        boolean: true,
        number: 42,
      }
      await fs.writeFile(testFile, JSON.stringify(data))

      const result = await fileHelper.readJson(testFile)

      expect(result).toEqual(data)
    })
  })

  describe('writeJson()', () => {
    it('should write JSON file with pretty formatting', async () => {
      const testFile = path.join(testDir, 'write.json')
      const data = { name: 'test', value: 123 }

      await fileHelper.writeJson(testFile, data)

      const content = await fs.readFile(testFile, 'utf-8')
      expect(JSON.parse(content)).toEqual(data)
      expect(content).toContain('\n') // Should be pretty-printed
    })

    it('should use custom indentation', async () => {
      const testFile = path.join(testDir, 'indent.json')
      const data = { key: 'value' }

      await fileHelper.writeJson(testFile, data, 4)

      const content = await fs.readFile(testFile, 'utf-8')
      expect(content).toContain('    ') // 4 spaces
    })

    it('should handle nested objects', async () => {
      const testFile = path.join(testDir, 'nested.json')
      const data = {
        level1: {
          level2: {
            level3: 'deep',
          },
        },
      }

      await fileHelper.writeJson(testFile, data)

      const result = await fileHelper.readJson(testFile)
      expect(result).toEqual(data)
    })
  })

  describe('readFile()', () => {
    it('should read text file', async () => {
      const testFile = path.join(testDir, 'text.txt')
      const content = 'Hello, World!'
      await fs.writeFile(testFile, content)

      const result = await fileHelper.readFile(testFile)

      expect(result).toBe(content)
    })

    it('should return default value for non-existent file', async () => {
      const result = await fileHelper.readFile('/nonexistent/file.txt', 'default content')

      expect(result).toBe('default content')
    })

    it('should return empty string by default', async () => {
      const result = await fileHelper.readFile('/nonexistent/file.txt')

      expect(result).toBe('')
    })

    it('should handle multi-line content', async () => {
      const testFile = path.join(testDir, 'multiline.txt')
      const content = 'Line 1\nLine 2\nLine 3'
      await fs.writeFile(testFile, content)

      const result = await fileHelper.readFile(testFile)

      expect(result).toBe(content)
    })
  })

  describe('writeFile()', () => {
    it('should write text file', async () => {
      const testFile = path.join(testDir, 'write.txt')
      const content = 'Test content'

      await fileHelper.writeFile(testFile, content)

      const result = await fs.readFile(testFile, 'utf-8')
      expect(result).toBe(content)
    })

    it('should overwrite existing file', async () => {
      const testFile = path.join(testDir, 'overwrite.txt')

      await fileHelper.writeFile(testFile, 'First')
      await fileHelper.writeFile(testFile, 'Second')

      const result = await fs.readFile(testFile, 'utf-8')
      expect(result).toBe('Second')
    })

    it('should create directory if needed', async () => {
      const nestedFile = path.join(testDir, 'nested', 'dir', 'file.txt')

      await fileHelper.writeFile(nestedFile, 'content')

      const exists = await fs
        .access(nestedFile)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('fileExists()', () => {
    it('should return true for existing file', async () => {
      const testFile = path.join(testDir, 'exists.txt')
      await fs.writeFile(testFile, 'content')

      const exists = await fileHelper.fileExists(testFile)

      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await fileHelper.fileExists('/nonexistent/file.txt')

      expect(exists).toBe(false)
    })

    it('should work with directories', async () => {
      const exists = await fileHelper.fileExists(testDir)

      expect(exists).toBe(true)
    })
  })

  describe('ensureDir()', () => {
    it('should create directory if not exists', async () => {
      const newDir = path.join(testDir, 'new', 'nested', 'dir')

      await fileHelper.ensureDir(newDir)

      const exists = await fs
        .access(newDir)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('should not fail if directory exists', async () => {
      await fileHelper.ensureDir(testDir)

      // Should not throw
      await expect(fileHelper.ensureDir(testDir)).resolves.not.toThrow()
    })
  })

  describe('Integration', () => {
    it('should read and write JSON files', async () => {
      const testFile = path.join(testDir, 'integration.json')
      const data = { test: 'data', number: 42 }

      await fileHelper.writeJson(testFile, data)
      const result = await fileHelper.readJson(testFile)

      expect(result).toEqual(data)
    })

    it('should handle file operations pipeline', async () => {
      const testFile = path.join(testDir, 'pipeline.txt')

      // Write
      await fileHelper.writeFile(testFile, 'original')

      // Check exists
      const exists = await fileHelper.fileExists(testFile)
      expect(exists).toBe(true)

      // Read
      const content = await fileHelper.readFile(testFile)
      expect(content).toBe('original')

      // Update
      await fileHelper.writeFile(testFile, 'updated')

      // Read again
      const updated = await fileHelper.readFile(testFile)
      expect(updated).toBe('updated')
    })

    it('should create nested structure and write files', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3')
      const nestedFile = path.join(nestedDir, 'deep.json')

      await fileHelper.ensureDir(nestedDir)
      await fileHelper.writeJson(nestedFile, { deep: true })

      const result = await fileHelper.readJson(nestedFile)
      expect(result).toEqual({ deep: true })
    })
  })
})
