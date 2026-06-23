/**
 * SQLite Migration & Integration Tests (PRJ-303)
 *
 * Tests for:
 * - Migration correctness (JSON → SQLite)
 * - Concurrent access (WAL mode)
 * - Query performance (SQLite vs JSON)
 * - Graceful degradation
 * - StorageManager + IndexStorage SQLite integration
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { prjctDb } from '../../storage/database'
import { indexStorage } from '../../storage/index-storage'
import { hasLegacyArtifacts, migrateJsonToSqlite } from '../../storage/migrate-json'
import { StorageManager } from '../../storage/storage-manager'

// Test Setup

let tmpRoot: string | null = null
let testProjectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

// Concrete StorageManager for testing
interface TestData {
  value: string
  count: number
  items: string[]
}

class TestStorageManager extends StorageManager<TestData> {
  constructor() {
    super('test-data.json')
  }

  protected getDefault(): TestData {
    return { value: '', count: 0, items: [] }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `test.${action}`
  }
}

function mockPaths() {
  pathManager.getGlobalProjectPath = (projectId: string) => {
    return path.join(tmpRoot!, projectId)
  }

  pathManager.getStoragePath = (projectId: string, filename: string) => {
    return path.join(tmpRoot!, projectId, 'storage', filename)
  }

  pathManager.getFilePath = (projectId: string, layer: string, filename: string) => {
    return path.join(tmpRoot!, projectId, layer, filename)
  }
}

function restorePaths() {
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  pathManager.getStoragePath = originalGetStoragePath
  pathManager.getFilePath = originalGetFilePath
}

// Migration Correctness Tests

describe('SQLite Migration', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-sqlite-test-'))
    testProjectId = 'test-project-migration'
    mockPaths()
  })

  afterEach(async () => {
    prjctDb.close()
    restorePaths()
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  describe('migration correctness', () => {
    it('does not treat a modern sessions directory as legacy by itself', async () => {
      const projectPath = path.join(tmpRoot!, testProjectId)
      await fs.mkdir(path.join(projectPath, 'sessions'), { recursive: true })
      await fs.writeFile(path.join(projectPath, 'prjct.db'), 'not opened by this guard')

      expect(hasLegacyArtifacts(testProjectId)).toBe(false)

      await fs.writeFile(path.join(projectPath, 'sessions', 'current.json'), '{}')
      expect(hasLegacyArtifacts(testProjectId)).toBe(true)

      await fs.rm(path.join(projectPath, 'sessions', 'current.json'))
      await fs.mkdir(path.join(projectPath, 'sessions', 'archive', '2026-06'), { recursive: true })
      await fs.writeFile(
        path.join(projectPath, 'sessions', 'archive', '2026-06', 'session.json'),
        '{}'
      )
      expect(hasLegacyArtifacts(testProjectId)).toBe(true)
    })

    it('should migrate state.json to kv_store', async () => {
      // Create source JSON
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      const state = {
        currentTask: {
          id: 'task-1',
          description: 'Test task',
          type: 'feature',
          status: 'active',
          startedAt: '2026-01-01T00:00:00.000Z',
          subtasks: [
            { id: 'st-1', description: 'Sub 1', status: 'completed' },
            { id: 'st-2', description: 'Sub 2', status: 'active' },
          ],
          currentSubtaskIndex: 1,
          branch: 'feature/test',
          linearId: 'PRJ-100',
        },
        previousTask: null,
        pausedTasks: [],
      }

      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify(state, null, 2),
        'utf-8'
      )

      const result = await migrateJsonToSqlite(testProjectId)

      expect(result.success).toBe(true)
      expect(result.migratedFiles).toContain('state.json')

      // Verify kv_store has the data
      const doc = prjctDb.getDoc(testProjectId, 'state')
      expect(doc).not.toBeNull()
      expect((doc as typeof state).currentTask.id).toBe('task-1')
      expect((doc as typeof state).currentTask.description).toBe('Test task')
    })

    it('should migrate state.json to normalized tasks table', async () => {
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      const state = {
        currentTask: {
          id: 'task-abc',
          description: 'Normalized test',
          type: 'bug',
          status: 'active',
          startedAt: '2026-01-01T00:00:00.000Z',
          subtasks: [
            { id: 'st-1', description: 'First sub', status: 'completed', domain: 'backend' },
          ],
          branch: 'fix/test',
          linearId: 'PRJ-200',
        },
        previousTask: null,
        pausedTasks: [],
      }

      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify(state, null, 2),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      // Verify normalized tasks table
      const task = prjctDb.get<{ id: string; description: string; type: string; status: string }>(
        testProjectId,
        'SELECT id, description, type, status FROM tasks WHERE id = ?',
        'task-abc'
      )
      expect(task).not.toBeNull()
      expect(task!.type).toBe('bug')
      expect(task!.status).toBe('active')

      // Verify subtasks table
      const subtask = prjctDb.get<{ id: string; task_id: string; domain: string }>(
        testProjectId,
        'SELECT id, task_id, domain FROM subtasks WHERE id = ?',
        'st-1'
      )
      expect(subtask).not.toBeNull()
      expect(subtask!.task_id).toBe('task-abc')
      expect(subtask!.domain).toBe('backend')
    })

    it('should migrate ideas.json to kv_store and ideas table', async () => {
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      const ideas = {
        ideas: [
          {
            id: 'idea-1',
            text: 'Add dark mode',
            status: 'pending',
            priority: 'high',
            tags: ['ui', 'frontend'],
            addedAt: '2026-01-15T00:00:00.000Z',
          },
          {
            id: 'idea-2',
            text: 'Improve caching',
            status: 'converted',
            priority: 'medium',
            tags: ['performance'],
            addedAt: '2026-01-16T00:00:00.000Z',
            convertedTo: 'task-xyz',
          },
        ],
      }

      await fs.writeFile(
        path.join(storagePath, 'ideas.json'),
        JSON.stringify(ideas, null, 2),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      // Verify kv_store
      const doc = prjctDb.getDoc(testProjectId, 'ideas')
      expect(doc).not.toBeNull()

      // Verify normalized ideas table
      const rows = prjctDb.query<{ id: string; text: string; priority: string }>(
        testProjectId,
        'SELECT id, text, priority FROM ideas ORDER BY id'
      )
      expect(rows).toHaveLength(2)
      expect(rows[0].text).toBe('Add dark mode')
      expect(rows[0].priority).toBe('high')
      expect(rows[1].text).toBe('Improve caching')
    })

    it('should migrate index files to index_meta', async () => {
      const indexPath = path.join(tmpRoot!, testProjectId, 'index')
      await fs.mkdir(indexPath, { recursive: true })

      const projectIndex = {
        version: '1.0.0',
        projectPath: '/test/project',
        lastFullScan: '2026-01-01T00:00:00.000Z',
        lastIncrementalUpdate: '',
        languages: { TypeScript: { count: 10, totalLines: 500, totalSize: 25000 } },
        configFiles: [],
        directories: [],
        relevantFiles: [],
        patterns: [],
        detectedStack: {
          ecosystem: 'JavaScript',
          frameworks: [],
          hasTests: true,
          hasDocker: false,
          hasCi: false,
          buildTool: 'bun',
        },
        totalFiles: 50,
        totalSize: 100000,
        totalLines: 5000,
        scanDuration: 30,
      }

      await fs.writeFile(
        path.join(indexPath, 'project-index.json'),
        JSON.stringify(projectIndex, null, 2),
        'utf-8'
      )

      // Need a state.json so migration doesn't short-circuit
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })
      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 'x',
            description: 'x',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      // Verify index_meta
      const row = prjctDb.get<{ data: string }>(
        testProjectId,
        'SELECT data FROM index_meta WHERE key = ?',
        'project-index'
      )
      expect(row).not.toBeNull()
      const parsed = JSON.parse(row!.data)
      expect(parsed.totalFiles).toBe(50)
      expect(parsed.languages.TypeScript.count).toBe(10)
    })

    it('should migrate checksums to index_checksums table', async () => {
      const indexPath = path.join(tmpRoot!, testProjectId, 'index')
      await fs.mkdir(indexPath, { recursive: true })

      const checksums = {
        version: '1.0.0',
        lastUpdated: '2026-01-01T00:00:00.000Z',
        checksums: {
          'src/index.ts': 'abc123',
          'src/utils.ts': 'def456',
          'package.json': 'ghi789',
        },
      }

      await fs.writeFile(
        path.join(indexPath, 'checksums.json'),
        JSON.stringify(checksums, null, 2),
        'utf-8'
      )

      // Need state.json
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })
      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 'x',
            description: 'x',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      // Verify index_checksums table
      const rows = prjctDb.query<{ path: string; checksum: string }>(
        testProjectId,
        'SELECT path, checksum FROM index_checksums ORDER BY path'
      )
      expect(rows).toHaveLength(3)
      expect(rows[0].path).toBe('package.json')
      expect(rows[0].checksum).toBe('ghi789')
    })

    it('should migrate events.jsonl to events table', async () => {
      const memoryPath = path.join(tmpRoot!, testProjectId, 'memory')
      await fs.mkdir(memoryPath, { recursive: true })

      const events = [
        '{"type":"task_started","taskId":"t1","timestamp":"2026-01-01T00:00:00.000Z"}',
        '{"type":"subtask_completed","taskId":"t1","timestamp":"2026-01-01T01:00:00.000Z"}',
        '{"type":"task_completed","taskId":"t1","timestamp":"2026-01-01T02:00:00.000Z"}',
      ]
      await fs.writeFile(path.join(memoryPath, 'events.jsonl'), events.join('\n'), 'utf-8')

      // Need state.json
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })
      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 'x',
            description: 'x',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      const rows = prjctDb.query<{ type: string; task_id: string }>(
        testProjectId,
        'SELECT type, task_id FROM events ORDER BY id'
      )
      expect(rows).toHaveLength(3)
      expect(rows[0].type).toBe('task_started')
      expect(rows[2].type).toBe('task_completed')
    })

    it('should be idempotent (skip if already migrated)', async () => {
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 't1',
            description: 'x',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )

      // First migration
      const result1 = await migrateJsonToSqlite(testProjectId)
      expect(result1.success).toBe(true)
      expect(result1.migratedFiles.length).toBeGreaterThan(0)

      // Second migration should short-circuit
      const result2 = await migrateJsonToSqlite(testProjectId)
      expect(result2.success).toBe(true)
      expect(result2.migratedFiles).toHaveLength(0)
    })

    it('should create backup of original files', async () => {
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 'bk',
            description: 'backup test',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )

      const result = await migrateJsonToSqlite(testProjectId)

      expect(result.backupDir).not.toBeNull()
      // Verify backup file exists
      const backupFile = path.join(result.backupDir!, 'state.json')
      const stat = await fs.stat(backupFile)
      expect(stat.isFile()).toBe(true)
    })

    it('should delete JSON files after successful migration', async () => {
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      const indexPath = path.join(tmpRoot!, testProjectId, 'index')
      const memoryPath = path.join(tmpRoot!, testProjectId, 'memory')
      await fs.mkdir(storagePath, { recursive: true })
      await fs.mkdir(indexPath, { recursive: true })
      await fs.mkdir(memoryPath, { recursive: true })

      // Create various JSON files
      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify({
          currentTask: {
            id: 'del',
            description: 'del',
            status: 'active',
            startedAt: new Date().toISOString(),
          },
          previousTask: null,
          pausedTasks: [],
        }),
        'utf-8'
      )
      await fs.writeFile(
        path.join(storagePath, 'queue.json'),
        JSON.stringify({ tasks: [] }),
        'utf-8'
      )
      await fs.writeFile(
        path.join(indexPath, 'project-index.json'),
        JSON.stringify({ version: '1.0.0', totalFiles: 1 }),
        'utf-8'
      )
      await fs.writeFile(
        path.join(memoryPath, 'events.jsonl'),
        '{"type":"test","timestamp":"2026-01-01T00:00:00.000Z"}\n',
        'utf-8'
      )

      const result = await migrateJsonToSqlite(testProjectId)
      expect(result.success).toBe(true)

      // Verify JSON files were deleted
      await expect(fs.access(path.join(storagePath, 'state.json'))).rejects.toThrow()
      await expect(fs.access(path.join(storagePath, 'queue.json'))).rejects.toThrow()
      await expect(fs.access(path.join(indexPath, 'project-index.json'))).rejects.toThrow()
      await expect(fs.access(path.join(memoryPath, 'events.jsonl'))).rejects.toThrow()

      // Verify backup still exists
      expect(result.backupDir).not.toBeNull()
      const backupFile = path.join(result.backupDir!, 'state.json')
      const stat = await fs.stat(backupFile)
      expect(stat.isFile()).toBe(true)

      // Verify data is accessible from SQLite
      const doc = prjctDb.getDoc(testProjectId, 'state')
      expect(doc).not.toBeNull()
    })

    it('should handle missing files gracefully', async () => {
      // Create only storage dir, no files
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      const result = await migrateJsonToSqlite(testProjectId)

      // Should succeed with skipped files
      expect(result.errors).toHaveLength(0)
      expect(result.skippedFiles.length).toBeGreaterThan(0)
    })
  })

  // Concurrent Access Tests (WAL Mode)

  describe('concurrent access', () => {
    it('should handle multiple concurrent reads', async () => {
      const manager = new TestStorageManager()
      const data: TestData = { value: 'concurrent', count: 42, items: ['a', 'b'] }
      await manager.write(testProjectId, data)
      manager.clearCache()

      // Fire off multiple concurrent reads
      const reads = Array.from({ length: 10 }, () => manager.read(testProjectId))
      const results = await Promise.all(reads)

      for (const result of results) {
        expect(result).toEqual(data)
      }
    })

    it('should handle concurrent writes to different projects', async () => {
      const manager = new TestStorageManager()
      const projects = ['proj-a', 'proj-b', 'proj-c']

      // Write to different projects concurrently
      const writes = projects.map((id, i) =>
        manager.write(id, { value: `project-${i}`, count: i, items: [] })
      )
      await Promise.all(writes)

      // Verify each project has correct data
      for (let i = 0; i < projects.length; i++) {
        manager.clearCache(projects[i])
        const result = await manager.read(projects[i])
        expect(result.value).toBe(`project-${i}`)
        expect(result.count).toBe(i)
      }
    })

    it('should handle sequential updates consistently', async () => {
      const manager = new TestStorageManager()
      await manager.write(testProjectId, { value: 'start', count: 0, items: [] })

      // Run sequential updates
      for (let i = 1; i <= 10; i++) {
        await manager.update(testProjectId, (current) => ({
          ...current,
          count: current.count + 1,
          items: [...current.items, `item-${i}`],
        }))
      }

      const result = await manager.read(testProjectId)
      expect(result.count).toBe(10)
      expect(result.items).toHaveLength(10)
    })
  })

  // Query Performance Tests

  describe('query performance', () => {
    it('should perform SQLite reads efficiently', async () => {
      const manager = new TestStorageManager()
      const data: TestData = {
        value: 'perf-test',
        count: 100,
        items: Array.from({ length: 50 }, (_, i) => `item-${i}`),
      }
      await manager.write(testProjectId, data)

      // Benchmark SQLite read (direct)
      const sqliteStart = performance.now()
      for (let i = 0; i < 100; i++) {
        prjctDb.getDoc(testProjectId, 'test-data')
      }
      const sqliteTime = performance.now() - sqliteStart

      // Verify data is correct
      const sqliteResult = prjctDb.getDoc<TestData>(testProjectId, 'test-data')
      expect(sqliteResult).toEqual(data)

      // Log for informational purposes
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms (100 reads)`)
    })

    it('should handle indexed queries efficiently', async () => {
      // Populate normalized tasks table
      const storagePath = path.join(tmpRoot!, testProjectId, 'storage')
      await fs.mkdir(storagePath, { recursive: true })

      const state = {
        currentTask: {
          id: 'perf-task',
          description: 'Performance test',
          type: 'feature',
          status: 'active',
          startedAt: '2026-01-01T00:00:00.000Z',
          subtasks: Array.from({ length: 20 }, (_, i) => ({
            id: `st-${i}`,
            description: `Subtask ${i}`,
            status: i < 10 ? 'completed' : 'pending',
            domain: i % 2 === 0 ? 'backend' : 'frontend',
          })),
        },
        previousTask: null,
        pausedTasks: [],
      }

      await fs.writeFile(
        path.join(storagePath, 'state.json'),
        JSON.stringify(state, null, 2),
        'utf-8'
      )

      await migrateJsonToSqlite(testProjectId)

      // Indexed query: find completed subtasks
      const start = performance.now()
      const completed = prjctDb.query<{ id: string }>(
        testProjectId,
        'SELECT id FROM subtasks WHERE status = ?',
        'completed'
      )
      const queryTime = performance.now() - start

      expect(completed).toHaveLength(10)
      // Indexed query should be sub-millisecond
      expect(queryTime).toBeLessThan(10)
    })
  })

  // StorageManager SQLite Integration

  describe('StorageManager SQLite integration', () => {
    it('should write to SQLite only (no JSON file)', async () => {
      const manager = new TestStorageManager()
      const data: TestData = { value: 'sqlite-write', count: 7, items: ['x'] }

      await manager.write(testProjectId, data)

      // Verify SQLite has it
      const sqliteData = prjctDb.getDoc<TestData>(testProjectId, 'test-data')
      expect(sqliteData).toEqual(data)

      // Verify JSON file does NOT exist
      const jsonPath = pathManager.getStoragePath(testProjectId, 'test-data.json')
      await expect(fs.access(jsonPath)).rejects.toThrow()
    })

    it('should read from SQLite', async () => {
      const manager = new TestStorageManager()
      const data: TestData = { value: 'sqlite-only', count: 3, items: [] }

      await manager.write(testProjectId, data)
      manager.clearCache()

      const result = await manager.read(testProjectId)
      expect(result).toEqual(data)
    })

    it('should return default when SQLite has no data', async () => {
      const manager = new TestStorageManager()
      const result = await manager.read('nonexistent-project')

      expect(result).toEqual({ value: '', count: 0, items: [] })
    })
  })

  // IndexStorage SQLite Integration

  describe('IndexStorage SQLite integration', () => {
    it('should write index to SQLite only (no JSON file)', async () => {
      // Ensure project directory exists for DB creation
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const projectIndex = {
        version: '1.0.0',
        projectPath: '/test',
        lastFullScan: '2026-01-01T00:00:00.000Z',
        lastIncrementalUpdate: '',
        languages: {},
        configFiles: [],
        directories: [],
        relevantFiles: [],
        patterns: [],
        detectedStack: {
          ecosystem: 'JavaScript',
          frameworks: [],
          hasTests: false,
          hasDocker: false,
          hasCi: false,
          buildTool: null,
        },
        totalFiles: 10,
        totalSize: 1000,
        totalLines: 100,
        scanDuration: 5,
      }

      await indexStorage.writeIndex(testProjectId, projectIndex)

      // Verify SQLite index_meta
      const row = prjctDb.get<{ data: string }>(
        testProjectId,
        'SELECT data FROM index_meta WHERE key = ?',
        'project-index'
      )
      expect(row).not.toBeNull()
      const parsed = JSON.parse(row!.data)
      expect(parsed.totalFiles).toBe(10)

      // Verify JSON file does NOT exist
      const jsonPath = path.join(indexStorage.getIndexPath(testProjectId), 'project-index.json')
      await expect(fs.access(jsonPath)).rejects.toThrow()
    })

    it('should read index from SQLite', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const projectIndex = {
        version: '1.0.0',
        projectPath: '/test',
        lastFullScan: '2026-01-01T00:00:00.000Z',
        lastIncrementalUpdate: '',
        languages: {},
        configFiles: [],
        directories: [],
        relevantFiles: [],
        patterns: [],
        detectedStack: {
          ecosystem: 'JavaScript',
          frameworks: [],
          hasTests: false,
          hasDocker: false,
          hasCi: false,
          buildTool: null,
        },
        totalFiles: 20,
        totalSize: 2000,
        totalLines: 200,
        scanDuration: 10,
      }

      await indexStorage.writeIndex(testProjectId, projectIndex)

      const result = await indexStorage.readIndex(testProjectId)
      expect(result).not.toBeNull()
      expect(result!.totalFiles).toBe(20)
    })

    it('should write and read checksums via SQLite', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const checksums = {
        version: '1.0.0',
        lastUpdated: '2026-01-01T00:00:00.000Z',
        checksums: { 'a.ts': 'hash1', 'b.ts': 'hash2' },
      }

      await indexStorage.writeChecksums(testProjectId, checksums)

      const result = await indexStorage.readChecksums(testProjectId)
      expect(result.checksums['a.ts']).toBe('hash1')
      expect(result.checksums['b.ts']).toBe('hash2')
    })

    it('should write and read file scores via SQLite', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const scores = [
        { path: 'src/main.ts', score: 0.95, size: 1000, mtime: '2026-01-01T00:00:00.000Z' },
        { path: 'src/utils.ts', score: 0.7, size: 500, mtime: '2026-01-01T00:00:00.000Z' },
      ]

      await indexStorage.writeScores(testProjectId, scores)

      const result = await indexStorage.readScores(testProjectId)
      expect(result).toHaveLength(2)
      expect(result[0].path).toBe('src/main.ts')
      expect(result[0].score).toBe(0.95)
    })

    it('should write and read domains via SQLite', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const domains = {
        version: '1.0.0',
        projectId: testProjectId,
        domains: [
          {
            name: 'api',
            description: 'API layer',
            keywords: ['api'],
            filePatterns: ['**/api/**'],
            fileCount: 5,
          },
        ],
        discoveredAt: '2026-01-01T00:00:00.000Z',
      }

      await indexStorage.writeDomains(testProjectId, domains)

      const result = await indexStorage.readDomains(testProjectId)
      expect(result).not.toBeNull()
      expect(result!.domains[0].name).toBe('api')
    })

    it('should write and read categories via SQLite', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      const cache = {
        version: '1.0.0',
        lastUpdate: '2026-01-01T00:00:00.000Z',
        fileCategories: [
          {
            path: 'src/api.ts',
            categories: ['api', 'backend'],
            primaryDomain: 'api',
            confidence: 0.9,
            categorizedAt: '2026-01-01T00:00:00.000Z',
            method: 'heuristic' as const,
          },
        ],
        domainIndex: { api: ['src/api.ts'] },
      }

      await indexStorage.writeCategories(testProjectId, cache)

      const result = await indexStorage.readCategories(testProjectId)
      expect(result).not.toBeNull()
      expect(result!.fileCategories[0].path).toBe('src/api.ts')
    })

    it('should clear SQLite on clearIndex', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })

      await indexStorage.writeIndex(testProjectId, {
        version: '1.0.0',
        projectPath: '/test',
        lastFullScan: '2026-01-01T00:00:00.000Z',
        lastIncrementalUpdate: '',
        languages: {},
        configFiles: [],
        directories: [],
        relevantFiles: [],
        patterns: [],
        detectedStack: {
          ecosystem: 'JavaScript',
          frameworks: [],
          hasTests: false,
          hasDocker: false,
          hasCi: false,
          buildTool: null,
        },
        totalFiles: 1,
        totalSize: 1,
        totalLines: 1,
        scanDuration: 1,
      })

      await indexStorage.clearIndex(testProjectId)

      const sqliteRow = prjctDb.get<{ data: string }>(
        testProjectId,
        'SELECT data FROM index_meta WHERE key = ?',
        'project-index'
      )
      expect(sqliteRow).toBeNull()

      const result = await indexStorage.readIndex(testProjectId)
      expect(result).toBeNull()
    })

    it('should return null for outdated index version', async () => {
      // Ensure project directory exists for DB creation
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      // Write directly to SQLite with wrong version
      const db = prjctDb.getDb(testProjectId)
      db.prepare('INSERT OR REPLACE INTO index_meta (key, data, updated_at) VALUES (?, ?, ?)').run(
        'project-index',
        JSON.stringify({ version: '0.0.1', totalFiles: 5 }),
        new Date().toISOString()
      )

      const result = await indexStorage.readIndex(testProjectId)
      expect(result).toBeNull()
    })
  })

  // Database Manager Tests

  describe('database manager', () => {
    it('should create tables on first access', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      const db = prjctDb.getDb(testProjectId)
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>

      const tableNames = tables.map((t) => t.name)
      expect(tableNames).toContain('kv_store')
      expect(tableNames).toContain('tasks')
      expect(tableNames).toContain('subtasks')
      expect(tableNames).toContain('events')
      expect(tableNames).toContain('index_meta')
      expect(tableNames).toContain('index_files')
      expect(tableNames).toContain('index_checksums')
      expect(tableNames).toContain('memory')
    })

    it('should track migrations', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      prjctDb.getDb(testProjectId) // Ensure DB is initialized
      const migrations = prjctDb.getMigrations(testProjectId)
      expect(migrations.length).toBeGreaterThan(0)
      expect(migrations[0].name).toBe('initial-schema')
    })

    it('should support document CRUD operations', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      // Create
      prjctDb.setDoc(testProjectId, 'test-key', { hello: 'world' })
      expect(prjctDb.hasDoc(testProjectId, 'test-key')).toBe(true)

      // Read
      const doc = prjctDb.getDoc<{ hello: string }>(testProjectId, 'test-key')
      expect(doc).not.toBeNull()
      expect(doc!.hello).toBe('world')

      // Update
      prjctDb.setDoc(testProjectId, 'test-key', { hello: 'updated' })
      const updated = prjctDb.getDoc<{ hello: string }>(testProjectId, 'test-key')
      expect(updated!.hello).toBe('updated')

      // Delete
      prjctDb.deleteDoc(testProjectId, 'test-key')
      expect(prjctDb.hasDoc(testProjectId, 'test-key')).toBe(false)
      expect(prjctDb.getDoc(testProjectId, 'test-key')).toBeNull()
    })

    it('should support event log operations', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      prjctDb.appendEvent(testProjectId, 'test.event', { key: 'value' }, 'task-1')
      prjctDb.appendEvent(testProjectId, 'test.event', { key: 'value2' }, 'task-1')
      prjctDb.appendEvent(testProjectId, 'other.event', { key: 'value3' })

      const allEvents = prjctDb.getEvents(testProjectId)
      expect(allEvents).toHaveLength(3)

      const testEvents = prjctDb.getEvents(testProjectId, 'test.event')
      expect(testEvents).toHaveLength(2)
    })

    it('should support transactions', async () => {
      await fs.mkdir(path.join(tmpRoot!, testProjectId), { recursive: true })
      const result = prjctDb.transaction(testProjectId, (db) => {
        db.prepare('INSERT INTO kv_store (key, data, updated_at) VALUES (?, ?, ?)').run(
          'tx-key-1',
          '"value1"',
          new Date().toISOString()
        )
        db.prepare('INSERT INTO kv_store (key, data, updated_at) VALUES (?, ?, ?)').run(
          'tx-key-2',
          '"value2"',
          new Date().toISOString()
        )
        return 'committed'
      })

      expect(result).toBe('committed')
      expect(prjctDb.hasDoc(testProjectId, 'tx-key-1')).toBe(true)
      expect(prjctDb.hasDoc(testProjectId, 'tx-key-2')).toBe(true)
    })
  })
})
