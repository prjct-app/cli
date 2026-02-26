import { describe, expect, it } from 'bun:test'
import { resolveCanonicalDomains } from '../../agentic/memory-system'

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

    it('should return general for non-known domains', () => {
      expect(resolveCanonicalDomains('uxui')).toEqual(['general'])
      expect(resolveCanonicalDomains('ui')).toEqual(['general'])
      expect(resolveCanonicalDomains('api')).toEqual(['general'])
      expect(resolveCanonicalDomains('infra')).toEqual(['general'])
      expect(resolveCanonicalDomains('docker')).toEqual(['general'])
      expect(resolveCanonicalDomains('schema')).toEqual(['general'])
      expect(resolveCanonicalDomains('css')).toEqual(['general'])
      expect(resolveCanonicalDomains('e2e')).toEqual(['general'])
    })

    it('should fallback to general for truly unknown domains', () => {
      expect(resolveCanonicalDomains('quantum-computing')).toEqual(['general'])
      expect(resolveCanonicalDomains('astrology')).toEqual(['general'])
    })
  })
})
