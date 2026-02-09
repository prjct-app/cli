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

    it('should resolve aliases', () => {
      expect(normalizeFrameworkName('NodeJS')).toBe('node')
      expect(normalizeFrameworkName('ts')).toBe('typescript')
      expect(normalizeFrameworkName('js')).toBe('javascript')
      expect(normalizeFrameworkName('pg')).toBe('postgres')
      expect(normalizeFrameworkName('postgresql')).toBe('postgres')
    })

    it('should preserve dotted names', () => {
      expect(normalizeFrameworkName('Next.js')).toBe('next.js')
      expect(normalizeFrameworkName('Vue.js')).toBe('vue')
    })

    it('should handle nextjs alias', () => {
      expect(normalizeFrameworkName('nextjs')).toBe('next.js')
      expect(normalizeFrameworkName('nuxtjs')).toBe('nuxt.js')
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
    it('should resolve meta-frameworks to base', () => {
      expect(getFrameworkFamily('next.js')).toBe('react')
      expect(getFrameworkFamily('Next.js')).toBe('react')
      expect(getFrameworkFamily('Remix')).toBe('react')
      expect(getFrameworkFamily('Gatsby')).toBe('react')
    })

    it('should resolve Vue meta-frameworks', () => {
      expect(getFrameworkFamily('nuxt')).toBe('vue')
      expect(getFrameworkFamily('Nuxt.js')).toBe('vue')
    })

    it('should resolve Svelte meta-framework', () => {
      expect(getFrameworkFamily('SvelteKit')).toBe('svelte')
    })

    it('should return name itself for base frameworks', () => {
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

    it('should match via framework family', () => {
      expect(matchesTech('Next.js', 'react')).toBe(true)
      expect(matchesTech('Nuxt', 'vue')).toBe(true)
      expect(matchesTech('SvelteKit', 'svelte')).toBe(true)
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

    it('should remove alias duplicates', () => {
      expect(deduplicateTechStack(['TypeScript', 'ts'])).toEqual(['TypeScript'])
      expect(deduplicateTechStack(['Node.js', 'nodejs'])).toEqual(['Node.js'])
    })

    it('should preserve unique entries', () => {
      expect(deduplicateTechStack(['React', 'Next.js', 'TypeScript'])).toEqual([
        'React',
        'Next.js',
        'TypeScript',
      ])
    })

    it('should preserve first occurrence casing', () => {
      expect(deduplicateTechStack(['Next.js', 'nextjs', 'NEXT.JS'])).toEqual(['Next.js'])
    })

    it('should handle empty array', () => {
      expect(deduplicateTechStack([])).toEqual([])
    })
  })
})
