/**
 * Command Context Tests
 *
 * Tests for config-driven command context resolution,
 * classification, caching, and auto-learn.
 *
 * @see PRJ-298
 */

import { describe, expect, it } from 'bun:test'
import { classifyCommand } from '../../agentic/command-classifier'
import {
  cacheClassification,
  getCachedClassification,
  loadCommandContextConfig,
  resolveCommandContext,
  resolveCommandContextFull,
  trackClassification,
} from '../../agentic/command-context'
import type { CommandContextEntry } from '../../schemas/command-context'
import type { Template } from '../../types/agentic'

// =============================================================================
// Config Loading
// =============================================================================

describe('Command Context Config', () => {
  it('should load and validate the config file', async () => {
    const config = await loadCommandContextConfig()

    expect(config.version).toBe('1.0.0')
    expect(config.commands).toBeDefined()
    expect(config.commands['*']).toBeDefined()
  })

  it('should have wildcard entry with sensible defaults', async () => {
    const config = await loadCommandContextConfig()
    const wildcard = config.commands['*']

    expect(wildcard.agents).toBe(true)
    expect(wildcard.patterns).toBe(true)
    expect(wildcard.checklist).toBe(false)
    expect(wildcard.modules).toEqual([])
  })

  it('should have explicit entries for known commands', async () => {
    const config = await loadCommandContextConfig()

    expect(config.commands.task).toBeDefined()
    expect(config.commands.ship).toBeDefined()
    expect(config.commands.bug).toBeDefined()
    expect(config.commands.done).toBeDefined()
    expect(config.commands.sync).toBeDefined()
  })
})

// =============================================================================
// Config Resolution
// =============================================================================

describe('resolveCommandContext', () => {
  it('should return explicit config for known commands', async () => {
    const config = await loadCommandContextConfig()
    const entry = resolveCommandContext(config, 'task')

    expect(entry.modules).toContain('CLAUDE-intelligence.md')
    expect(entry.modules).toContain('CLAUDE-storage.md')
  })

  it('should return wildcard for unknown commands', async () => {
    const config = await loadCommandContextConfig()
    const entry = resolveCommandContext(config, 'nonexistent-command')
    const wildcard = config.commands['*']

    expect(entry).toEqual(wildcard)
  })

  it('should give ship command patterns and checklist', async () => {
    const config = await loadCommandContextConfig()
    const entry = resolveCommandContext(config, 'ship')

    expect(entry.patterns).toBe(true)
    expect(entry.checklist).toBe(true)
  })

  it('should give done command checklist', async () => {
    const config = await loadCommandContextConfig()
    const entry = resolveCommandContext(config, 'done')

    expect(entry.checklist).toBe(true)
  })

  it('should give sync command no context sections', async () => {
    const config = await loadCommandContextConfig()
    const entry = resolveCommandContext(config, 'sync')

    expect(entry.agents).toBe(false)
    expect(entry.patterns).toBe(false)
    expect(entry.checklist).toBe(false)
    expect(entry.modules).toEqual([])
  })
})

// =============================================================================
// Full Resolution with Classification
// =============================================================================

describe('resolveCommandContextFull', () => {
  it('should return source=config for known commands', async () => {
    const config = await loadCommandContextConfig()
    const result = resolveCommandContextFull(config, 'bug')

    expect(result.source).toBe('config')
    expect(result.entry.agents).toBe(true)
  })

  it('should classify unknown commands from template', async () => {
    const config = await loadCommandContextConfig()
    const template: Template = {
      frontmatter: {
        name: 'p:deploy',
        description: 'Deploy the application to production',
        'allowed-tools': ['Bash', 'Read'],
      },
      content: 'Build and deploy the project. Verify deployment status.',
    }

    const result = resolveCommandContextFull(config, 'deploy', template)
    expect(result.source).toBe('classified')
  })

  it('should return source=cache for previously classified commands', async () => {
    const config = await loadCommandContextConfig()
    const entry: CommandContextEntry = {
      agents: true,
      patterns: false,
      checklist: false,
      modules: [],
    }
    cacheClassification('cached-cmd', entry)

    const result = resolveCommandContextFull(config, 'cached-cmd')
    expect(result.source).toBe('cache')
    expect(result.entry).toEqual(entry)
  })

  it('should return source=wildcard when no template provided for unknown command', async () => {
    const config = await loadCommandContextConfig()
    const result = resolveCommandContextFull(config, 'truly-unknown-no-template')

    expect(result.source).toBe('wildcard')
  })
})

