/**
 * Memory System Tests
 * P3.3: Semantic Memory Database
 */

const memorySystem = require('../../agentic/memory-system')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

// Generate unique project ID for each test run
let testCounter = 0
const getTestProjectId = () => `test-memory-${Date.now()}-${++testCounter}`

describe('MemorySystem P3.3', () => {
  let TEST_PROJECT_ID

  beforeEach(() => {
    // Use unique project ID for each test to avoid data leakage
    TEST_PROJECT_ID = getTestProjectId()
    // Reset internal state
    memorySystem._memories = null
    memorySystem._memoriesLoaded = false
    memorySystem._patterns = null
    memorySystem._patternsLoaded = false
    memorySystem._sessionMemory.clear()
  })

  describe('createMemory', () => {
    it('should create a memory with tags', async () => {
      const memoryId = await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Test Memory',
        content: 'This is test content',
        tags: ['code_style', 'naming_convention'],
        userTriggered: true
      })

      expect(memoryId).toMatch(/^mem_/)

      const memories = await memorySystem.getAllMemories(TEST_PROJECT_ID)
      expect(memories.length).toBe(1)
      expect(memories[0].title).toBe('Test Memory')
      expect(memories[0].tags).toContain('code_style')
      expect(memories[0].userTriggered).toBe(true)
    })
  })

  describe('updateMemory', () => {
    it('should update memory content and tags', async () => {
      const memoryId = await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Original Title',
        content: 'Original content',
        tags: ['code_style']
      })

      const updated = await memorySystem.updateMemory(TEST_PROJECT_ID, memoryId, {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['naming_convention', 'architecture']
      })

      expect(updated).toBe(true)

      const memories = await memorySystem.getAllMemories(TEST_PROJECT_ID)
      const memory = memories.find(m => m.id === memoryId)

      expect(memory.title).toBe('Updated Title')
      expect(memory.content).toBe('Updated content')
      expect(memory.tags).toContain('architecture')
      expect(memory.tags).not.toContain('code_style')
    })

    it('should return false for non-existent memory', async () => {
      const result = await memorySystem.updateMemory(TEST_PROJECT_ID, 'non_existent_id', {
        title: 'New Title'
      })
      expect(result).toBe(false)
    })
  })

  describe('deleteMemory', () => {
    it('should delete a memory', async () => {
      const memoryId = await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'To Delete',
        content: 'Will be deleted',
        tags: ['test']
      })

      const deleted = await memorySystem.deleteMemory(TEST_PROJECT_ID, memoryId)
      expect(deleted).toBe(true)

      const memories = await memorySystem.getAllMemories(TEST_PROJECT_ID)
      expect(memories.find(m => m.id === memoryId)).toBeUndefined()
    })
  })

  describe('findByTags', () => {
    beforeEach(async () => {
      // Create test memories
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Memory 1',
        content: 'Content 1',
        tags: ['code_style', 'naming_convention']
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Memory 2',
        content: 'Content 2',
        tags: ['architecture', 'naming_convention']
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Memory 3',
        content: 'Content 3',
        tags: ['commit_style']
      })
    })

    it('should find memories with ANY tag (OR)', async () => {
      const results = await memorySystem.findByTags(TEST_PROJECT_ID, ['code_style', 'architecture'], false)
      expect(results.length).toBe(2)
    })

    it('should find memories with ALL tags (AND)', async () => {
      const results = await memorySystem.findByTags(TEST_PROJECT_ID, ['naming_convention', 'architecture'], true)
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Memory 2')
    })
  })

  describe('searchMemories', () => {
    beforeEach(async () => {
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'React Hooks Pattern',
        content: 'Use custom hooks for reusable logic',
        tags: ['code_style']
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'API Design',
        content: 'REST endpoints follow /api/v1 pattern',
        tags: ['architecture']
      })
    })

    it('should search by title', async () => {
      const results = await memorySystem.searchMemories(TEST_PROJECT_ID, 'React')
      expect(results.length).toBe(1)
      expect(results[0].title).toContain('React')
    })

    it('should search by content', async () => {
      const results = await memorySystem.searchMemories(TEST_PROJECT_ID, 'endpoints')
      expect(results.length).toBe(1)
      expect(results[0].content).toContain('endpoints')
    })

    it('should be case insensitive', async () => {
      const results = await memorySystem.searchMemories(TEST_PROJECT_ID, 'HOOKS')
      expect(results.length).toBe(1)
    })
  })

  describe('getRelevantMemories', () => {
    beforeEach(async () => {
      // Create memories with different relevance
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Commit Style',
        content: 'Use conventional commits',
        tags: ['commit_style', 'ship_workflow'],
        userTriggered: true
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Test Behavior',
        content: 'Run tests before shipping',
        tags: ['test_behavior', 'ship_workflow']
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Code Style',
        content: 'Use TypeScript strict mode',
        tags: ['code_style']
      })
    })

    it('should return memories relevant to ship command', async () => {
      const context = { commandName: 'ship', params: {} }
      const results = await memorySystem.getRelevantMemories(TEST_PROJECT_ID, context, 5)

      expect(results.length).toBeGreaterThan(0)
      // Ship command should prioritize commit_style and ship_workflow tags
      const hasRelevantTags = results.some(m =>
        m.tags.includes('commit_style') || m.tags.includes('ship_workflow')
      )
      expect(hasRelevantTags).toBe(true)
    })

    it('should prioritize user triggered memories', async () => {
      const context = { commandName: 'ship', params: {} }
      const results = await memorySystem.getRelevantMemories(TEST_PROJECT_ID, context, 5)

      // User triggered should be ranked higher
      const userTriggeredIndex = results.findIndex(m => m.userTriggered)
      expect(userTriggeredIndex).toBeLessThanOrEqual(1) // Should be in top 2
    })

    it('should limit results', async () => {
      const context = { commandName: 'ship', params: {} }
      const results = await memorySystem.getRelevantMemories(TEST_PROJECT_ID, context, 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })
  })

  describe('autoRemember', () => {
    it('should create memory from user decision', async () => {
      await memorySystem.autoRemember(TEST_PROJECT_ID, 'commit_footer', 'prjct', 'User chose prjct footer')

      const memories = await memorySystem.getAllMemories(TEST_PROJECT_ID)
      expect(memories.length).toBe(1)
      expect(memories[0].content).toContain('commit_footer: prjct')
      expect(memories[0].tags).toContain('commit_style')
      expect(memories[0].userTriggered).toBe(true)
    })

    it('should update existing memory instead of creating duplicate', async () => {
      await memorySystem.autoRemember(TEST_PROJECT_ID, 'commit_footer', 'prjct', 'First choice')
      await memorySystem.autoRemember(TEST_PROJECT_ID, 'commit_footer', 'claude', 'Changed mind')

      const memories = await memorySystem.getAllMemories(TEST_PROJECT_ID)
      expect(memories.length).toBe(1)
      expect(memories[0].content).toContain('commit_footer: claude')
    })
  })

  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Memory 1',
        content: 'Content 1',
        tags: ['code_style'],
        userTriggered: true
      })
      await memorySystem.createMemory(TEST_PROJECT_ID, {
        title: 'Memory 2',
        content: 'Content 2',
        tags: ['code_style', 'architecture']
      })

      const stats = await memorySystem.getMemoryStats(TEST_PROJECT_ID)

      expect(stats.totalMemories).toBe(2)
      expect(stats.userTriggered).toBe(1)
      expect(stats.tagCounts.code_style).toBe(2)
      expect(stats.tagCounts.architecture).toBe(1)
    })
  })

  // Cleanup test directories after each test
  afterEach(async () => {
    try {
      const testPath = path.join(os.homedir(), '.prjct-cli', 'projects', TEST_PROJECT_ID)
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })
})
