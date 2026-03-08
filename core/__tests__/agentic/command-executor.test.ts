/**
 * Command Executor Tests
 * PRJ-82: Unit tests for command execution pipeline
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
// Import the module under test
import commandExecutor, {
  CommandExecutor,
  signalEnd,
  signalStart,
} from '../../agentic/command-executor'
import contextBuilder from '../../agentic/context-builder'
import loopDetector from '../../agentic/loop-detector'
import memorySystem from '../../agentic/memory-system'
import planMode from '../../agentic/plan-mode'
import promptBuilder from '../../agentic/prompt-builder'
import templateLoader from '../../agentic/template-loader'

// =============================================================================
// Test Setup
// =============================================================================

const TEST_BASE_DIR = path.join(process.cwd(), '.tmp', 'prjct-cli-tests', 'command-executor')
const TEST_PRJCT_HOME = path.join(TEST_BASE_DIR, 'prjct-home')
const RUNNING_FILE = path.join(TEST_PRJCT_HOME, '.running')
const ORIGINAL_PRJCT_CLI_HOME = process.env.PRJCT_CLI_HOME

let testCounter = 0
const getTestProjectId = () => `test-cmd-exec-${Date.now()}-${++testCounter}`

// Store original implementations for restoration
const originalFunctions: Record<string, unknown> = {}

// =============================================================================
// Mock Factories
// =============================================================================

function createMockTemplate(overrides = {}) {
  return {
    name: 'test-command',
    content: '# Test Command\n\nTest content',
    frontmatter: {
      'allowed-tools': ['Read', 'Write', 'Bash'],
      ...overrides,
    },
  }
}

function createMockContext(projectId: string, overrides = {}) {
  return {
    projectId,
    projectPath: TEST_BASE_DIR,
    globalPath: TEST_BASE_DIR,
    projectName: 'test-project',
    ecosystem: 'node',
    paths: {},
    params: {},
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    ...overrides,
  } as unknown as ReturnType<typeof contextBuilder.build> extends Promise<infer T> ? T : never
}

function createMockState(overrides = {}) {
  return {
    currentTask: null,
    pausedTasks: [],
    ...overrides,
  } as Record<string, unknown>
}

// =============================================================================
// Tests: signalStart / signalEnd
// =============================================================================

describe('CommandExecutor', () => {
  beforeAll(async () => {
    await fsPromises.mkdir(TEST_BASE_DIR, { recursive: true })
    process.env.PRJCT_CLI_HOME = TEST_PRJCT_HOME
  })

  afterAll(async () => {
    if (ORIGINAL_PRJCT_CLI_HOME === undefined) {
      delete process.env.PRJCT_CLI_HOME
    } else {
      process.env.PRJCT_CLI_HOME = ORIGINAL_PRJCT_CLI_HOME
    }

    try {
      await fsPromises.rm(TEST_BASE_DIR, { recursive: true, force: true })
    } catch (_error) {
      // Ignore cleanup errors
    }
  })

  describe('signalStart', () => {
    afterEach(() => {
      // Clean up the running file after each test
      try {
        if (fs.existsSync(RUNNING_FILE)) {
          fs.unlinkSync(RUNNING_FILE)
        }
      } catch (_error) {
        // Ignore
      }
    })

    it('should create status file with command name', async () => {
      await signalStart('test-command')

      expect(fs.existsSync(RUNNING_FILE)).toBe(true)
      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:test-command')
    })

    it('should overwrite existing status file', async () => {
      await signalStart('first-command')
      await signalStart('second-command')

      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:second-command')
    })

    it('should handle filesystem errors gracefully', async () => {
      // This test verifies that errors are silently ignored
      // We can't easily simulate fs errors, but we can verify the function doesn't throw
      await expect(signalStart('test-command')).resolves.toBeUndefined()
    })
  })

  describe('signalEnd', () => {
    it('should remove status file if it exists', async () => {
      // Create the file first
      await signalStart('test-command')
      expect(fs.existsSync(RUNNING_FILE)).toBe(true)

      await signalEnd()
      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })

    it('should not throw if file does not exist', async () => {
      // Ensure file doesn't exist
      try {
        fs.unlinkSync(RUNNING_FILE)
      } catch (_error) {
        // Ignore
      }

      await expect(signalEnd()).resolves.toBeUndefined()
    })
  })

  describe('CommandExecutor class', () => {
    let executor: CommandExecutor

    beforeEach(() => {
      executor = new CommandExecutor()
    })

    it('should have signalStart method that calls module function', async () => {
      await executor.signalStart('class-test')

      expect(fs.existsSync(RUNNING_FILE)).toBe(true)
      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:class-test')

      // Cleanup
      await executor.signalEnd()
    })

    it('should have signalEnd method that calls module function', async () => {
      await executor.signalStart('class-test')
      await executor.signalEnd()

      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })
  })
})

// =============================================================================
// Tests: execute (main flow)
// =============================================================================

describe('execute', () => {
  let executor: CommandExecutor
  let TEST_PROJECT_ID: string

  beforeAll(() => {
    // Store original implementations
    originalFunctions['loopDetector.shouldEscalate'] = loopDetector.shouldEscalate
    originalFunctions['loopDetector.getEscalationInfo'] = loopDetector.getEscalationInfo
    originalFunctions['loopDetector.recordSuccess'] = loopDetector.recordSuccess
    originalFunctions['loopDetector.recordAttempt'] = loopDetector.recordAttempt
    originalFunctions['templateLoader.load'] = templateLoader.load
    originalFunctions['contextBuilder.build'] = contextBuilder.build
    originalFunctions['contextBuilder.loadState'] = contextBuilder.loadState
    originalFunctions['contextBuilder.loadStateForCommand'] = contextBuilder.loadStateForCommand
    originalFunctions['planMode.requiresPlanning'] = planMode.requiresPlanning
    originalFunctions['planMode.isDestructive'] = planMode.isDestructive
    originalFunctions['planMode.isInPlanningMode'] = planMode.isInPlanningMode
    originalFunctions['planMode.getAllowedTools'] = planMode.getAllowedTools
    originalFunctions['memorySystem.getSmartDecision'] = memorySystem.getSmartDecision
    originalFunctions['memorySystem.getRelevantMemories'] = memorySystem.getRelevantMemories
    originalFunctions['promptBuilder.build'] = promptBuilder.build
  })

  beforeEach(() => {
    executor = new CommandExecutor()
    TEST_PROJECT_ID = getTestProjectId()

    // Reset all mocks to default behavior
    loopDetector.shouldEscalate = mock(() => false)
    loopDetector.getEscalationInfo = mock(() => null)
    loopDetector.recordSuccess = mock(() => {})
    loopDetector.recordAttempt = mock(() => ({
      attemptNumber: 1,
      isLooping: false,
      shouldEscalate: false,
    }))

    // Mock planMode
    planMode.requiresPlanning = mock(() => false)
    planMode.isDestructive = mock(() => false)
    planMode.isInPlanningMode = mock(() => false)
    planMode.getAllowedTools = mock(() => ['Read', 'Write', 'Bash'])

    // Mock memorySystem
    memorySystem.getSmartDecision = mock(() => Promise.resolve(null))
    memorySystem.getRelevantMemories = mock(() => Promise.resolve([]))

    // Mock promptBuilder
    promptBuilder.build = mock(() => Promise.resolve('built prompt'))
  })

  afterEach(() => {
    // Restore original implementations
    loopDetector.shouldEscalate = originalFunctions[
      'loopDetector.shouldEscalate'
    ] as typeof loopDetector.shouldEscalate
    loopDetector.getEscalationInfo = originalFunctions[
      'loopDetector.getEscalationInfo'
    ] as typeof loopDetector.getEscalationInfo
    loopDetector.recordSuccess = originalFunctions[
      'loopDetector.recordSuccess'
    ] as typeof loopDetector.recordSuccess
    loopDetector.recordAttempt = originalFunctions[
      'loopDetector.recordAttempt'
    ] as typeof loopDetector.recordAttempt
    templateLoader.load = originalFunctions['templateLoader.load'] as typeof templateLoader.load
    contextBuilder.build = originalFunctions['contextBuilder.build'] as typeof contextBuilder.build
    contextBuilder.loadState = originalFunctions[
      'contextBuilder.loadState'
    ] as typeof contextBuilder.loadState
    contextBuilder.loadStateForCommand = originalFunctions[
      'contextBuilder.loadStateForCommand'
    ] as typeof contextBuilder.loadStateForCommand
    planMode.requiresPlanning = originalFunctions[
      'planMode.requiresPlanning'
    ] as typeof planMode.requiresPlanning
    planMode.isDestructive = originalFunctions[
      'planMode.isDestructive'
    ] as typeof planMode.isDestructive
    planMode.isInPlanningMode = originalFunctions[
      'planMode.isInPlanningMode'
    ] as typeof planMode.isInPlanningMode
    planMode.getAllowedTools = originalFunctions[
      'planMode.getAllowedTools'
    ] as typeof planMode.getAllowedTools
    memorySystem.getSmartDecision = originalFunctions[
      'memorySystem.getSmartDecision'
    ] as typeof memorySystem.getSmartDecision
    memorySystem.getRelevantMemories = originalFunctions[
      'memorySystem.getRelevantMemories'
    ] as typeof memorySystem.getRelevantMemories
    promptBuilder.build = originalFunctions['promptBuilder.build'] as typeof promptBuilder.build

    // Clean up running file
    try {
      if (fs.existsSync(RUNNING_FILE)) {
        fs.unlinkSync(RUNNING_FILE)
      }
    } catch (_error) {
      // Ignore
    }
  })

  describe('loop detection', () => {
    it('should return escalation when loop detected before execution', async () => {
      loopDetector.shouldEscalate = mock(() => true)
      loopDetector.getEscalationInfo = mock(() => ({
        message: 'Command stuck in loop',
        suggestion: 'Try a different approach',
        attemptCount: 3,
      })) as unknown as typeof loopDetector.getEscalationInfo

      const result = await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      expect(result.success).toBe(false)
      expect(result.isLoopDetected).toBe(true)
      expect(result.error).toBe('Command stuck in loop')
      expect(result.suggestion).toBe('Try a different approach')
    })

    it('should record successful execution', async () => {
      const mockTemplate = createMockTemplate()
      const mockContext = createMockContext(TEST_PROJECT_ID)
      const mockState = createMockState()

      templateLoader.load = mock(() => Promise.resolve(mockTemplate))
      contextBuilder.build = mock(() => Promise.resolve(mockContext)) as typeof contextBuilder.build
      contextBuilder.loadState = mock(() =>
        Promise.resolve(mockState)
      ) as typeof contextBuilder.loadState
      contextBuilder.loadStateForCommand = mock(() =>
        Promise.resolve(mockState)
      ) as typeof contextBuilder.loadStateForCommand

      await executor.execute('test-cmd', { task: 'test task' }, TEST_BASE_DIR)

      expect(loopDetector.recordSuccess).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle template loading errors', async () => {
      templateLoader.load = mock(() => Promise.reject(new Error('Template not found')))

      const result = await executor.execute('nonexistent', {}, TEST_BASE_DIR)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Template not found')
    })

    it('should handle context building errors', async () => {
      const mockTemplate = createMockTemplate()
      templateLoader.load = mock(() => Promise.resolve(mockTemplate))
      contextBuilder.build = mock(() => Promise.reject(new Error('Context build failed')))

      const result = await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Context build failed')
    })

    it('should record failed attempts for loop detection', async () => {
      templateLoader.load = mock(() => Promise.reject(new Error('Some error')))

      await executor.execute('test-cmd', { task: 'test task' }, TEST_BASE_DIR)

      expect(loopDetector.recordAttempt).toHaveBeenCalled()
    })

    it('should escalate after repeated failures', async () => {
      templateLoader.load = mock(() => Promise.reject(new Error('Repeated error')))
      loopDetector.recordAttempt = mock(() => ({
        attemptNumber: 3,
        isLooping: true,
        shouldEscalate: true,
      }))
      loopDetector.getEscalationInfo = mock(() => ({
        message: 'Too many failures',
        suggestion: 'Check your setup',
        attemptCount: 3,
      })) as unknown as typeof loopDetector.getEscalationInfo

      const result = await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      expect(result.success).toBe(false)
      expect(result.isLoopDetected).toBe(true)
      expect(result.error).toBe('Too many failures')
    })
  })

  describe('signal lifecycle', () => {
    it('should call signalStart at beginning and signalEnd on success', async () => {
      const mockTemplate = createMockTemplate()
      const mockContext = createMockContext(TEST_PROJECT_ID)
      const mockState = createMockState()

      templateLoader.load = mock(() => Promise.resolve(mockTemplate))
      contextBuilder.build = mock(() => Promise.resolve(mockContext)) as typeof contextBuilder.build
      contextBuilder.loadState = mock(() =>
        Promise.resolve(mockState)
      ) as typeof contextBuilder.loadState
      contextBuilder.loadStateForCommand = mock(() =>
        Promise.resolve(mockState)
      ) as typeof contextBuilder.loadStateForCommand

      // File shouldn't exist before
      expect(fs.existsSync(RUNNING_FILE)).toBe(false)

      await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      // File should be cleaned up after
      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })

    it('should call signalEnd on error', async () => {
      templateLoader.load = mock(() => Promise.reject(new Error('Test error')))

      await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      // File should be cleaned up even after error
      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })

    it('should call signalEnd on loop detection', async () => {
      loopDetector.shouldEscalate = mock(() => true)
      loopDetector.getEscalationInfo = mock(() => ({
        message: 'Loop detected',
        suggestion: 'Stop',
        attemptCount: 3,
      })) as unknown as typeof loopDetector.getEscalationInfo

      await executor.execute('test-cmd', {}, TEST_BASE_DIR)

      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })
  })
})

// =============================================================================
// Tests: Default Export
// =============================================================================

describe('default export', () => {
  it('should export singleton instance', () => {
    expect(commandExecutor).toBeInstanceOf(CommandExecutor)
  })

  it('should have all expected methods', () => {
    expect(typeof commandExecutor.signalStart).toBe('function')
    expect(typeof commandExecutor.signalEnd).toBe('function')
    expect(typeof commandExecutor.execute).toBe('function')
  })
})
