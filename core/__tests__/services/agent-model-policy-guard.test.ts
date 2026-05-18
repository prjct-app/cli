/**
 * Regression guards for the per-role subagent model policy (PR #364).
 *
 * Two silent-drift hazards surfaced by the post-ship sync analysis:
 *  1. A crew agent .md shipping without a `model:` frontmatter key →
 *     it inherits the parent's max model and the agent fan-out crawls.
 *  2. prjct-skill-body.ts losing the model-policy / point-dont-carry
 *     prose → the generated SKILL.md twin ships without the guidance.
 *
 * These are pure, deterministic checks (no build step required): the
 * generated SKILL.md is always derived from buildPrjctSkill(), so
 * protecting that function's output protects the on-disk twin.
 */

import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { buildPrjctSkill, emptySkillContext } from '../../services/skill-generator/prjct-skill-body'

const CREW_AGENTS_DIR = path.join(__dirname, '../../../templates/crew/agents')

/** Pull `model:` out of the leading `---` frontmatter block. */
function frontmatterModel(md: string): string | null {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) return null
  const line = fm[1].match(/^model:\s*(\S+)\s*$/m)
  return line ? line[1] : null
}

describe('crew agent frontmatter — every role pins a model (no parent-max inheritance)', () => {
  const files = fs
    .readdirSync(CREW_AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()

  it('finds the expected crew agents', () => {
    expect(files).toEqual(['implementer.md', 'leader.md', 'reviewer.md'])
  })

  for (const file of files) {
    it(`${file} declares an explicit, valid model:`, () => {
      const md = fs.readFileSync(path.join(CREW_AGENTS_DIR, file), 'utf-8')
      const model = frontmatterModel(md)
      expect(model).not.toBeNull()
      expect(['opus', 'sonnet', 'haiku']).toContain(model as string)
    })
  }

  it('pins the exact policy: implementer=opus, leader=haiku, reviewer=sonnet', () => {
    const modelOf = (f: string) =>
      frontmatterModel(fs.readFileSync(path.join(CREW_AGENTS_DIR, f), 'utf-8'))
    expect(modelOf('implementer.md')).toBe('opus')
    expect(modelOf('leader.md')).toBe('haiku')
    expect(modelOf('reviewer.md')).toBe('sonnet')
  })

  it('only the implementer may run on the max model', () => {
    for (const file of files) {
      if (file === 'implementer.md') continue
      const model = frontmatterModel(fs.readFileSync(path.join(CREW_AGENTS_DIR, file), 'utf-8'))
      expect(model).not.toBe('opus')
    }
  })
})

describe('skill generation invariants — the SSOT the SKILL.md twin is built from', () => {
  it('is deterministic (pure function, no hidden state)', () => {
    expect(buildPrjctSkill(emptySkillContext())).toBe(buildPrjctSkill(emptySkillContext()))
  })

  it('carries the per-role model policy and all three tiers', () => {
    const skill = buildPrjctSkill(emptySkillContext())
    expect(skill).toContain('Model policy (perf')
    expect(skill).toContain('model: "opus"')
    expect(skill).toContain('model: "sonnet"')
    expect(skill).toContain('model: "haiku"')
  })

  it('carries the point-dont-carry persistence MUST', () => {
    const skill = buildPrjctSkill(emptySkillContext())
    expect(skill).toContain("point, don't carry")
    expect(skill).toContain('prjct spec show <id> --md')
  })
})
