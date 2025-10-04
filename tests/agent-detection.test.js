import { describe, it, expect, beforeEach } from 'vitest'
import agentDetector from '../core/infrastructure/agent-detector.js'

/**
 * Test suite for Claude agent detection system
 * 100% Claude-focused architecture
 *
 * @version 0.7.0
 */

describe('Agent Detection System', () => {
  beforeEach(() => {
    agentDetector.reset()
  })

  describe('Auto-Detection', () => {
    it('should detect an agent', async () => {
      const detected = await agentDetector.detect()

      expect(detected).toBeDefined()
      expect(detected.name).toBeDefined()
      expect(detected.type).toBeDefined()
      expect(detected.config).toBeDefined()
      expect(detected.capabilities).toBeDefined()
    })

    it('should have valid capabilities', async () => {
      const detected = await agentDetector.detect()

      expect(detected.capabilities).toHaveProperty('mcp')
      expect(detected.capabilities).toHaveProperty('markdown')
      expect(detected.capabilities).toHaveProperty('colors')
      expect(detected.capabilities).toHaveProperty('interactive')
      expect(detected.capabilities).toHaveProperty('agents')
    })

    it('should have valid config', async () => {
      const detected = await agentDetector.detect()

      expect(detected.config).toHaveProperty('commandPrefix')
      expect(detected.config).toHaveProperty('responseStyle')
    })
  })

  describe('Claude Environment Detection', () => {
    it('should detect Claude environment', () => {
      const isClaude = agentDetector.isClaudeEnvironment()
      expect(typeof isClaude).toBe('boolean')
    })

    it('should have detection methods', () => {
      expect(typeof agentDetector.isClaude).toBe('function')
      expect(typeof agentDetector.isTerminal).toBe('function')
    })
  })

  describe('Force Agent Selection', () => {
    it('should allow setting Claude agent', () => {
      const claude = agentDetector.setAgent('claude')

      expect(claude).toBeDefined()
      expect(claude.type).toBe('claude')
      expect(claude.capabilities.mcp).toBe(true)
      expect(claude.config.responseStyle).toBe('rich')
    })

    it('should allow setting terminal agent', () => {
      const terminal = agentDetector.setAgent('terminal')

      expect(terminal).toBeDefined()
      expect(terminal.type).toBe('terminal')
      expect(terminal.capabilities.agents).toBe(false)
      expect(terminal.config.commandPrefix).toBe('prjct')
    })
  })

  describe('Environment Variable Detection', () => {
    it('should detect CLAUDE_AGENT env variable', async () => {
      process.env.CLAUDE_AGENT = 'true'
      agentDetector.reset()

      const detected = await agentDetector.detect()
      expect(detected.type).toBe('claude')

      delete process.env.CLAUDE_AGENT
    })

    it('should detect MCP_AVAILABLE env variable', async () => {
      process.env.MCP_AVAILABLE = 'true'
      agentDetector.reset()

      const detected = await agentDetector.detect()
      expect(detected.capabilities.mcp).toBe(true)

      delete process.env.MCP_AVAILABLE
    })
  })

  describe('Helper Methods', () => {
    it('should provide isClaude() helper', async () => {
      await agentDetector.detect()
      const result = agentDetector.isClaude()
      expect(typeof result).toBe('boolean')
    })

    it('should provide isTerminal() helper', async () => {
      await agentDetector.detect()
      const result = agentDetector.isTerminal()
      expect(typeof result).toBe('boolean')
    })

    it('should have opposite results for isClaude and isTerminal', async () => {
      await agentDetector.detect()
      const isClaude = agentDetector.isClaude()
      const isTerminal = agentDetector.isTerminal()

      // Either Claude OR Terminal, not both
      expect(isClaude !== isTerminal).toBe(true)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset agent detection', async () => {
      await agentDetector.detect()
      agentDetector.reset()

      // After reset, detecting again should work
      const detected = await agentDetector.detect()
      expect(detected).toBeDefined()
    })
  })
})
