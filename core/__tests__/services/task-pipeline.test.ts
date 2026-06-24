import { describe, expect, it } from 'bun:test'
import { classifyTaskPipeline, formatTaskPipelineNextAction } from '../../services/task-pipeline'

describe('task pipeline triage', () => {
  it('routes obvious trivial work directly without a spec', () => {
    for (const description of [
      'fix typo in README',
      'docs tweak for install instructions',
      'rerun failing test',
      'format the changelog',
    ]) {
      const classification = classifyTaskPipeline(description)
      expect(classification.kind).toBe('trivial')
      expect(classification.station).toBe('direct')
      expect(classification.requiresSpec).toBe(false)
      expect(classification.requiresTestsFirst).toBe(false)
    }
  })

  it('routes substantive implementation work through SDD and strict TDD', () => {
    const classification = classifyTaskPipeline(
      'add billing retry handling with failure recovery and audit logging'
    )

    expect(classification.kind).toBe('substantive')
    expect(classification.station).toBe('spec_required')
    expect(classification.requiresSpec).toBe(true)
    expect(classification.requiresTestsFirst).toBe(true)
  })

  it('uses fixed next-action templates rather than copying task text', () => {
    const action = formatTaskPipelineNextAction({
      kind: 'substantive',
      station: 'spec_required',
      requiresSpec: true,
      requiresTestsFirst: true,
      reason: 'substantive-keyword',
    })

    expect(action).toContain('Create or link a reviewed spec')
    expect(action).toContain('tests before implementation')
    expect(action).not.toContain('billing retry')
  })
})
