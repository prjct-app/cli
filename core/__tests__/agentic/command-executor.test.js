import { describe, it, expect } from 'vitest'
import commandExecutor from '../../agentic/command-executor.js'

describe('Command Executor', () => {
  const testProjectPath = process.cwd()

  describe('execute()', () => {
    it('should execute command successfully', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    it('should load template', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result.template).toBeDefined()
      expect(result.template).toHaveProperty('content')
      expect(result.template).toHaveProperty('frontmatter')
    })

    it('should build context', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result.context).toBeDefined()
      expect(result.context).toHaveProperty('projectId')
      expect(result.context).toHaveProperty('projectPath')
      expect(result.context).toHaveProperty('paths')
    })

    it('should load state', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result.state).toBeDefined()
      expect(typeof result.state).toBe('object')
    })

    it('should build prompt', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result.prompt).toBeDefined()
      expect(typeof result.prompt).toBe('string')
      expect(result.prompt.length).toBeGreaterThan(0)
    })

    it('should pass parameters to context', async () => {
      const params = { taskName: 'Test Task', feature: 'Test Feature' }
      const result = await commandExecutor.execute('now', params, testProjectPath)

      expect(result.context.params).toEqual(params)
    })

    it('should handle different commands', async () => {
      const commands = ['now', 'done', 'next', 'ship']

      for (const cmd of commands) {
        const result = await commandExecutor.execute(cmd, {}, testProjectPath)
        expect(result.success).toBe(true)
      }
    })

    it('should handle non-existent command', async () => {
      const result = await commandExecutor.execute('nonexistent', {}, testProjectPath)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('Template not found')
    })

    it('should include all execution data', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('template')
      expect(result).toHaveProperty('context')
      expect(result).toHaveProperty('state')
      expect(result).toHaveProperty('prompt')
    })
  })

  describe('executeTool()', () => {
    it('should execute allowed tool', async () => {
      const allowedTools = ['Read', 'Write', 'Bash']
      const result = await commandExecutor.executeTool('Read', [__filename], allowedTools)

      expect(result).toBeDefined()
    })

    it('should throw error for disallowed tool', async () => {
      const allowedTools = ['Read']

      await expect(commandExecutor.executeTool('Write', ['file.txt', 'content'], allowedTools)).rejects.toThrow(
        'Tool Write not allowed for this command'
      )
    })

    it('should execute Read tool', async () => {
      const allowedTools = ['Read']
      const content = await commandExecutor.executeTool('Read', [__filename], allowedTools)

      expect(content).toBeDefined()
      expect(content).toContain('Command Executor')
    })

    it('should handle tool errors', async () => {
      const allowedTools = ['Read']

      await expect(commandExecutor.executeTool('UnknownTool', [], allowedTools)).rejects.toThrow()
    })

    it('should check permissions before execution', async () => {
      const allowedTools = ['Read']

      // Bash not allowed
      await expect(commandExecutor.executeTool('Bash', ['echo test'], allowedTools)).rejects.toThrow(
        'not allowed'
      )
    })
  })

  describe('executeSimple()', () => {
    it('should execute simple command', async () => {
      const executionFn = async (_tools, _context) => {
        return { message: 'Executed successfully' }
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ message: 'Executed successfully' })
    })

    it('should provide tools to execution function', async () => {
      const executionFn = async (_tools, _context) => {
        expect(_tools).toHaveProperty('read')
        expect(_tools).toHaveProperty('write')
        expect(_tools).toHaveProperty('bash')
        return { tools: 'available' }
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      expect(result.success).toBe(true)
    })

    it('should provide context to execution function', async () => {
      const executionFn = async (_tools, _context) => {
        expect(_context).toBeDefined()
        expect(_context).toHaveProperty('projectId')
        expect(_context).toHaveProperty('projectPath')
        return { context: 'received' }
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      expect(result.success).toBe(true)
    })

    it('should enforce tool permissions', async () => {
      const executionFn = async (_tools, _context) => {
        // Try to use a disallowed tool
        await _tools.write('/test/file.txt', 'content')
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      // Should fail if Write is not in allowed tools for 'now'
      expect(result.success).toBe(false)
    })

    it('should handle execution errors', async () => {
      const executionFn = async (_tools, _context) => {
        throw new Error('Execution failed')
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Execution failed')
    })

    it('should work with allowed tools', async () => {
      const executionFn = async (_tools, _context) => {
        // Read is typically allowed
        const content = await _tools.read(__filename)
        return { readSuccess: content !== null }
      }

      const result = await commandExecutor.executeSimple('now', executionFn, testProjectPath)

      expect(result.success).toBe(true)
      expect(result.result.readSuccess).toBe(true)
    })
  })

  describe('Integration', () => {
    it('should execute full command flow', async () => {
      const result = await commandExecutor.execute('now', { task: 'Test Task' }, testProjectPath)

      expect(result.success).toBe(true)
      expect(result.template).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.state).toBeDefined()
      expect(result.prompt).toBeDefined()

      // Prompt should include the template content
      expect(result.prompt).toContain(result.template.content)

      // Context should include parameters
      expect(result.context.params.task).toBe('Test Task')
    })

    it('should build proper prompt structure', async () => {
      const result = await commandExecutor.execute('now', {}, testProjectPath)

      expect(result.prompt).toContain('# Command Instructions')
      expect(result.prompt).toContain('## Project Context')
      expect(result.prompt).toContain('## Current State')
      expect(result.prompt).toContain('## Execute')
    })
  })
})
