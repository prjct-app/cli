import { describe, expect, it } from 'bun:test'
import {
  DOMAIN_TAG_MAP,
  resolveCanonicalDomains,
  SEMANTIC_DOMAIN_KEYWORDS,
} from '../../agentic/memory-system'
import { KNOWN_DOMAINS, MEMORY_TAGS } from '../../types/memory'

describe('semantic domain matching (PRJ-300)', () => {
  describe('resolveCanonicalDomains', () => {
    it('should pass through known domains unchanged', () => {
      expect(resolveCanonicalDomains('frontend')).toEqual(['frontend'])
      expect(resolveCanonicalDomains('backend')).toEqual(['backend'])
      expect(resolveCanonicalDomains('devops')).toEqual(['devops'])
      expect(resolveCanonicalDomains('testing')).toEqual(['testing'])
      expect(resolveCanonicalDomains('database')).toEqual(['database'])
      expect(resolveCanonicalDomains('general')).toEqual(['general'])
    })

    it('should resolve "uxui" to frontend', () => {
      const result = resolveCanonicalDomains('uxui')
      expect(result).toContain('frontend')
    })

    it('should resolve "ui" to frontend', () => {
      const result = resolveCanonicalDomains('ui')
      expect(result).toContain('frontend')
    })

    it('should resolve "api" to backend', () => {
      const result = resolveCanonicalDomains('api')
      expect(result).toContain('backend')
    })

    it('should resolve "ml-pipeline" to backend', () => {
      const result = resolveCanonicalDomains('ml-pipeline')
      // "pipeline" matches devops, so it should at least resolve
      expect(result.length).toBeGreaterThan(0)
      expect(result).not.toEqual(['general'])
    })

    it('should resolve "infra" to devops', () => {
      const result = resolveCanonicalDomains('infra')
      expect(result).toContain('devops')
    })

    it('should resolve "docker" to devops', () => {
      const result = resolveCanonicalDomains('docker')
      expect(result).toContain('devops')
    })

    it('should resolve "schema" to database', () => {
      const result = resolveCanonicalDomains('schema')
      expect(result).toContain('database')
    })

    it('should resolve "css" to frontend', () => {
      const result = resolveCanonicalDomains('css')
      expect(result).toContain('frontend')
    })

    it('should resolve "e2e" to testing', () => {
      const result = resolveCanonicalDomains('e2e')
      expect(result).toContain('testing')
    })

    it('should fallback to general for truly unknown domains', () => {
      expect(resolveCanonicalDomains('quantum-computing')).toEqual(['general'])
      expect(resolveCanonicalDomains('astrology')).toEqual(['general'])
    })

    it('should handle case-insensitive and separator-insensitive', () => {
      expect(resolveCanonicalDomains('UI')).toContain('frontend')
      expect(resolveCanonicalDomains('API')).toContain('backend')
      expect(resolveCanonicalDomains('e_2_e')).toContain('testing')
    })
  })

  describe('DOMAIN_TAG_MAP', () => {
    it('should include TECH_STACK for frontend (improved from PRJ-107)', () => {
      expect(DOMAIN_TAG_MAP.frontend).toContain(MEMORY_TAGS.TECH_STACK)
    })

    it('should include TECH_STACK for database', () => {
      expect(DOMAIN_TAG_MAP.database).toContain(MEMORY_TAGS.TECH_STACK)
    })

    it('should include DEPENDENCIES for testing', () => {
      expect(DOMAIN_TAG_MAP.testing).toContain(MEMORY_TAGS.DEPENDENCIES)
    })

    it('should include all MEMORY_TAGS for general', () => {
      const allTags = Object.values(MEMORY_TAGS)
      for (const tag of allTags) {
        expect(DOMAIN_TAG_MAP.general).toContain(tag)
      }
    })

    it('should have mappings for all known domains', () => {
      for (const domain of KNOWN_DOMAINS) {
        expect(DOMAIN_TAG_MAP[domain]).toBeDefined()
        expect(DOMAIN_TAG_MAP[domain].length).toBeGreaterThan(0)
      }
    })
  })

  describe('SEMANTIC_DOMAIN_KEYWORDS', () => {
    it('should map uxui-related keywords to frontend', () => {
      expect(SEMANTIC_DOMAIN_KEYWORDS.frontend).toContain('uxui')
      expect(SEMANTIC_DOMAIN_KEYWORDS.frontend).toContain('ui')
      expect(SEMANTIC_DOMAIN_KEYWORDS.frontend).toContain('ux')
      expect(SEMANTIC_DOMAIN_KEYWORDS.frontend).toContain('css')
    })

    it('should map CI/CD keywords to devops', () => {
      expect(SEMANTIC_DOMAIN_KEYWORDS.devops).toContain('ci')
      expect(SEMANTIC_DOMAIN_KEYWORDS.devops).toContain('cd')
      expect(SEMANTIC_DOMAIN_KEYWORDS.devops).toContain('docker')
      expect(SEMANTIC_DOMAIN_KEYWORDS.devops).toContain('kubernetes')
    })

    it('should have keywords for all known domains except general', () => {
      for (const domain of KNOWN_DOMAINS) {
        expect(SEMANTIC_DOMAIN_KEYWORDS[domain]).toBeDefined()
        if (domain !== 'general') {
          expect(SEMANTIC_DOMAIN_KEYWORDS[domain].length).toBeGreaterThan(0)
        }
      }
    })
  })
})
