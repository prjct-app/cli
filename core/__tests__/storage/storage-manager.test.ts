/**
 * Storage Manager Tests
 *
 * Tests for the base StorageManager class:
 * - Read/write JSON operations
 * - Missing file handling
 * - Directory creation
 * - Cache behavior
 * - State consistency
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { prjctDb } from '../../storage/database'
import { StorageManager } from '../../storage/storage-manager'

// =============================================================================
// Test Implementation
// =============================================================================

interface TestData {
  value: string
  count: number
  items: string[]
}

/**
 * Concrete implementation for testing the abstract StorageManager
 */
class TestStorageManager extends StorageManager<TestData> {
  constructor() {
    super('test-data.json')
  }

  protected getLayer(): string {
    return 'context'
  }

  protected getDefault(): TestData {
    return { value: '', count: 0, items: [] }
  }

  protected toMarkdown(data: TestData): string {
    return `# Test Data\n\nValue: ${data.value}\nCount: ${data.count}\nItems: ${data.items.join(', ')}`
  }

  protected getMdFilename(): string {
    return 'test-data.md'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `test.${action}`
  }
}

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string
let manager: TestStorageManager

// Mock pathManager to use temp directory
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

describe('StorageManager', () => {
  beforeEach(async () => {
    // Create temp directory for test isolation
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-storage-test-'))
    testProjectId = 'test-project-123'

    // Mock pathManager to use temp directory
    pathManager.getGlobalProjectPath = (projectId: string) => {
      return path.join(tmpRoot!, projectId)
    }

    pathManager.getStoragePath = (projectId: string, filename: string) => {
      return path.join(tmpRoot!, projectId, 'storage', filename)
    }

    pathManager.getFilePath = (projectId: string, layer: string, filename: string) => {
      return path.join(tmpRoot!, projectId, layer, filename)
    }

    // Create fresh manager instance
    manager = new TestStorageManager()
  })

  afterEach(async () => {
    // Close SQLite connections before cleanup
    prjctDb.close()

    // Restore original pathManager methods
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    pathManager.getStoragePath = originalGetStoragePath
    pathManager.getFilePath = originalGetFilePath

    // Clean up temp directory
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  // ===========================================================================
  // Read/Write Tests
  // ===========================================================================

  describe('read/write', () => {
    it('should write and read JSON correctly', async () => {
      const testData: TestData = {
        value: 'hello',
        count: 42,
        items: ['a', 'b', 'c'],
      }

      await manager.write(testProjectId, testData)
      const result = await manager.read(testProjectId)

      expect(result).toEqual(testData)
    })

    it('should write to SQLite kv_store', async () => {
      const testData: TestData = {
        value: 'test',
        count: 1,
        items: ['item1'],
      }

      await manager.write(testProjectId, testData)

      // Verify SQLite has the data
      const doc = prjctDb.getDoc<TestData>(testProjectId, 'test-data')
      expect(doc).toEqual(testData)
    })

    it('should not create JSON storage file', async () => {
      const testData: TestData = {
        value: 'test',
        count: 1,
        items: ['item1'],
      }

      await manager.write(testProjectId, testData)

      // Verify JSON file does NOT exist
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage', 'test-data.json')
      await expect(fs.access(storagePath)).rejects.toThrow()
    })

    it('should create context markdown file', async () => {
      const testData: TestData = {
        value: 'markdown-test',
        count: 5,
        items: ['x', 'y'],
      }

      await manager.write(testProjectId, testData)

      // Verify markdown file exists
      const contextPath = path.join(tmpRoot!, testProjectId, 'context', 'test-data.md')
      const content = await fs.readFile(contextPath, 'utf-8')

      expect(content).toContain('# Test Data')
      expect(content).toContain('Value: markdown-test')
      expect(content).toContain('Count: 5')
      expect(content).toContain('Items: x, y')
    })

    it('should overwrite existing data', async () => {
      const data1: TestData = { value: 'first', count: 1, items: [] }
      const data2: TestData = { value: 'second', count: 2, items: ['new'] }

      await manager.write(testProjectId, data1)
      await manager.write(testProjectId, data2)

      const result = await manager.read(testProjectId)
      expect(result).toEqual(data2)
    })
  })

  // ===========================================================================
  // Missing File Handling
  // ===========================================================================

  describe('missing file handling', () => {
    it('should return default when file does not exist', async () => {
      const result = await manager.read('non-existent-project')

      expect(result).toEqual({ value: '', count: 0, items: [] })
    })

    it('should report exists=false when no data', async () => {
      const exists = await manager.exists('non-existent-project')
      expect(exists).toBe(false)
    })

    it('should report exists=true after write', async () => {
      await manager.write(testProjectId, { value: 'test', count: 1, items: [] })

      const exists = await manager.exists(testProjectId)
      expect(exists).toBe(true)
    })
  })

  // ===========================================================================
  // Directory Creation
  // ===========================================================================

  describe('directory creation', () => {
    it('should create project directory for SQLite DB', async () => {
      const testData: TestData = { value: 'dir-test', count: 1, items: [] }

      // Project directory shouldn't exist yet
      const projectDir = path.join(tmpRoot!, testProjectId)
      await expect(fs.access(projectDir)).rejects.toThrow()

      // Write should create it (SQLite DB creates its parent dir)
      await manager.write(testProjectId, testData)

      // Project dir should exist (created by SQLite)
      const stat = await fs.stat(projectDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should create context directory if it does not exist', async () => {
      const testData: TestData = { value: 'ctx-test', count: 1, items: [] }

      // Directory shouldn't exist yet
      const contextDir = path.join(tmpRoot!, testProjectId, 'context')
      await expect(fs.access(contextDir)).rejects.toThrow()

      // Write should create it
      await manager.write(testProjectId, testData)

      // Now it should exist
      const stat = await fs.stat(contextDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should create nested directories', async () => {
      const deepProjectId = 'deep/nested/project'
      const testData: TestData = { value: 'nested', count: 1, items: [] }

      await manager.write(deepProjectId, testData)

      const result = await manager.read(deepProjectId)
      expect(result).toEqual(testData)
    })
  })

  // ===========================================================================
  // Cache Behavior
  // ===========================================================================

  describe('cache behavior', () => {
    it('should cache read results', async () => {
      const testData: TestData = { value: 'cached', count: 1, items: [] }
      await manager.write(testProjectId, testData)

      // First read
      const result1 = await manager.read(testProjectId)

      // Modify SQLite directly (bypass manager)
      prjctDb.setDoc(testProjectId, 'test-data', { value: 'modified', count: 2, items: [] })

      // Second read should return cached value
      const result2 = await manager.read(testProjectId)
      expect(result2).toEqual(result1)
    })

    it('should clear cache for specific project', async () => {
      const testData: TestData = { value: 'to-clear', count: 1, items: [] }
      await manager.write(testProjectId, testData)

      // Read to populate cache
      await manager.read(testProjectId)

      // Write new data through the manager (the proper API)
      const newData: TestData = { value: 'updated', count: 99, items: ['new'] }
      await manager.write(testProjectId, newData)

      // Create a new manager instance (simulates fresh session without cache)
      const freshManager = new TestStorageManager()

      // Clear cache on original manager
      manager.clearCache(testProjectId)

      // Both should get the new data
      const result = await manager.read(testProjectId)
      expect(result).toEqual(newData)

      const freshResult = await freshManager.read(testProjectId)
      expect(freshResult).toEqual(newData)
    })

    it('should clear all cache', async () => {
      // Write to multiple projects
      await manager.write('project-a', { value: 'a', count: 1, items: [] })
      await manager.write('project-b', { value: 'b', count: 2, items: [] })

      // Read to populate cache
      await manager.read('project-a')
      await manager.read('project-b')

      // Clear all cache
      manager.clearCache()

      // Verify cache stats
      const stats = manager.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should return cache stats', async () => {
      const stats = manager.getCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('ttl')
      expect(typeof stats.size).toBe('number')
      expect(typeof stats.maxSize).toBe('number')
      expect(typeof stats.ttl).toBe('number')
    })
  })

  // ===========================================================================
  // State Consistency (Update Operations)
  // ===========================================================================

  describe('state consistency', () => {
    it('should update data atomically with updater function', async () => {
      const initial: TestData = { value: 'initial', count: 0, items: [] }
      await manager.write(testProjectId, initial)

      const result = await manager.update(testProjectId, (current) => ({
        ...current,
        count: current.count + 1,
        items: [...current.items, 'new-item'],
      }))

      expect(result.count).toBe(1)
      expect(result.items).toEqual(['new-item'])

      // Verify persisted
      manager.clearCache(testProjectId)
      const persisted = await manager.read(testProjectId)
      expect(persisted).toEqual(result)
    })

    it('should handle multiple sequential updates', async () => {
      await manager.write(testProjectId, { value: 'start', count: 0, items: [] })

      // Multiple updates
      for (let i = 0; i < 5; i++) {
        await manager.update(testProjectId, (current) => ({
          ...current,
          count: current.count + 1,
        }))
      }

      const result = await manager.read(testProjectId)
      expect(result.count).toBe(5)
    })

    it('should maintain data integrity after failed read during update', async () => {
      // Start with no file (will use default)
      const result = await manager.update(testProjectId, (current) => ({
        ...current,
        value: 'from-default',
        count: 100,
      }))

      expect(result.value).toBe('from-default')
      expect(result.count).toBe(100)
    })
  })
})
