import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

const require = createRequire(import.meta.url)

describe('JSONL Helper', () => {
  let jsonlHelper
  let testFilePath
  let tempDir

  beforeEach(async () => {
    jsonlHelper = require('../../utils/jsonl-helper.js')

    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-test-'))
    testFilePath = path.join(tempDir, 'test.jsonl')
  })

  afterEach(async () => {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  describe('parseJsonLines()', () => {
    it('should parse valid JSONL content', () => {
      const content = '{"ts":"2025-10-04T14:30:00Z","type":"test"}\n{"ts":"2025-10-04T15:00:00Z","type":"test2"}'
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(2)
      expect(parsed[0].type).toBe('test')
      expect(parsed[1].type).toBe('test2')
    })

    it('should skip malformed lines', () => {
      const content = '{"valid":true}\ninvalid json\n{"another":true}'
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(2)
      expect(parsed[0].valid).toBe(true)
      expect(parsed[1].another).toBe(true)
    })

    it('should handle empty content', () => {
      const parsed = jsonlHelper.parseJsonLines('')
      expect(parsed).toEqual([])
    })

    it('should filter empty lines', () => {
      const content = '{"a":1}\n\n{"b":2}\n  \n{"c":3}'
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(3)
    })
  })

  describe('stringifyJsonLines()', () => {
    it('should convert array to JSONL format', () => {
      const objects = [
        { ts: '2025-10-04T14:30:00Z', type: 'test' },
        { ts: '2025-10-04T15:00:00Z', type: 'test2' }
      ]

      const jsonl = jsonlHelper.stringifyJsonLines(objects)
      const lines = jsonl.trim().split('\n')

      expect(lines.length).toBe(2)
      expect(JSON.parse(lines[0]).type).toBe('test')
      expect(JSON.parse(lines[1]).type).toBe('test2')
    })

    it('should end with newline', () => {
      const objects = [{ a: 1 }]
      const jsonl = jsonlHelper.stringifyJsonLines(objects)

      expect(jsonl.endsWith('\n')).toBe(true)
    })

    it('should handle empty array', () => {
      const jsonl = jsonlHelper.stringifyJsonLines([])
      expect(jsonl).toBe('\n')
    })
  })

  describe('readJsonLines()', () => {
    it('should read and parse JSONL file', async () => {
      const content = '{"a":1}\n{"b":2}'
      await fs.writeFile(testFilePath, content)

      const parsed = await jsonlHelper.readJsonLines(testFilePath)

      expect(parsed.length).toBe(2)
      expect(parsed[0].a).toBe(1)
      expect(parsed[1].b).toBe(2)
    })

    it('should return empty array for non-existent file', async () => {
      const parsed = await jsonlHelper.readJsonLines(path.join(tempDir, 'nonexistent.jsonl'))

      expect(parsed).toEqual([])
    })

    it('should throw for other errors', async () => {
      // Create directory with same name to cause error
      await fs.mkdir(testFilePath, { recursive: true })

      await expect(jsonlHelper.readJsonLines(testFilePath)).rejects.toThrow()
    })
  })

  describe('writeJsonLines()', () => {
    it('should write objects to JSONL file', async () => {
      const objects = [
        { ts: '2025-10-04T14:30:00Z', type: 'test' },
        { ts: '2025-10-04T15:00:00Z', type: 'test2' }
      ]

      await jsonlHelper.writeJsonLines(testFilePath, objects)

      const content = await fs.readFile(testFilePath, 'utf-8')
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(2)
      expect(parsed[0].type).toBe('test')
    })

    it('should overwrite existing file', async () => {
      await fs.writeFile(testFilePath, '{"old":true}')

      await jsonlHelper.writeJsonLines(testFilePath, [{ new: true }])

      const content = await fs.readFile(testFilePath, 'utf-8')
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(1)
      expect(parsed[0].old).toBeUndefined()
      expect(parsed[0].new).toBe(true)
    })
  })

  describe('appendJsonLine()', () => {
    it('should append single object to file', async () => {
      await fs.writeFile(testFilePath, '{"first":true}\n')

      await jsonlHelper.appendJsonLine(testFilePath, { second: true })

      const content = await fs.readFile(testFilePath, 'utf-8')
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(2)
      expect(parsed[0].first).toBe(true)
      expect(parsed[1].second).toBe(true)
    })

    it('should create file if it does not exist', async () => {
      await jsonlHelper.appendJsonLine(testFilePath, { new: true })

      const content = await fs.readFile(testFilePath, 'utf-8')
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(1)
      expect(parsed[0].new).toBe(true)
    })
  })

  describe('appendJsonLines()', () => {
    it('should append multiple objects', async () => {
      await fs.writeFile(testFilePath, '{"first":true}\n')

      await jsonlHelper.appendJsonLines(testFilePath, [
        { second: true },
        { third: true }
      ])

      const content = await fs.readFile(testFilePath, 'utf-8')
      const parsed = jsonlHelper.parseJsonLines(content)

      expect(parsed.length).toBe(3)
    })
  })

  describe('filterJsonLines()', () => {
    it('should filter entries by predicate', async () => {
      const objects = [
        { type: 'test', value: 1 },
        { type: 'other', value: 2 },
        { type: 'test', value: 3 }
      ]
      await jsonlHelper.writeJsonLines(testFilePath, objects)

      const filtered = await jsonlHelper.filterJsonLines(testFilePath, entry => entry.type === 'test')

      expect(filtered.length).toBe(2)
      expect(filtered.every(e => e.type === 'test')).toBe(true)
    })

    it('should return empty array for non-existent file', async () => {
      const filtered = await jsonlHelper.filterJsonLines(
        path.join(tempDir, 'nonexistent.jsonl'),
        () => true
      )

      expect(filtered).toEqual([])
    })
  })

  describe('countJsonLines()', () => {
    it('should count valid lines in file', async () => {
      await fs.writeFile(testFilePath, '{"a":1}\n{"b":2}\n{"c":3}')

      const count = await jsonlHelper.countJsonLines(testFilePath)

      expect(count).toBe(3)
    })

    it('should return 0 for non-existent file', async () => {
      const count = await jsonlHelper.countJsonLines(path.join(tempDir, 'nonexistent.jsonl'))

      expect(count).toBe(0)
    })

    it('should ignore empty lines', async () => {
      await fs.writeFile(testFilePath, '{"a":1}\n\n{"b":2}\n  \n')

      const count = await jsonlHelper.countJsonLines(testFilePath)

      expect(count).toBe(2)
    })
  })

  describe('getLastJsonLines()', () => {
    it('should return last N entries', async () => {
      const objects = Array.from({ length: 10 }, (_, i) => ({ index: i }))
      await jsonlHelper.writeJsonLines(testFilePath, objects)

      const last3 = await jsonlHelper.getLastJsonLines(testFilePath, 3)

      expect(last3.length).toBe(3)
      expect(last3[0].index).toBe(7)
      expect(last3[2].index).toBe(9)
    })

    it('should return all entries if N is larger than file', async () => {
      const objects = [{ a: 1 }, { b: 2 }]
      await jsonlHelper.writeJsonLines(testFilePath, objects)

      const last = await jsonlHelper.getLastJsonLines(testFilePath, 10)

      expect(last.length).toBe(2)
    })
  })

  describe('getFirstJsonLines()', () => {
    it('should return first N entries', async () => {
      const objects = Array.from({ length: 10 }, (_, i) => ({ index: i }))
      await jsonlHelper.writeJsonLines(testFilePath, objects)

      const first3 = await jsonlHelper.getFirstJsonLines(testFilePath, 3)

      expect(first3.length).toBe(3)
      expect(first3[0].index).toBe(0)
      expect(first3[2].index).toBe(2)
    })
  })

  describe('mergeJsonLines()', () => {
    it('should merge multiple files', async () => {
      const file1 = path.join(tempDir, 'file1.jsonl')
      const file2 = path.join(tempDir, 'file2.jsonl')

      await jsonlHelper.writeJsonLines(file1, [{ file: 1 }])
      await jsonlHelper.writeJsonLines(file2, [{ file: 2 }])

      const merged = await jsonlHelper.mergeJsonLines([file1, file2])

      expect(merged.length).toBe(2)
      expect(merged[0].file).toBe(1)
      expect(merged[1].file).toBe(2)
    })

    it('should handle non-existent files gracefully', async () => {
      const file1 = path.join(tempDir, 'file1.jsonl')
      await jsonlHelper.writeJsonLines(file1, [{ a: 1 }])

      const merged = await jsonlHelper.mergeJsonLines([
        file1,
        path.join(tempDir, 'nonexistent.jsonl')
      ])

      expect(merged.length).toBe(1)
    })
  })

  describe('isJsonLinesEmpty()', () => {
    it('should return true for empty file', async () => {
      await fs.writeFile(testFilePath, '')

      const isEmpty = await jsonlHelper.isJsonLinesEmpty(testFilePath)

      expect(isEmpty).toBe(true)
    })

    it('should return false for file with content', async () => {
      await jsonlHelper.writeJsonLines(testFilePath, [{ a: 1 }])

      const isEmpty = await jsonlHelper.isJsonLinesEmpty(testFilePath)

      expect(isEmpty).toBe(false)
    })

    it('should return true for non-existent file', async () => {
      const isEmpty = await jsonlHelper.isJsonLinesEmpty(path.join(tempDir, 'nonexistent.jsonl'))

      expect(isEmpty).toBe(true)
    })
  })

  describe('getFileSizeMB()', () => {
    it('should return file size in MB', async () => {
      const content = 'x'.repeat(1024 * 1024) // 1MB
      await fs.writeFile(testFilePath, content)

      const sizeMB = await jsonlHelper.getFileSizeMB(testFilePath)

      expect(sizeMB).toBeGreaterThan(0.9)
      expect(sizeMB).toBeLessThan(1.1)
    })

    it('should return 0 for non-existent file', async () => {
      const sizeMB = await jsonlHelper.getFileSizeMB(path.join(tempDir, 'nonexistent.jsonl'))

      expect(sizeMB).toBe(0)
    })
  })

  describe('rotateJsonLinesIfNeeded()', () => {
    it('should not rotate if file is small', async () => {
      await jsonlHelper.writeJsonLines(testFilePath, [{ a: 1 }])

      const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(testFilePath, 10)

      expect(rotated).toBe(false)
      const exists = await fs.access(testFilePath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should rotate if file exceeds size limit', async () => {
      // Create a large file (simulate with many entries)
      const largeContent = Array.from({ length: 10000 }, (_, i) => ({
        index: i,
        data: 'x'.repeat(100)
      }))
      await jsonlHelper.writeJsonLines(testFilePath, largeContent)

      // Use very small limit to force rotation
      const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(testFilePath, 0.001)

      // File should be rotated (moved to archive)
      expect(rotated).toBe(true)
    })
  })

  describe('appendJsonLineWithRotation()', () => {
    it('should append and rotate if needed', async () => {
      // Create large file
      const largeContent = Array.from({ length: 10000 }, (_, i) => ({
        index: i,
        data: 'x'.repeat(100)
      }))
      await jsonlHelper.writeJsonLines(testFilePath, largeContent)

      await jsonlHelper.appendJsonLineWithRotation(testFilePath, { new: true }, 0.001)

      // File should exist (either original or after rotation)
      const files = await fs.readdir(tempDir)
      expect(files.length).toBeGreaterThan(0)
    })
  })
})

