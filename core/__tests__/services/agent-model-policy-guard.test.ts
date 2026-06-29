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
import {
  buildPrjctSkill,
  buildPrjctSkillReference,
  emptySkillContext,
} from '../../services/skill-generator/prjct-skill-body'

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
    expect(buildPrjctSkillReference()).toBe(buildPrjctSkillReference())
  })

  // The heavy methodology (model policy, point-don't-carry, fan-out, crew
  // reconciliation) moved out of the always-in-context SKILL.md body into
  // the pulled-on-demand `workflows.md` reference (2.37 context-efficiency
  // pivot). It still ships on disk next to SKILL.md, so these guards now
  // protect the reference twin.
  it('reference carries the per-role model policy and all three tiers', () => {
    const ref = buildPrjctSkillReference()
    expect(ref).toContain('Model policy (perf')
    expect(ref).toContain('model: "opus"')
    expect(ref).toContain('model: "sonnet"')
    expect(ref).toContain('model: "haiku"')
  })

  it('reference carries the point-dont-carry persistence MUST', () => {
    const ref = buildPrjctSkillReference()
    expect(ref).toContain("point, don't carry")
    expect(ref).toContain('prjct spec show <id> --md')
  })

  it('reference documents parallel implementer fan-out with disjoint scope', () => {
    const ref = buildPrjctSkillReference()
    expect(ref).toContain('Fan out implementers')
    expect(ref).toContain('DISJOINT files')
    // Sequential fallback must be present so the reader never parallelizes
    // two implementers onto the same file.
    expect(ref).toMatch(/do NOT parallelize/i)
  })

  it('reference reconciles crew mode so the leader, not the main session, owns code work', () => {
    const ref = buildPrjctSkillReference()
    expect(ref).toContain('Crew mode reconciliation')
    expect(ref).toContain('.claude/agents/leader.md')
  })

  it('the lean SKILL.md body points at the reference instead of inlining it', () => {
    const skill = buildPrjctSkill(emptySkillContext())
    expect(skill).toContain('workflows.md')
    // The heavy methodology must NOT sit in the always-in-context body.
    expect(skill).not.toContain('Model policy (perf')
  })
})

describe('crew leader template — parallel executor fan-out', () => {
  const read = (f: string) => fs.readFileSync(path.join(CREW_AGENTS_DIR, f), 'utf-8')

  it('leader documents fanning out N implementers over disjoint scope', () => {
    const leader = read('leader.md')
    expect(leader).toContain('disjoint files')
    expect(leader).toContain('IN THE SAME MESSAGE')
    expect(leader).toMatch(/Partition rule/i)
  })

  it('leader keeps a sequential fallback when scopes cannot be partitioned', () => {
    const leader = read('leader.md')
    expect(leader).toMatch(/do NOT parallelize/i)
  })

  it('leader composes review SPECIALISTS over the combined diff (not a fixed single reviewer)', () => {
    const leader = read('leader.md')
    // Still one review pass-set over the whole batch, not per-implementer…
    expect(leader).toContain('combined')
    expect(leader).toMatch(/not a reviewer per implementer/i)
    // …but the review is the specialists the change raises, not one generic reviewer.
    expect(leader).toMatch(/compose the specialists/i)
    expect(leader).toContain('architecture') // floor lens
    expect(leader).toContain('security')
  })
})
