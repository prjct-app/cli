/**
 * Output Module Tests
 * Minimal output system for prjct-cli
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import out from '../../utils/output'

describe('Output Module', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>
  let stdoutWriteSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = spyOn(process.stdout, 'write').mockImplementation(() => true)
    out.stop()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
    out.stop()
  })

  describe('done()', () => {
    it('should output success message with checkmark', () => {
      out.done('task completed')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      expect(output).toContain('✓')
      expect(output).toContain('task completed')
    })

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(100)
      out.done(longMessage)

      const output = consoleLogSpy.mock.calls[0][0]
      expect(output.length).toBeLessThan(80)
    })

    it('should return self for chaining', () => {
      const result = out.done('test')
      expect(result).toBe(out)
    })
  })

  describe('fail()', () => {
    it('should output error message with X mark', () => {
      out.fail('something failed')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      expect(output).toContain('✗')
      expect(output).toContain('something failed')
    })

    it('should truncate long error messages', () => {
      const longMessage = 'error '.repeat(50)
      out.fail(longMessage)

      const output = consoleLogSpy.mock.calls[0][0]
      expect(output.length).toBeLessThan(80)
    })

    it('should return self for chaining', () => {
      const result = out.fail('test')
      expect(result).toBe(out)
    })
  })

  describe('warn()', () => {
    it('should output warning message with warning symbol', () => {
      out.warn('be careful')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      expect(output).toContain('⚠')
      expect(output).toContain('be careful')
    })

    it('should return self for chaining', () => {
      const result = out.warn('test')
      expect(result).toBe(out)
    })
  })

  describe('spin()', () => {
    it('should start spinner with message', async () => {
      out.spin('loading')

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(stdoutWriteSpy).toHaveBeenCalled()
      const output = stdoutWriteSpy.mock.calls[0][0]
      expect(output).toContain('loading')

      out.stop()
    })

    it('should return self for chaining', () => {
      const result = out.spin('test')
      out.stop()
      expect(result).toBe(out)
    })
  })

  describe('stop()', () => {
    it('should stop spinner and clear line', async () => {
      out.spin('loading')
      await new Promise(resolve => setTimeout(resolve, 150))

      stdoutWriteSpy.mockClear()
      out.stop()

      expect(stdoutWriteSpy).toHaveBeenCalled()
    })

    it('should be safe to call multiple times', () => {
      expect(() => {
        out.stop()
        out.stop()
        out.stop()
      }).not.toThrow()
    })

    it('should return self for chaining', () => {
      const result = out.stop()
      expect(result).toBe(out)
    })
  })

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      expect(() => out.done('')).not.toThrow()
      expect(() => out.fail('')).not.toThrow()
      expect(() => out.warn('')).not.toThrow()
    })

    it('should handle null/undefined messages', () => {
      expect(() => out.done(null as unknown as string)).not.toThrow()
      expect(() => out.done(undefined as unknown as string)).not.toThrow()
    })

    it('should handle messages with special characters', () => {
      out.done('test with émojis 🎉 and spëcial çhars')
      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })
})