// =============================================================================
// Command Classifier
// =============================================================================

describe('classifyCommand', () => {
  it('should return sensible default for any command', () => {
    const template: Template = {
      frontmatter: {
        name: 'p:scaffold',
        description: 'Scaffold a new component',
        'allowed-tools': ['Write', 'Read', 'Bash'],
      },
      content: 'Create the component files and implement the structure.',
    }

    const result = classifyCommand('scaffold', template)
    expect(result.agents).toBe(true)
    expect(result.patterns).toBe(true)
    expect(result.checklist).toBe(false)
    expect(result.modules).toEqual([])
  })

  it('should return same default for info commands', () => {
    const template: Template = {
      frontmatter: {
        name: 'p:stats',
        description: 'Show project statistics',
        'allowed-tools': ['Read'],
      },
      content: 'Display a summary of the project status and metrics.',
    }

    const result = classifyCommand('stats', template)
    expect(result.agents).toBe(true)
    expect(result.patterns).toBe(true)
  })

  it('should return same default for quality commands', () => {
    const template: Template = {
      frontmatter: {
        name: 'p:verify',
        description: 'Verify project integrity',
        'allowed-tools': ['Read', 'Bash'],
      },
      content: 'Validate all tests pass and lint checks succeed before release.',
    }

    const result = classifyCommand('verify', template)
    expect(result.agents).toBe(true)
    expect(result.patterns).toBe(true)
    expect(result.checklist).toBe(false)
  })
})

// =============================================================================
// Classification Cache
// =============================================================================

describe('Classification Cache', () => {
  it('should cache and retrieve classifications', () => {
    const entry: CommandContextEntry = {
      agents: true,
      patterns: true,
      checklist: false,
      modules: ['test.md'],
    }
    cacheClassification('test-cache', entry)

    const cached = getCachedClassification('test-cache')
    expect(cached).toEqual(entry)
  })

  it('should return undefined for uncached commands', () => {
    const cached = getCachedClassification('never-cached')
    expect(cached).toBeUndefined()
  })
})

// =============================================================================
// Auto-Learn Tracking
// =============================================================================

describe('Auto-Learn (trackClassification)', () => {
  it('should not trigger persist on first classification', () => {
    const entry: CommandContextEntry = {
      agents: true,
      patterns: true,
      checklist: false,
      modules: [],
    }
    const shouldPersist = trackClassification('learn-test-1', entry)

    expect(shouldPersist).toBe(false)
  })

  it('should trigger persist after threshold reached', () => {
    const entry: CommandContextEntry = {
      agents: false,
      patterns: true,
      checklist: true,
      modules: [],
    }

    trackClassification('learn-test-2', entry) // 1
    trackClassification('learn-test-2', entry) // 2
    const shouldPersist = trackClassification('learn-test-2', entry) // 3

    expect(shouldPersist).toBe(true)
  })

  it('should reset count when classification changes', () => {
    const entry1: CommandContextEntry = {
      agents: true,
      patterns: true,
      checklist: false,
      modules: [],
    }
    const entry2: CommandContextEntry = {
      agents: false,
      patterns: false,
      checklist: true,
      modules: [],
    }

    trackClassification('learn-test-3', entry1) // 1
    trackClassification('learn-test-3', entry1) // 2
    const shouldPersist = trackClassification('learn-test-3', entry2) // reset to 1

    expect(shouldPersist).toBe(false)
  })
})
