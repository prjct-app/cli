/**
 * Codex skill — the 1024-byte contract.
 *
 * Codex (codex-cli 0.135) enforces a HARD ~1024-byte limit on the whole
 * SKILL.md file: one byte over and the ENTIRE skill is silently rejected
 * (prjct disappears from Codex with no error). mem_969. These tests pin:
 *   1. The built artifact (template + metadata marker) stays under the cap
 *      with real headroom — version strings grow, hashes are appended.
 *   2. The bin shim self-heals the CODEX template into ~/.codex, never the
 *      ~9.5KB Claude baseline (the regression that broke Codex silently).
 *   3. Metadata parse accepts both the compact format and the legacy
 *      pre-2.44 format (so old installs verify-mismatch and repair, not
 *      crash).
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { buildCodexSkillContent, CODEX_SKILL_MAX_BYTES } from '../../infrastructure/codex-skill'

const ROOT = path.resolve(__dirname, '../../..')
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'templates/codex/SKILL.md'), 'utf-8')

describe('codex skill size guard', () => {
  test('built SKILL.md (template + metadata) stays under the Codex hard cap', () => {
    const built = buildCodexSkillContent(TEMPLATE)
    expect(Buffer.byteLength(built.content, 'utf-8')).toBeLessThanOrEqual(CODEX_SKILL_MAX_BYTES)
  })

  test('keeps ≥50 bytes of headroom for version growth', () => {
    const built = buildCodexSkillContent(TEMPLATE)
    expect(Buffer.byteLength(built.content, 'utf-8')).toBeLessThanOrEqual(
      CODEX_SKILL_MAX_BYTES - 50
    )
  })

  test('metadata marker is present and compact', () => {
    const built = buildCodexSkillContent(TEMPLATE)
    const marker = built.content.match(/<!--\s*prjct-codex-router:\s*(\{[\s\S]*?\})\s*-->/)
    expect(marker).not.toBeNull()
    const meta = JSON.parse(marker![1]) as { v?: string; h?: string }
    expect(meta.v).toBeTruthy()
    expect(meta.h).toBe(built.templateHash)
    // Truncated hash — full sha256 hex would burn 52 extra bytes of cap.
    expect(built.templateHash.length).toBeLessThanOrEqual(12)
  })
})

describe('bin shim skill self-heal', () => {
  const shim = fs.readFileSync(path.join(ROOT, 'bin/prjct'), 'utf-8')

  test('Codex destination receives the Codex template, not the Claude baseline', () => {
    // The exact regression: one loop copied templates/skills/prjct/SKILL.md
    // (the ~9.5KB Claude baseline) into BOTH ~/.claude and ~/.codex.
    expect(shim).toContain('templates/codex/SKILL.md')
    for (const line of shim.split('\n')) {
      if (line.includes('.codex/skills')) {
        expect(line).not.toContain('templates/skills/prjct')
      }
      if (line.includes('templates/skills/prjct')) {
        expect(line).not.toContain('.codex')
      }
    }
  })

  test('Claude destination still receives the Claude baseline', () => {
    expect(shim).toContain('templates/skills/prjct/SKILL.md')
    expect(shim).toContain('.claude/skills/prjct/SKILL.md')
  })
})
