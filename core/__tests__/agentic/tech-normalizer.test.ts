import { describe, expect, it } from 'bun:test'
import {
  deduplicateTechStack,
  extractTechNames,
  getFrameworkFamily,
  matchesTech,
  normalizeFrameworkName,
} from '../../agentic/tech-normalizer'

describe('tech-normalizer', () => {
  describe('normalizeFrameworkName', () => {
    it('should lowercase and trim', () => {
      expect(normalizeFrameworkName('  TypeScript ')).toBe('typescript')
      expect(normalizeFrameworkName('React')).toBe('react')
    })

    it('should preserve dotted names', () => {
      expect(normalizeFrameworkName('Next.js')).toBe('next.js')
      expect(normalizeFrameworkName('Vue.js')).toBe('vue.js')
    })
  })

  describe('extractTechNames', () => {
    it('should split on + separator', () => {
      expect(extractTechNames('React + TypeScript')).toEqual(['react', 'typescript'])
    })

    it('should extract from parentheses', () => {
      expect(extractTechNames('Next.js (React)')).toEqual(['next.js', 'react'])
    })

    it('should split on "with"', () => {
      expect(extractTechNames('Hono with Zod')).toEqual(['hono', 'zod'])
    })

    it('should split on commas', () => {
      expect(extractTechNames('React, Vue, Angular')).toEqual(['react', 'vue', 'angular'])
    })

    it('should handle single name', () => {
      expect(extractTechNames('React')).toEqual(['react'])
    })
  })

  describe('getFrameworkFamily', () => {
    it('should return normalized name (LLM knows framework relationships)', () => {
      expect(getFrameworkFamily('Next.js')).toBe('next.js')
      expect(getFrameworkFamily('React')).toBe('react')
      expect(getFrameworkFamily('Express')).toBe('express')
      expect(getFrameworkFamily('Hono')).toBe('hono')
    })
  })

  describe('matchesTech', () => {
    it('should match exact names (case-insensitive)', () => {
      expect(matchesTech('React', 'react')).toBe(true)
      expect(matchesTech('react', 'React')).toBe(true)
    })

    it('should match compound names', () => {
      expect(matchesTech('React + TypeScript', 'react')).toBe(true)
      expect(matchesTech('React + TypeScript', 'typescript')).toBe(true)
    })

    it('should match parenthesized names', () => {
      expect(matchesTech('Next.js (React)', 'react')).toBe(true)
      expect(matchesTech('Next.js (React)', 'next.js')).toBe(true)
    })

    it('should not match unrelated frameworks', () => {
      expect(matchesTech('Vue', 'react')).toBe(false)
      expect(matchesTech('Angular', 'react')).toBe(false)
    })
  })

  describe('deduplicateTechStack', () => {
    it('should remove case-insensitive duplicates', () => {
      expect(deduplicateTechStack(['React', 'react', 'REACT'])).toEqual(['React'])
    })

    it('should preserve unique entries', () => {
      expect(deduplicateTechStack(['React', 'Next.js', 'TypeScript'])).toEqual([
        'React',
        'Next.js',
        'TypeScript',
      ])
    })

    it('should preserve first occurrence casing', () => {
      expect(deduplicateTechStack(['Next.js', 'next.js', 'NEXT.JS'])).toEqual(['Next.js'])
    })

    it('should handle empty array', () => {
      expect(deduplicateTechStack([])).toEqual([])
    })
  })
})
