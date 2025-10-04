import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import AgentGenerator from '../../domain/agent-generator.js'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('Agent Generator', () => {
  const testProjectId = 'test-agent-gen-' + Date.now()
  let generator
  let agentsDir

  beforeEach(() => {
    generator = new AgentGenerator(testProjectId)
    agentsDir = path.join(os.homedir(), '.prjct-cli', 'projects', testProjectId, 'agents')
  })

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(agentsDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Constructor', () => {
    it('should create generator with project ID', () => {
      expect(generator.projectId).toBe(testProjectId)
      expect(generator.outputDir).toContain(testProjectId)
    })

    it('should use fallback directory without project ID', () => {
      const fallbackGenerator = new AgentGenerator()
      expect(fallbackGenerator.outputDir).toContain('.prjct-cli/agents')
      expect(fallbackGenerator.outputDir).not.toContain('projects')
    })

    it('should construct correct output path', () => {
      expect(generator.outputDir).toBe(agentsDir)
    })
  })

  describe('generateDynamicAgent()', () => {
    it('should generate agent file', async () => {
      await generator.generateDynamicAgent('test-agent', {
        role: 'Test Agent Role',
        expertise: 'Test Technologies',
        responsibilities: 'Test Responsibilities',
      })

      const agentFile = path.join(agentsDir, 'test-agent.md')
      const exists = await fs
        .access(agentFile)
        .then(() => true)
        .catch(() => false)

      expect(exists).toBe(true)
    })

    it('should create agent with correct content', async () => {
      await generator.generateDynamicAgent('backend-agent', {
        role: 'Backend Developer',
        expertise: 'Node.js, Express, PostgreSQL',
        responsibilities: 'API development and database management',
      })

      const content = await fs.readFile(path.join(agentsDir, 'backend-agent.md'), 'utf-8')

      expect(content).toContain('# Backend Developer')
      expect(content).toContain('## Role')
      expect(content).toContain('Backend Developer')
      expect(content).toContain('## Expertise')
      expect(content).toContain('Node.js, Express, PostgreSQL')
      expect(content).toContain('## Responsibilities')
      expect(content).toContain('API development and database management')
    })

    it('should include project context in agent file', async () => {
      await generator.generateDynamicAgent('context-agent', {
        role: 'Agent with Context',
        expertise: 'Testing',
        responsibilities: 'Test things',
        projectContext: {
          framework: 'React',
          version: '18.0',
        },
      })

      const content = await fs.readFile(path.join(agentsDir, 'context-agent.md'), 'utf-8')

      expect(content).toContain('## Project Context')
      expect(content).toContain('framework')
      expect(content).toContain('React')
      expect(content).toContain('version')
      expect(content).toContain('18.0')
    })

    it('should handle missing optional fields', async () => {
      await generator.generateDynamicAgent('minimal-agent', {
        role: 'Minimal Role',
      })

      const content = await fs.readFile(path.join(agentsDir, 'minimal-agent.md'), 'utf-8')

      expect(content).toContain('# Minimal Role')
      expect(content).toContain('Technologies used in this project')
      expect(content).toContain('Handle specific aspects of development')
      expect(content).toContain('No additional context')
    })

    it('should create output directory if not exists', async () => {
      const newProjectId = 'new-project-' + Date.now()
      const newGenerator = new AgentGenerator(newProjectId)
      const newAgentsDir = path.join(os.homedir(), '.prjct-cli', 'projects', newProjectId, 'agents')

      await newGenerator.generateDynamicAgent('auto-create', {
        role: 'Auto Created Agent',
      })

      const exists = await fs
        .access(newAgentsDir)
        .then(() => true)
        .catch(() => false)

      expect(exists).toBe(true)

      // Cleanup
      await fs.rm(path.join(os.homedir(), '.prjct-cli', 'projects', newProjectId), {
        recursive: true,
        force: true,
      })
    })

    it('should create multiple agents', async () => {
      await generator.generateDynamicAgent('agent-1', { role: 'Agent One' })
      await generator.generateDynamicAgent('agent-2', { role: 'Agent Two' })
      await generator.generateDynamicAgent('agent-3', { role: 'Agent Three' })

      const agents = await generator.listAgents()

      expect(agents).toHaveLength(3)
      expect(agents).toContain('agent-1')
      expect(agents).toContain('agent-2')
      expect(agents).toContain('agent-3')
    })

    it('should use agent name as fallback for role', async () => {
      await generator.generateDynamicAgent('fallback-agent', {})

      const content = await fs.readFile(path.join(agentsDir, 'fallback-agent.md'), 'utf-8')

      expect(content).toContain('# fallback-agent')
    })
  })

  describe('cleanupObsoleteAgents()', () => {
    beforeEach(async () => {
      // Create some test agents
      await generator.generateDynamicAgent('agent-1', { role: 'Agent 1' })
      await generator.generateDynamicAgent('agent-2', { role: 'Agent 2' })
      await generator.generateDynamicAgent('agent-3', { role: 'Agent 3' })
    })

    it('should remove obsolete agents', async () => {
      const removed = await generator.cleanupObsoleteAgents(['agent-1', 'agent-2'])

      expect(removed).toContain('agent-3')
      expect(removed).toHaveLength(1)
    })

    it('should keep required agents', async () => {
      await generator.cleanupObsoleteAgents(['agent-1', 'agent-2'])

      const agents = await generator.listAgents()

      expect(agents).toContain('agent-1')
      expect(agents).toContain('agent-2')
      expect(agents).not.toContain('agent-3')
    })

    it('should remove multiple obsolete agents', async () => {
      await generator.generateDynamicAgent('agent-4', { role: 'Agent 4' })

      const removed = await generator.cleanupObsoleteAgents(['agent-1'])

      expect(removed).toHaveLength(3)
      expect(removed).toContain('agent-2')
      expect(removed).toContain('agent-3')
      expect(removed).toContain('agent-4')
    })

    it('should return empty array if all agents are required', async () => {
      const removed = await generator.cleanupObsoleteAgents(['agent-1', 'agent-2', 'agent-3'])

      expect(removed).toEqual([])
    })

    it('should handle non-existent directory gracefully', async () => {
      const emptyGenerator = new AgentGenerator('empty-' + Date.now())

      const removed = await emptyGenerator.cleanupObsoleteAgents(['agent-1'])

      expect(Array.isArray(removed)).toBe(true)
    })
  })

  describe('listAgents()', () => {
    it('should list all agents', async () => {
      await generator.generateDynamicAgent('frontend', { role: 'Frontend' })
      await generator.generateDynamicAgent('backend', { role: 'Backend' })

      const agents = await generator.listAgents()

      expect(agents).toHaveLength(2)
      expect(agents).toContain('frontend')
      expect(agents).toContain('backend')
    })

    it('should return empty array for no agents', async () => {
      const agents = await generator.listAgents()

      expect(agents).toEqual([])
    })

    it('should ignore non-.md files', async () => {
      await generator.generateDynamicAgent('valid-agent', { role: 'Valid' })
      await fs.writeFile(path.join(agentsDir, 'not-agent.txt'), 'text file')
      await fs.writeFile(path.join(agentsDir, 'config.json'), '{}')

      const agents = await generator.listAgents()

      expect(agents).toHaveLength(1)
      expect(agents).toContain('valid-agent')
    })

    it('should ignore hidden files', async () => {
      await generator.generateDynamicAgent('visible', { role: 'Visible' })
      await fs.writeFile(path.join(agentsDir, '.hidden.md'), 'hidden')

      const agents = await generator.listAgents()

      expect(agents).toHaveLength(1)
      expect(agents).toContain('visible')
    })
  })

  describe('Integration', () => {
    it('should create, list, and cleanup agents', async () => {
      // Create agents
      await generator.generateDynamicAgent('keep-me', { role: 'Keep' })
      await generator.generateDynamicAgent('remove-me', { role: 'Remove' })

      // Verify they exist
      let agents = await generator.listAgents()
      expect(agents).toHaveLength(2)

      // Cleanup obsolete
      const removed = await generator.cleanupObsoleteAgents(['keep-me'])
      expect(removed).toContain('remove-me')

      // Verify cleanup
      agents = await generator.listAgents()
      expect(agents).toHaveLength(1)
      expect(agents).toContain('keep-me')
    })

    it('should handle agent file content correctly', async () => {
      await generator.generateDynamicAgent('full-agent', {
        role: 'Full Stack Developer',
        expertise: 'React, Node.js, PostgreSQL, Docker',
        responsibilities: 'Build and deploy full stack applications',
        projectContext: {
          stack: 'MERN',
          deployment: 'AWS',
        },
      })

      const content = await fs.readFile(path.join(agentsDir, 'full-agent.md'), 'utf-8')

      // Should have all sections
      expect(content).toContain('# Full Stack Developer')
      expect(content).toContain('## Role')
      expect(content).toContain('## Expertise')
      expect(content).toContain('## Responsibilities')
      expect(content).toContain('## Project Context')
      expect(content).toContain('## Guidelines')

      // Should have all content
      expect(content).toContain('Full Stack Developer')
      expect(content).toContain('React, Node.js, PostgreSQL, Docker')
      expect(content).toContain('Build and deploy full stack applications')
      expect(content).toContain('MERN')
      expect(content).toContain('AWS')
    })
  })
})
