/**
 * Error Handler Tests
 *
 * Tests for safeMcpCall wrapper and helper functions.
 */

import { describe, expect, it } from 'bun:test'
import { mcpError, mcpResult, safeMcpCall } from '../../mcp/tools/error-handler'

describe('MCP Error Handler', () => {
  describe('safeMcpCall', () => {
    it('should return handler result on success', async () => {
      const handler = safeMcpCall('test_tool', async () => {
        return { content: [{ type: 'text', text: 'success' }] }
      })

      const result = await handler({})
      expect(result.content[0].text).toBe('success')
      expect(result.isError).toBeUndefined()
    })

    it('should catch errors and return isError: true', async () => {
      const handler = safeMcpCall('test_tool', async () => {
        throw new Error('database connection failed')
      })

      const result = await handler({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('test_tool')
      expect(result.content[0].text).toContain('database connection failed')
    })

    it('should handle non-Error throws', async () => {
      const handler = safeMcpCall('test_tool', async () => {
        throw 'string error'
      })

      const result = await handler({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('string error')
    })

    it('should pass args through to handler', async () => {
      const handler = safeMcpCall('test_tool', async (args: { name: string }) => {
        return { content: [{ type: 'text', text: `hello ${args.name}` }] }
      })

      const result = await handler({ name: 'world' })
      expect(result.content[0].text).toBe('hello world')
    })
  })

  describe('mcpResult', () => {
    it('should build a text result', () => {
      const result = mcpResult('test message')
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toBe('test message')
    })
  })

  describe('mcpError', () => {
    it('should build an error result with Error object', () => {
      const result = mcpError(new Error('test error'), 'my_tool')
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('[my_tool]')
      expect(result.content[0].text).toContain('test error')
    })

    it('should handle string errors', () => {
      const result = mcpError('string error', 'my_tool')
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('string error')
    })
  })
})
