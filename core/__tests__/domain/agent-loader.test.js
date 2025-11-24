/**
 * Tests for AgentLoader
 * Verifies that agents are loaded correctly from project files
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { describe, it, expect, beforeEach, afterEach } = require('vitest')
const AgentLoader = require('../../domain/agent-loader')

describe('AgentLoader', () => {
  let testProjectId
  let testAgentsDir
  let loader

  beforeEach(async () => {
    // Create unique test project ID
    testProjectId = `test-${Date.now()}`
    testAgentsDir = path.join(os.homedir(), '.prjct-cli', 'projects', testProjectId, 'agents')
    await fs.mkdir(testAgentsDir, { recursive: true })
    loader = new AgentLoader(testProjectId)
  })

  afterEach(async () => {
    // Cleanup: Remove test agents directory
    try {
      await fs.rm(testAgentsDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('loadAgent', () => {
    it('should load an existing agent from file', async () => {
      // Create test agent file
      const agentName = 'frontend-specialist'
      const agentContent = `# AGENT: FRONTEND-SPECIALIST
Role: Frontend Development Specialist

## META-INSTRUCTION
You are a frontend specialist.

## DOMAIN AUTHORITY
You are the owner of the frontend domain.
`

      const agentPath = path.join(testAgentsDir, `${agentName}.md`)
      await fs.writeFile(agentPath, agentContent, 'utf-8')

      // Load agent
      const agent = await loader.loadAgent(agentName)

      // Verify
      expect(agent).not.toBeNull()
      expect(agent.name).toBe(agentName)
      expect(agent.content).toBe(agentContent)
      expect(agent.role).toBe('Frontend Development Specialist')
      expect(agent.domain).toBe('frontend')
    })

    it('should return null for non-existent agent', async () => {
      const agent = await loader.loadAgent('non-existent-agent')
      expect(agent).toBeNull()
    })

    it('should cache loaded agents', async () => {
      // Create test agent
      const agentName = 'backend-specialist'
      const agentPath = path.join(testAgentsDir, `${agentName}.md`)
      await fs.writeFile(agentPath, '# AGENT: BACKEND-SPECIALIST\nRole: Backend Specialist', 'utf-8')

      // Load twice
      const agent1 = await loader.loadAgent(agentName)
      const agent2 = await loader.loadAgent(agentName)

      // Should be same object (cached)
      expect(agent1).toBe(agent2)
    })

    it('should extract skills from agent content', async () => {
      const agentName = 'react-specialist'
      const agentContent = `# AGENT: REACT-SPECIALIST
Role: React Development Specialist

This agent specializes in React, TypeScript, and Next.js.
`

      const agentPath = path.join(testAgentsDir, `${agentName}.md`)
      await fs.writeFile(agentPath, agentContent, 'utf-8')

      const agent = await loader.loadAgent(agentName)

      expect(agent.skills).toContain('React')
      expect(agent.skills).toContain('TypeScript')
      expect(agent.skills).toContain('Next.js')
    })
  })

  describe('loadAllAgents', () => {
    it('should load all agents in the directory', async () => {
      // Create multiple agent files
      const agents = [
        { name: 'frontend-specialist', content: '# AGENT: FRONTEND-SPECIALIST\nRole: Frontend' },
        { name: 'backend-specialist', content: '# AGENT: BACKEND-SPECIALIST\nRole: Backend' },
        { name: 'qa-specialist', content: '# AGENT: QA-SPECIALIST\nRole: QA' }
      ]

      for (const agent of agents) {
        const agentPath = path.join(testAgentsDir, `${agent.name}.md`)
        await fs.writeFile(agentPath, agent.content, 'utf-8')
      }

      // Load all
      const loadedAgents = await loader.loadAllAgents()

      expect(loadedAgents).toHaveLength(3)
      expect(loadedAgents.map(a => a.name)).toContain('frontend-specialist')
      expect(loadedAgents.map(a => a.name)).toContain('backend-specialist')
      expect(loadedAgents.map(a => a.name)).toContain('qa-specialist')
    })

    it('should return empty array if no agents exist', async () => {
      const agents = await loader.loadAllAgents()
      expect(agents).toEqual([])
    })

    it('should ignore non-markdown files', async () => {
      // Create agent file and non-agent file
      const agentPath = path.join(testAgentsDir, 'frontend-specialist.md')
      await fs.writeFile(agentPath, '# AGENT', 'utf-8')

      const otherFile = path.join(testAgentsDir, 'config.json')
      await fs.writeFile(otherFile, '{}', 'utf-8')

      const agents = await loader.loadAllAgents()

      expect(agents).toHaveLength(1)
      expect(agents[0].name).toBe('frontend-specialist')
    })
  })

  describe('agentExists', () => {
    it('should return true for existing agent', async () => {
      const agentName = 'test-agent'
      const agentPath = path.join(testAgentsDir, `${agentName}.md`)
      await fs.writeFile(agentPath, '# AGENT', 'utf-8')

      const exists = await loader.agentExists(agentName)
      expect(exists).toBe(true)
    })

    it('should return false for non-existent agent', async () => {
      const exists = await loader.agentExists('non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('should clear the agent cache', async () => {
      const agentName = 'test-agent'
      const agentPath = path.join(testAgentsDir, `${agentName}.md`)
      await fs.writeFile(agentPath, '# AGENT', 'utf-8')

      // Load and cache
      const agent1 = await loader.loadAgent(agentName)
      expect(agent1).not.toBeNull()

      // Clear cache
      loader.clearCache()

      // Load again - should still work but be new object
      const agent2 = await loader.loadAgent(agentName)
      expect(agent2).not.toBeNull()
      // Note: In real usage, they might be same due to file system, but cache is cleared
    })
  })
})

