/**
 * Crew agent models are a single source of truth (harness pillar 3).
 *
 * The leader/implementer/reviewer `model:` frontmatter is stamped from
 * AGENT_MODEL_POLICY at install time, so the static templates can never drift
 * from the policy that the rest of the multi-agent dispatch already uses.
 */

import { describe, expect, it } from 'bun:test'
import { applyCrewModelPolicy } from '../../commands/crew'
import { getAgentModelPolicy } from '../../schemas/model'

const FRONTMATTER = '---\nname: x\nmodel: PLACEHOLDER\ncolor: blue\n---\n\nbody\n'

describe('crew model policy derives from AGENT_MODEL_POLICY', () => {
  const cases = [
    ['.claude/agents/leader.md', 'orchestrator'],
    ['.claude/agents/implementer.md', 'implementer'],
    ['.claude/agents/reviewer.md', 'reviewer'],
  ] as const

  for (const [dest, role] of cases) {
    it(`stamps ${dest} with the ${role} policy model`, () => {
      const out = applyCrewModelPolicy(FRONTMATTER, dest)
      expect(out).toContain(`model: ${getAgentModelPolicy(role).model}`)
      expect(out).not.toContain('PLACEHOLDER')
    })
  }

  it('leaves files not mapped to a crew role untouched', () => {
    const tpl = '---\nmodel: keep\n---\n'
    expect(applyCrewModelPolicy(tpl, '.claude/agents/other.md')).toBe(tpl)
  })
})
