/**
 * FS Types Tests
 * Tests for file system error utilities
 */

import { describe, expect, it } from 'bun:test'
import {
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
  isNotFoundError,
  isPermissionError,
} from '../../types/fs'

describe('FS Error Utilities', () => {
  describe('isNotFoundError', () => {
    it('should return true for ENOENT error', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isNotFoundError(error)).toBe(true)
    })

    it('should return false for other error codes', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException
      error.code = 'EACCES'
      expect(isNotFoundError(error)).toBe(false)
    })

    it('should return false for errors without code', () => {
      const error = new Error('Generic error')
      expect(isNotFoundError(error)).toBe(false)
    })

    it('should return false for non-error values', () => {
      expect(isNotFoundError(null)).toBe(false)
      expect(isNotFoundError(undefined)).toBe(false)
      expect(isNotFoundError('string')).toBe(false)
    })
  })

  describe('isPermissionError', () => {
    it('should return true for EACCES error', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException
      error.code = 'EACCES'
      expect(isPermissionError(error)).toBe(true)
    })

    it('should return true for EPERM error', () => {
      const error = new Error('Operation not permitted') as NodeJS.ErrnoException
      error.code = 'EPERM'
      expect(isPermissionError(error)).toBe(true)
    })

    it('should return false for other error codes', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isPermissionError(error)).toBe(false)
    })
  })

  describe('isDirNotEmptyError', () => {
    it('should return true for ENOTEMPTY error', () => {
      const error = new Error('Directory not empty') as NodeJS.ErrnoException
      error.code = 'ENOTEMPTY'
      expect(isDirNotEmptyError(error)).toBe(true)
    })

    it('should return false for other error codes', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isDirNotEmptyError(error)).toBe(false)
    })
  })

  describe('isFileExistsError', () => {
    it('should return true for EEXIST error', () => {
      const error = new Error('File exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      expect(isFileExistsError(error)).toBe(true)
    })

    it('should return false for other error codes', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isFileExistsError(error)).toBe(false)
    })
  })

  describe('isNodeError', () => {
    it('should return true for Error with code property', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isNodeError(error)).toBe(true)
    })

    it('should return false for Error without code property', () => {
      const error = new Error('Generic error')
      expect(isNodeError(error)).toBe(false)
    })

    it('should return false for non-Error values', () => {
      expect(isNodeError(null)).toBe(false)
      expect(isNodeError({ code: 'ENOENT' })).toBe(false) // Not an Error instance
    })
  })

  describe('SyntaxError handling pattern', () => {
    it('should differentiate SyntaxError from fs errors', () => {
      const syntaxError = new SyntaxError('Unexpected token')
      const fsError = new Error('File not found') as NodeJS.ErrnoException
      fsError.code = 'ENOENT'

      // Pattern used in code
      const handleError = (error: unknown): string => {
        if (isNotFoundError(error)) return 'not-found'
        if (error instanceof SyntaxError) return 'parse-error'
        return 'other'
      }

      expect(handleError(fsError)).toBe('not-found')
      expect(handleError(syntaxError)).toBe('parse-error')
      expect(handleError(new Error('Other'))).toBe('other')
    })
  })
})
