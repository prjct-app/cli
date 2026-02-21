/**
 * Domain Classifier Tests
 * PRJ-299: LLM-based domain classification with fallback chain
 */

import { describe, expect, it } from 'bun:test'
import { classifyWithHeuristic, hashDescription } from '../../agentic/domain-classifier'
import type { DomainClassifierProjectContext as ProjectContext } from '../../types/agentic'

// Default project context for testing (all domains available)
const fullContext: ProjectContext = {
  domains: {
    hasFrontend: true,
    hasBackend: true,
    hasDatabase: true,
    hasTesting: true,
    hasDocker: true,
  },
  agents: ['frontend', 'backend', 'database', 'testing', 'devops'],
  stack: { language: 'TypeScript', framework: 'Hono' },
}

// Backend-only project context
const backendOnlyContext: ProjectContext = {
  domains: {
    hasFrontend: false,
    hasBackend: true,
    hasDatabase: false,
    hasTesting: false,
    hasDocker: false,
  },
  agents: ['backend'],
  stack: { language: 'TypeScript', framework: 'Hono' },
}

describe('DomainClassifier PRJ-299', () => {
  describe('classifyWithHeuristic', () => {
    // =================================================================
    // Substring Trap Tests (the whole reason for PRJ-299)
    // =================================================================
    describe('substring traps (critical fixes)', () => {
      it('should NOT match "author" to "auth" domain', () => {
        const result = classifyWithHeuristic('Fix the author display on profile page', fullContext)
        // "author" should NOT trigger backend (auth)
        // "profile page" and "display" should trigger frontend
        expect(result.primaryDomain).not.toBe('backend')
        expect(result.primaryDomain).toBe('frontend')
      })

      it('should match standalone "auth" to backend', () => {
        const result = classifyWithHeuristic(
          'Fix the auth middleware for JWT validation',
          fullContext
        )
        expect(result.primaryDomain).toBe('backend')
      })

      it('should NOT match "testament" to "test" domain', () => {
        const result = classifyWithHeuristic(
          'Update the testament of the old testament module',
          fullContext
        )
        expect(result.primaryDomain).not.toBe('testing')
      })

      it('should NOT match "button" to "but" in other domains', () => {
        const result = classifyWithHeuristic('Add a button component', fullContext)
        expect(result.primaryDomain).toBe('frontend')
      })

      it('should NOT match "configure" to "config" in devops', () => {
        // "configure" without a devops context word should not go to devops
        const result = classifyWithHeuristic('Configure the React component props', fullContext)
        expect(result.primaryDomain).toBe('frontend')
      })
    })

    // =================================================================
    // Correct Classification Tests
    // =================================================================
    describe('frontend detection', () => {
      it('should detect "Build responsive dashboard" as frontend', () => {
        const result = classifyWithHeuristic('Build responsive dashboard', fullContext)
        expect(result.primaryDomain).toBe('frontend')
      })

      it('should detect React component tasks', () => {
        const result = classifyWithHeuristic('Create a modal dialog for user settings', fullContext)
        expect(result.primaryDomain).toBe('frontend')
      })

      it('should detect CSS/styling tasks', () => {
        const result = classifyWithHeuristic(
          'Fix the layout for mobile responsive view',
          fullContext
        )
        expect(result.primaryDomain).toBe('frontend')
      })

      it('should detect page/navigation tasks', () => {
        const result = classifyWithHeuristic(
          'Add sidebar navigation with dropdown menus',
          fullContext
        )
        expect(result.primaryDomain).toBe('frontend')
      })
    })

    describe('backend detection', () => {
      it('should detect API endpoint tasks', () => {
        const result = classifyWithHeuristic(
          'Create REST API endpoint for user management',
          fullContext
        )
        expect(result.primaryDomain).toBe('backend')
      })

      it('should detect middleware tasks', () => {
        const result = classifyWithHeuristic('Add rate limiting middleware', fullContext)
        expect(result.primaryDomain).toBe('backend')
      })

      it('should detect authentication tasks', () => {
        const result = classifyWithHeuristic('Implement JWT authentication flow', fullContext)
        expect(result.primaryDomain).toBe('backend')
      })
    })

    describe('database detection', () => {
      it('should detect schema/migration tasks', () => {
        const result = classifyWithHeuristic(
          'Create database migration for users table',
          fullContext
        )
        expect(result.primaryDomain).toBe('database')
      })

      it('should detect connection pooling as database (not schema)', () => {
        const result = classifyWithHeuristic('Optimize database connection pooling', fullContext)
        expect(result.primaryDomain).toBe('database')
      })

      it('should detect ORM/Prisma tasks', () => {
        const result = classifyWithHeuristic('Update Prisma schema with new entity', fullContext)
        expect(result.primaryDomain).toBe('database')
      })
    })

    describe('devops detection', () => {
      it('should detect Docker tasks', () => {
        const result = classifyWithHeuristic(
          'Create Docker container for production deployment',
          fullContext
        )
        expect(result.primaryDomain).toBe('devops')
      })

      it('should detect CI/CD tasks', () => {
        const result = classifyWithHeuristic(
          'Fix the CI pipeline for automated deployment',
          fullContext
        )
        expect(result.primaryDomain).toBe('devops')
      })
    })

    describe('testing detection', () => {
      it('should detect test writing tasks', () => {
        const result = classifyWithHeuristic('Add unit tests for the payment service', fullContext)
        expect(result.primaryDomain).toBe('testing')
      })

      it('should detect coverage improvement tasks', () => {
        const result = classifyWithHeuristic('Improve test coverage for auth module', fullContext)
        expect(result.primaryDomain).toBe('testing')
      })
    })

    // =================================================================
    // Multi-domain Tasks
    // =================================================================
    describe('multi-domain tasks', () => {
      it('should detect secondary domains', () => {
        const result = classifyWithHeuristic(
          'Add API endpoint with React frontend component',
          fullContext
        )
        expect(result.secondaryDomains.length).toBeGreaterThan(0)
      })

      it('should limit secondary domains to 2', () => {
        const result = classifyWithHeuristic(
          'Add API endpoint with React component and Docker deploy with test coverage and database migration',
          fullContext
        )
        expect(result.secondaryDomains.length).toBeLessThanOrEqual(2)
      })
    })

    // =================================================================
    // Project Context Filtering
    // =================================================================
    describe('project context filtering', () => {
      it('should not classify as frontend when project has no frontend', () => {
        const result = classifyWithHeuristic(
          'Add a button component with responsive layout',
          backendOnlyContext
        )
        // Can't be frontend since project doesn't have it
        // Falls through to general or docs (always available)
        expect(result.primaryDomain).not.toBe('frontend')
      })

      it('should respect available agents', () => {
        const result = classifyWithHeuristic('Create REST API endpoint', backendOnlyContext)
        expect(result.primaryDomain).toBe('backend')
      })
    })

    // =================================================================
    // Confidence Scoring
    // =================================================================
    describe('confidence scoring', () => {
      it('should have higher confidence for strong signals than multi-domain', () => {
        // Single-domain (strong frontend signal) vs multi-domain (split between frontend and backend)
        const strong = classifyWithHeuristic(
          'Create React component with jsx tsx ui button form modal',
          fullContext
        )
        const split = classifyWithHeuristic(
          'Add API endpoint with React component and database query',
          fullContext
        )
        expect(strong.confidence).toBeGreaterThanOrEqual(split.confidence)
      })

      it('should cap confidence at 0.85 for heuristic', () => {
        const result = classifyWithHeuristic(
          'ui component react vue angular css style button form modal layout responsive animation',
          fullContext
        )
        expect(result.confidence).toBeLessThanOrEqual(0.85)
      })

      it('should return 0.3 confidence for unknown domains', () => {
        const result = classifyWithHeuristic(
          'Do something completely unrelated to any domain',
          fullContext
        )
        expect(result.confidence).toBe(0.3)
        expect(result.primaryDomain).toBe('general')
      })
    })

    // =================================================================
    // Edge Cases
    // =================================================================
    describe('edge cases', () => {
      it('should handle empty description', () => {
        const result = classifyWithHeuristic('', fullContext)
        expect(result.primaryDomain).toBe('general')
        expect(result.confidence).toBe(0.3)
      })

      it('should handle very long descriptions', () => {
        const longDesc = 'Fix the bug in the component '.repeat(100)
        const result = classifyWithHeuristic(longDesc, fullContext)
        expect(result.primaryDomain).toBeDefined()
      })

      it('should be case-insensitive', () => {
        const lower = classifyWithHeuristic('add react component', fullContext)
        const upper = classifyWithHeuristic('ADD REACT COMPONENT', fullContext)
        expect(lower.primaryDomain).toBe(upper.primaryDomain)
      })
    })
  })

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

  // =================================================================
  // File Patterns
  // =================================================================
  describe('file patterns', () => {
    it('should return frontend file patterns for frontend domain', () => {
      const result = classifyWithHeuristic('Add React component', fullContext)
      expect(result.filePatterns.length).toBeGreaterThan(0)
    })

    it('should return relevant agents', () => {
      const result = classifyWithHeuristic('Create REST API endpoint', fullContext)
      expect(result.relevantAgents).toContain('backend')
    })
  })
})
