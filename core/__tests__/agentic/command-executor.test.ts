/**
 * Command Executor Tests
 * PRJ-82: Unit tests for command execution pipeline
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// Import dependencies to mock
import chainOfThought from '../../agentic/chain-of-thought'
// Import the module under test
import commandExecutor, {
  CommandExecutor,
  signalEnd,
  signalStart,
} from '../../agentic/command-executor'
import contextBuilder from '../../agentic/context-builder'
import groundTruth from '../../agentic/ground-truth'
import loopDetector from '../../agentic/loop-detector'
import memorySystem from '../../agentic/memory-system'
import planMode from '../../agentic/plan-mode'
import promptBuilder from '../../agentic/prompt-builder'
import templateExecutor from '../../agentic/template-executor'
import templateLoader from '../../agentic/template-loader'
import toolRegistry from '../../agentic/tool-registry'

// =============================================================================
// Test Setup
// =============================================================================

const TEST_BASE_DIR = path.join(process.cwd(), '.tmp', 'prjct-cli-tests', 'command-executor')
const RUNNING_FILE = path.join(os.homedir(), '.prjct-cli', '.running')

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
  })

  afterAll(async () => {
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

    it('should create status file with command name', () => {
      signalStart('test-command')

      expect(fs.existsSync(RUNNING_FILE)).toBe(true)
      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:test-command')
    })

    it('should overwrite existing status file', () => {
      signalStart('first-command')
      signalStart('second-command')

      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:second-command')
    })

    it('should handle filesystem errors gracefully', () => {
      // This test verifies that errors are silently ignored
      // We can't easily simulate fs errors, but we can verify the function doesn't throw
      expect(() => signalStart('test-command')).not.toThrow()
    })
  })

  describe('signalEnd', () => {
    it('should remove status file if it exists', () => {
      // Create the file first
      signalStart('test-command')
      expect(fs.existsSync(RUNNING_FILE)).toBe(true)

      signalEnd()
      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })

    it('should not throw if file does not exist', () => {
      // Ensure file doesn't exist
      try {
        fs.unlinkSync(RUNNING_FILE)
      } catch (_error) {
        // Ignore
      }

      expect(() => signalEnd()).not.toThrow()
    })
  })

  describe('CommandExecutor class', () => {
    let executor: CommandExecutor

    beforeEach(() => {
      executor = new CommandExecutor()
    })

    it('should have signalStart method that calls module function', () => {
      executor.signalStart('class-test')

      expect(fs.existsSync(RUNNING_FILE)).toBe(true)
      const content = fs.readFileSync(RUNNING_FILE, 'utf-8')
      expect(content).toBe('/p:class-test')

      // Cleanup
      executor.signalEnd()
    })

    it('should have signalEnd method that calls module function', () => {
      executor.signalStart('class-test')
      executor.signalEnd()

      expect(fs.existsSync(RUNNING_FILE)).toBe(false)
    })
  })
})

// =============================================================================
// Tests: executeTool
// =============================================================================

describe('executeTool', () => {
  let executor: CommandExecutor

  beforeAll(() => {
    // Store original toolRegistry methods
    originalFunctions['toolRegistry.isAllowed'] = toolRegistry.isAllowed
    originalFunctions['toolRegistry.get'] = toolRegistry.get
  })

  beforeEach(() => {
    executor = new CommandExecutor()
  })

  afterEach(() => {
    // Restore original methods
    toolRegistry.isAllowed = originalFunctions[
      'toolRegistry.isAllowed'
    ] as typeof toolRegistry.isAllowed
    toolRegistry.get = originalFunctions['toolRegistry.get'] as typeof toolRegistry.get
  })

  it('should reject tool not in allowed list', async () => {
    toolRegistry.isAllowed = mock(() => false)

    await expect(executor.executeTool('DangerousTool', [], ['Read', 'Write'])).rejects.toThrow(
      'Tool DangerousTool not allowed for this command'
    )
  })

  it('should throw if tool not found in registry', async () => {
    toolRegistry.isAllowed = mock(() => true)
    toolRegistry.get = mock(() => undefined)

    await expect(executor.executeTool('NonExistent', [], ['NonExistent'])).rejects.toThrow(
      'Tool NonExistent not found'
    )
  })

  it('should execute allowed tool successfully', async () => {
    const mockToolFn = mock(() => Promise.resolve('tool-result'))

    toolRegistry.isAllowed = mock(() => true)
    toolRegistry.get = mock(() => mockToolFn)

    const result = await executor.executeTool('Read', ['/path/to/file'], ['Read'])

    expect(result).toBe('tool-result')
    expect(mockToolFn).toHaveBeenCalledWith('/path/to/file')
  })

  it('should pass multiple arguments to tool', async () => {
    const mockToolFn = mock(() => Promise.resolve('written'))

    toolRegistry.isAllowed = mock(() => true)
    toolRegistry.get = mock(() => mockToolFn)

    const result = await executor.executeTool('Write', ['/path', 'content'], ['Write'])

    expect(result).toBe('written')
    expect(mockToolFn).toHaveBeenCalledWith('/path', 'content')
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
    originalFunctions['groundTruth.requiresVerification'] = groundTruth.requiresVerification
    originalFunctions['chainOfThought.requiresReasoning'] = chainOfThought.requiresReasoning
    originalFunctions['templateExecutor.buildContext'] = templateExecutor.buildContext
    originalFunctions['templateExecutor.buildAgenticPrompt'] = templateExecutor.buildAgenticPrompt
    originalFunctions['templateExecutor.requiresOrchestration'] =
      templateExecutor.requiresOrchestration
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

    // Mock groundTruth and chainOfThought
    groundTruth.requiresVerification = mock(() => false)
    chainOfThought.requiresReasoning = mock(() => false)

    // Mock templateExecutor
    templateExecutor.buildContext = mock(() =>
      Promise.resolve({
        projectPath: TEST_BASE_DIR,
        projectId: TEST_PROJECT_ID,
        globalPath: TEST_BASE_DIR,
        command: 'test-cmd',
        args: '',
        agentName: 'test-agent',
        agentSettingsPath: '',
        paths: {
          orchestrator: '',
          agentRouting: '',
          taskFragmentation: '',
          commandTemplate: '',
          repoAnalysis: '',
          agentsDir: '',
          skillsDir: '',
          stateJson: '',
        },
      })
    )
    templateExecutor.buildAgenticPrompt = mock(() => ({
      prompt: 'test prompt',
      context: {} as never,
      requiresOrchestration: false,
    }))
    templateExecutor.requiresOrchestration = mock(() => false)

    // Mock memorySystem
    memorySystem.getSmartDecision = mock(() => Promise.resolve(null))
    memorySystem.getRelevantMemories = mock(() => Promise.resolve([]))

    // Mock promptBuilder
    promptBuilder.build = mock(() => 'built prompt')
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
    groundTruth.requiresVerification = originalFunctions[
      'groundTruth.requiresVerification'
    ] as typeof groundTruth.requiresVerification
    chainOfThought.requiresReasoning = originalFunctions[
      'chainOfThought.requiresReasoning'
    ] as typeof chainOfThought.requiresReasoning
    templateExecutor.buildContext = originalFunctions[
      'templateExecutor.buildContext'
    ] as typeof templateExecutor.buildContext
    templateExecutor.buildAgenticPrompt = originalFunctions[
      'templateExecutor.buildAgenticPrompt'
    ] as typeof templateExecutor.buildAgenticPrompt
    templateExecutor.requiresOrchestration = originalFunctions[
      'templateExecutor.requiresOrchestration'
    ] as typeof templateExecutor.requiresOrchestration
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
// Tests: executeSimple
// =============================================================================

describe('executeSimple', () => {
  let executor: CommandExecutor
  let TEST_PROJECT_ID: string

  beforeAll(() => {
    originalFunctions['templateLoader.load'] = templateLoader.load
    originalFunctions['contextBuilder.build'] = contextBuilder.build
    originalFunctions['toolRegistry.isAllowed'] = toolRegistry.isAllowed
    originalFunctions['toolRegistry.get'] = toolRegistry.get
  })

  beforeEach(() => {
    executor = new CommandExecutor()
    TEST_PROJECT_ID = getTestProjectId()
  })

  afterEach(() => {
    templateLoader.load = originalFunctions['templateLoader.load'] as typeof templateLoader.load
    contextBuilder.build = originalFunctions['contextBuilder.build'] as typeof contextBuilder.build
    toolRegistry.isAllowed = originalFunctions[
      'toolRegistry.isAllowed'
    ] as typeof toolRegistry.isAllowed
    toolRegistry.get = originalFunctions['toolRegistry.get'] as typeof toolRegistry.get
  })

  it('should execute function with tools proxy', async () => {
    const mockTemplate = createMockTemplate({ 'allowed-tools': ['Read'] })
    const mockContext = createMockContext(TEST_PROJECT_ID)

    templateLoader.load = mock(() => Promise.resolve(mockTemplate))
    contextBuilder.build = mock(() => Promise.resolve(mockContext)) as typeof contextBuilder.build
    toolRegistry.isAllowed = mock(() => true)
    toolRegistry.get = mock(() => mock(() => Promise.resolve('file content')))

    const executionFn = mock(async (tools: { read: (path: string) => Promise<unknown> }) => {
      const content = await tools.read('/some/file')
      return { content }
    })

    const result = await executor.executeSimple('test-cmd', executionFn, TEST_BASE_DIR)

    expect(result.success).toBe(true)
    expect(result.result).toEqual({ content: 'file content' })
  })

  it('should check tool permissions in proxy', async () => {
    const mockTemplate = createMockTemplate({ 'allowed-tools': ['Read'] }) // Only Read allowed
    const mockContext = createMockContext(TEST_PROJECT_ID)

    templateLoader.load = mock(() => Promise.resolve(mockTemplate))
    contextBuilder.build = mock(() => Promise.resolve(mockContext)) as typeof contextBuilder.build
    toolRegistry.isAllowed = mock((tool: string, allowed: string[]) => allowed.includes(tool))

    const executionFn = mock(
      async (tools: { write: (path: string, content: string) => Promise<unknown> }) => {
        await tools.write('/some/file', 'content') // Try to use Write (not allowed)
        return {}
      }
    )

    const result = await executor.executeSimple('test-cmd', executionFn, TEST_BASE_DIR)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not allowed')
  })

  it('should handle execution function errors', async () => {
    const mockTemplate = createMockTemplate()
    const mockContext = createMockContext(TEST_PROJECT_ID)

    templateLoader.load = mock(() => Promise.resolve(mockTemplate))
    contextBuilder.build = mock(() => Promise.resolve(mockContext)) as typeof contextBuilder.build

    const executionFn = mock(async () => {
      throw new Error('Execution failed')
    })

    const result = await executor.executeSimple('test-cmd', executionFn, TEST_BASE_DIR)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Execution failed')
  })

  it('should handle template loading errors', async () => {
    templateLoader.load = mock(() => Promise.reject(new Error('Template not found')))

    const executionFn = mock(async () => ({}))

    const result = await executor.executeSimple('nonexistent', executionFn, TEST_BASE_DIR)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Template not found')
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
    expect(typeof commandExecutor.executeTool).toBe('function')
    expect(typeof commandExecutor.executeSimple).toBe('function')
  })
})
