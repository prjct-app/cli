/**
 * Output Module Tests
 * Minimal output system for prjct-cli
 */

const out = require('../../utils/output')

describe('Output Module', () => {
  let consoleLogSpy
  let stdoutWriteSpy

  beforeEach(() => {
    // Mock console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // Mock process.stdout.write
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {})
    // Ensure spinner is stopped before each test
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
      // Should be truncated to ~65 chars + checkmark
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
    it('should start spinner with message', () => {
      vi.useFakeTimers()

      out.spin('loading')

      // Advance timer to trigger interval
      vi.advanceTimersByTime(100)

      expect(stdoutWriteSpy).toHaveBeenCalled()
      const output = stdoutWriteSpy.mock.calls[0][0]
      expect(output).toContain('loading')

      out.stop()
      vi.useRealTimers()
    })

    it('should return self for chaining', () => {
      const result = out.spin('test')
      out.stop()
      expect(result).toBe(out)
    })
  })

  describe('stop()', () => {
    it('should stop spinner and clear line', () => {
      vi.useFakeTimers()

      out.spin('loading')
      vi.advanceTimersByTime(100)

      stdoutWriteSpy.mockClear()
      out.stop()

      // Should write clearing spaces
      expect(stdoutWriteSpy).toHaveBeenCalled()

      vi.useRealTimers()
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
      expect(() => out.done(null)).not.toThrow()
      expect(() => out.done(undefined)).not.toThrow()
    })

    it('should handle messages with special characters', () => {
      out.done('test with émojis 🎉 and spëcial çhars')
      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })
})
