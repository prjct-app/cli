import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

const require = createRequire(import.meta.url)

describe('Mandatory Agent Router', () => {
  let MandatoryAgentRouter
  let AgentGenerator
  let router
  let mockAgentGenerator

  beforeEach(() => {
    MandatoryAgentRouter = require('../../agentic/agent-router.js')
    AgentGenerator = require('../../domain/agent-generator.js')
    
    // Mock agent generator
    mockAgentGenerator = {
      generateDynamicAgent: vi.fn().mockResolvedValue({
        name: 'test-agent',
        type: 'frontend-specialist',
        domain: 'frontend',
        confidence: 0.9
      })
    }

    router = new MandatoryAgentRouter()
    router.agentGenerator = mockAgentGenerator
  })

  describe('Constructor', () => {
    it('should initialize with agent generator', () => {
      expect(router.agentGenerator).toBeDefined()
      expect(router.agentCache).toBeInstanceOf(Map)
      expect(Array.isArray(router.usageLog)).toBe(true)
    })
  })

  describe('executeTask()', () => {
    it('should assign agent to task', async () => {
      const task = { description: 'create login component', type: 'ui' }
      const context = { projectPath: '/test', files: [] }
      const projectPath = '/test'

      const result = await router.executeTask(task, context, projectPath)

      expect(result).toBeDefined()
      expect(result.agent).toBeDefined()
      expect(result.agent.name).toBe('test-agent')
      expect(result.context).toBeDefined()
      expect(result.taskAnalysis).toBeDefined()
      expect(result.routing).toBeDefined()
    })

    it('should throw error if no agent can be assigned', async () => {
      router.agentGenerator.generateDynamicAgent = vi.fn().mockResolvedValue(null)
      
      const task = { description: 'unknown task' }
      const context = { projectPath: '/test' }
      const projectPath = '/test'

      await expect(router.executeTask(task, context, projectPath)).rejects.toThrow('CRITICAL: No agent assigned')
    })

    it('should cache agents for reuse', async () => {
      const task = { description: 'create component', type: 'ui' }
      const context = { projectPath: '/test' }
      const projectPath = '/test'

      await router.executeTask(task, context, projectPath)
      await router.executeTask(task, context, projectPath)

      // Should only generate once, second call uses cache
      expect(mockAgentGenerator.generateDynamicAgent).toHaveBeenCalledTimes(1)
    })

    it('should log agent usage', async () => {
      const task = { description: 'test task' }
      const context = { projectPath: '/test', files: ['file1.js', 'file2.js'] }
      const projectPath = '/test'

      await router.executeTask(task, context, projectPath)

      expect(router.usageLog.length).toBeGreaterThan(0)
      expect(router.usageLog[0].task).toBe('test task')
      expect(router.usageLog[0].agent).toBe('test-agent')
    })
  })

  describe('analyzeTask()', () => {
    it('should detect frontend tasks', () => {
      const task = { description: 'create react component with styles' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('frontend')
      expect(analysis.confidence).toBeGreaterThan(0)
      expect(analysis.matchedKeywords.length).toBeGreaterThan(0)
    })

    it('should detect backend tasks', () => {
      const task = { description: 'create API endpoint with authentication' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('backend')
      expect(analysis.matchedKeywords).toContain('api')
    })

    it('should detect database tasks', () => {
      const task = { description: 'create migration schema for postgres' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('database')
      expect(analysis.matchedKeywords).toContain('migration')
    })

    it('should detect devops tasks', () => {
      const task = { description: 'deploy to docker kubernetes' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('devops')
    })

    it('should detect qa tasks', () => {
      const task = { description: 'write unit tests and fix bugs' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('qa')
    })

    it('should detect architecture tasks', () => {
      const task = { description: 'design architecture pattern and refactor' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('architecture')
    })

    it('should return generalist for unknown tasks', () => {
      const task = { description: 'random task description' }
      const analysis = router.analyzeTask(task)

      expect(analysis.domain).toBe('generalist')
      expect(analysis.confidence).toBeLessThan(1)
    })

    it('should include technology stack in analysis', () => {
      const task = { description: 'create react component with typescript' }
      const analysis = router.analyzeTask(task)

      expect(analysis.techStack).toBeDefined()
      expect(analysis.techStack.languages).toContain('typescript')
      expect(analysis.techStack.frameworks).toContain('react')
    })
  })

  describe('detectTechnology()', () => {
    it('should detect languages', () => {
      const task = { description: 'write python script' }
      const tech = router.detectTechnology(task, task.description)

      expect(tech.languages).toContain('python')
    })

    it('should detect frameworks', () => {
      const task = { description: 'build express api' }
      const tech = router.detectTechnology(task, task.description)

      expect(tech.frameworks).toContain('express')
    })

    it('should detect databases', () => {
      const task = { description: 'query mongodb database' }
      const tech = router.detectTechnology(task, task.description)

      expect(tech.databases).toContain('mongodb')
    })

    it('should return empty arrays for unknown tech', () => {
      const task = { description: 'random task' }
      const tech = router.detectTechnology(task, task.description)

      expect(tech.languages).toEqual([])
      expect(tech.frameworks).toEqual([])
      expect(tech.databases).toEqual([])
    })
  })

  describe('assignAgent()', () => {
    it('should generate agent for task', async () => {
      const taskAnalysis = {
        domain: 'frontend',
        techStack: { languages: ['typescript'], frameworks: ['react'] }
      }
      const context = { projectPath: '/test' }

      const agent = await router.assignAgent(taskAnalysis, context)

      expect(agent).toBeDefined()
      expect(mockAgentGenerator.generateDynamicAgent).toHaveBeenCalled()
    })

    it('should use cached agent if available', async () => {
      const taskAnalysis = {
        domain: 'frontend',
        techStack: { languages: ['typescript'] }
      }
      const context = { projectPath: '/test' }

      const agent1 = await router.assignAgent(taskAnalysis, context)
      const agent2 = await router.assignAgent(taskAnalysis, context)

      expect(agent1).toBe(agent2) // Same instance from cache
      expect(mockAgentGenerator.generateDynamicAgent).toHaveBeenCalledTimes(1)
    })
  })

  describe('filterContextForAgent()', () => {
    it('should filter context for frontend agent', async () => {
      const agent = { name: 'frontend-agent', domain: 'frontend' }
      const fullContext = {
        files: [
          'src/components/Button.jsx',
          'src/api/users.js',
          'src/styles/main.css',
          'migrations/001_users.sql'
        ]
      }
      const taskAnalysis = { domain: 'frontend' }

      const filtered = await router.filterContextForAgent(agent, fullContext, taskAnalysis)

      expect(filtered.files).toContain('src/components/Button.jsx')
      expect(filtered.files).toContain('src/styles/main.css')
      expect(filtered.files).not.toContain('migrations/001_users.sql')
      expect(filtered.relevantOnly).toBe(true)
    })

    it('should filter context for backend agent', async () => {
      const agent = { name: 'backend-agent', domain: 'backend' }
      const fullContext = {
        files: [
          'src/components/Button.jsx',
          'src/api/users.js',
          'src/routes/auth.js',
          'src/styles/main.css'
        ]
      }
      const taskAnalysis = { domain: 'backend' }

      const filtered = await router.filterContextForAgent(agent, fullContext, taskAnalysis)

      expect(filtered.files).toContain('src/api/users.js')
      expect(filtered.files).toContain('src/routes/auth.js')
      expect(filtered.files).not.toContain('src/styles/main.css')
    })

    it('should filter context for database agent', async () => {
      const agent = { name: 'database-agent', domain: 'database' }
      const fullContext = {
        files: [
          'src/models/User.js',
          'migrations/001_users.sql',
          'src/components/Button.jsx'
        ]
      }
      const taskAnalysis = { domain: 'database' }

      const filtered = await router.filterContextForAgent(agent, fullContext, taskAnalysis)

      expect(filtered.files).toContain('src/models/User.js')
      expect(filtered.files).toContain('migrations/001_users.sql')
      expect(filtered.files).not.toContain('src/components/Button.jsx')
    })
  })

  describe('filterFiles()', () => {
    it('should exclude files matching exclude patterns', () => {
      const files = ['src/app.js', 'node_modules/lib.js', 'dist/bundle.js']
      const pattern = {
        include: [],
        exclude: ['node_modules', 'dist'],
        extensions: []
      }

      const filtered = router.filterFiles(files, pattern)

      expect(filtered).not.toContain('node_modules/lib.js')
      expect(filtered).not.toContain('dist/bundle.js')
      expect(filtered).toContain('src/app.js')
    })

    it('should include only files matching include patterns', () => {
      const files = ['src/components/Button.jsx', 'src/api/users.js', 'tests/test.js']
      const pattern = {
        include: ['components'],
        exclude: [],
        extensions: []
      }

      const filtered = router.filterFiles(files, pattern)

      expect(filtered).toContain('src/components/Button.jsx')
      expect(filtered).not.toContain('src/api/users.js')
    })

    it('should filter by extensions', () => {
      const files = ['src/app.js', 'src/app.ts', 'src/app.py']
      const pattern = {
        include: [],
        exclude: [],
        extensions: ['.js', '.ts']
      }

      const filtered = router.filterFiles(files, pattern)

      expect(filtered).toContain('src/app.js')
      expect(filtered).toContain('src/app.ts')
      expect(filtered).not.toContain('src/app.py')
    })
  })

  describe('getBestPractices()', () => {
    it('should return domain-specific practices', async () => {
      const practices = await router.getBestPractices('frontend', { languages: [], frameworks: [] })

      expect(practices.length).toBeGreaterThan(0)
      expect(practices).toContain('Component composition over inheritance')
    })

    it('should include tech-specific practices', async () => {
      const practices = await router.getBestPractices('frontend', {
        languages: ['typescript'],
        frameworks: ['react']
      })

      expect(practices.some(p => p.includes('Hooks') || p.includes('TypeScript'))).toBe(true)
    })
  })

  describe('getSimilarDomains()', () => {
    it('should return similar domains for frontend', () => {
      const similar = router.getSimilarDomains('frontend')
      expect(similar).toContain('fullstack')
    })

    it('should return similar domains for backend', () => {
      const similar = router.getSimilarDomains('backend')
      expect(similar).toContain('fullstack')
    })

    it('should return default for unknown domain', () => {
      const similar = router.getSimilarDomains('unknown')
      expect(similar).toEqual(['generalist'])
    })
  })

  describe('getUsageStats()', () => {
    it('should return usage statistics', async () => {
      const task = { description: 'test task' }
      const context = { projectPath: '/test' }
      const projectPath = '/test'

      await router.executeTask(task, context, projectPath)
      await router.executeTask(task, context, projectPath)

      const stats = router.getUsageStats()

      expect(stats.totalTasks).toBe(2)
      expect(stats.byAgent).toBeDefined()
      expect(stats.mostUsedAgent).toBe('test-agent')
    })

    it('should handle empty usage log', () => {
      const stats = router.getUsageStats()

      expect(stats.totalTasks).toBe(0)
      expect(stats.mostUsedAgent).toBeNull()
    })
  })

  describe('calculateContextReduction()', () => {
    it('should calculate reduction for filtered context', () => {
      const filteredContext = { relevantOnly: true }
      const reduction = router.calculateContextReduction(filteredContext)

      expect(reduction).toBe('70-90%')
    })

    it('should return 0% for unfiltered context', () => {
      const context = { relevantOnly: false }
      const reduction = router.calculateContextReduction(context)

      expect(reduction).toBe('0%')
    })
  })
})

