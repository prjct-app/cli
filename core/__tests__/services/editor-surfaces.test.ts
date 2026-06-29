/**
 * Multi-editor surfaces are generated from ONE contract (harness pillar 4).
 *
 * Codex/Gemini/Antigravity surfaces compose the same atomic CONTRACT, so every
 * rig teaches the canonical verbs + sovereign KB and can never drift from the
 * Claude skill. Codex's ~1024-byte cap is honored with metadata headroom.
 */

import { describe, expect, it } from 'bun:test'
import {
  buildAntigravityConfig,
  buildAntigravitySkill,
  buildCodexSkill,
  buildGeminiConfig,
  CONTRACT,
} from '../../services/skill-generator/editor-surfaces'

const KB_FACETS = ['identity', 'voice', 'glossary', 'framework']
const CODEX_CAP = 1024

describe('multi-editor surfaces generated from one contract', () => {
  const codex = buildCodexSkill()
  const antigravitySkill = buildAntigravitySkill()
  const gemini = buildGeminiConfig()
  const antigravityConfig = buildAntigravityConfig()
  const all = [codex, antigravitySkill, gemini, antigravityConfig]

  it('teaches the same core contract on every rig (no drift)', () => {
    for (const surface of all) {
      expect(surface).toContain('prjct work')
      expect(surface).toContain('prjct remember')
      expect(surface).toContain('RAG-backed project memory harness')
      for (const facet of KB_FACETS) expect(surface).toContain(facet)
    }
  })

  it('keeps the compact skills under the Codex cap with metadata headroom', () => {
    for (const skill of [codex, antigravitySkill]) {
      expect(Buffer.byteLength(skill, 'utf-8')).toBeLessThanOrEqual(CODEX_CAP - 50)
    }
  })

  it('global configs keep the operational guidance + markers, rig-named', () => {
    for (const cfg of [gemini, antigravityConfig]) {
      expect(cfg).toContain('<!-- prjct:start')
      expect(cfg).toContain('Worktree hygiene')
      expect(cfg).toContain('Crew (opt-in')
    }
    expect(gemini).toContain('in Gemini, identify the role')
    expect(antigravityConfig).toContain('in Antigravity, identify the role')
  })

  it('every surface composes the shared CONTRACT (single source of truth)', () => {
    for (const surface of all) expect(surface).toContain(CONTRACT.rag)
  })
})
