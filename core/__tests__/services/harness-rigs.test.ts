/**
 * Harness creation paths (Phase C): induction + steal-a-rig.
 *
 * Both are pure renderers — prjct DESCRIBES the work + names the persistence
 * verbs; the host runs it. The dispatches must point at prjct (pull, don't
 * assume), stay model-agnostic, and persist only through prjct verbs.
 */

import { describe, expect, it } from 'bun:test'
import {
  buildInductionDispatch,
  findRig,
  RIGS,
  renderRigAdoption,
  renderRigList,
} from '../../services/harness-rigs'

describe('induction — learn-from a manual flow', () => {
  it('points at the flow + synthesizes organs + persists via prjct verbs', () => {
    const d = buildInductionDispatch({ activeCycle: 'add rate limiting', hasGit: true })
    expect(d).toContain('add rate limiting') // names the flow
    expect(d).toContain('git log') // read the concrete edits
    expect(d).toContain('prjct work --md')
    // synthesizes each organ via a verb
    expect(d).toContain('prjct workflow') // command/workflow organ
    expect(d).toContain('prjct remember') // skill recipe + decisions
    expect(d).toContain('verify:') // stop-slop gate
    // doctrine
    expect(d).toContain('MODEL-AGNOSTIC')
    expect(d).toContain('Persist ONLY through prjct verbs')
  })

  it('omits git when the project is not a repo', () => {
    const d = buildInductionDispatch({ activeCycle: null, hasGit: false })
    expect(d).not.toContain('git log')
    expect(d).toContain('prjct work --md')
  })
})

describe('steal-a-rig — adopt a base rig', () => {
  it('lists the stealable rigs', () => {
    const list = renderRigList()
    for (const r of RIGS) expect(list).toContain(r.name)
    expect(list).toContain('prjct harness use')
  })

  it('resolves a known rig and renders its organ install plan', () => {
    const rig = findRig('safe-agentic-workflow')
    expect(rig).toBeDefined()
    const plan = renderRigAdoption(rig!)
    expect(plan).toContain('safe-agentic-workflow')
    expect(plan).toContain('agent-catalog')
    expect(plan).toContain('prjct crew install')
    expect(plan).toContain('owned in prjct') // sovereignty: yours after adopting
  })

  it('returns undefined for an unknown rig', () => {
    expect(findRig('does-not-exist')).toBeUndefined()
  })

  it('resolves grok-build with Body/Brain organs (no agent-loop port)', () => {
    const rig = findRig('grok-build')
    expect(rig).toBeDefined()
    expect(rig!.source).toContain('xai-org/grok-build')
    const plan = renderRigAdoption(rig!)
    expect(plan).toContain('skills-commands')
    expect(plan).toContain('knowledge-base')
    expect(plan).toContain('prjct remember')
    expect(plan).toContain('prjct crew')
    // Sovereignty: patterns only — never the Rust runtime
    expect(rig!.description).toMatch(/not the Rust agent loop/i)
  })
})
