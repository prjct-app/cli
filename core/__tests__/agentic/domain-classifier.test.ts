/**
 * Domain Classifier Tests
 * PRJ-299: LLM-based domain classification with fallback chain
 */

import { describe, expect, it } from 'bun:test'
import { hashDescription } from '../../agentic/domain-classifier'

describe('DomainClassifier PRJ-299', () => {
  // =================================================================
  // Hash Function
  // =================================================================
  describe('hashDescription', () => {
    it('should produce consistent hashes', () => {
      const hash1 = hashDescription('Fix the auth middleware')
      const hash2 = hashDescription('Fix the auth middleware')
      expect(hash1).toBe(hash2)
    })

    it('should be case-insensitive', () => {
      const hash1 = hashDescription('Fix the Auth Middleware')
      const hash2 = hashDescription('fix the auth middleware')
      expect(hash1).toBe(hash2)
    })

    it('should trim whitespace', () => {
      const hash1 = hashDescription('  Fix the auth middleware  ')
      const hash2 = hashDescription('Fix the auth middleware')
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different descriptions', () => {
      const hash1 = hashDescription('Fix frontend component')
      const hash2 = hashDescription('Fix backend service')
      expect(hash1).not.toBe(hash2)
    })

    it('should return a 16-character hex string', () => {
      const hash = hashDescription('Test description')
      expect(hash).toMatch(/^[a-f0-9]{16}$/)
    })
  })
})
