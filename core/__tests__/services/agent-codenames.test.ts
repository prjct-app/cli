import { describe, expect, test } from 'bun:test'
import {
  AGENT_CODENAME_POOL,
  assignAgentCast,
  castForFanout,
  formatAgentCastLine,
  hashSeed,
  pickCodename,
} from '../../services/agent-codenames'
import { orchestrationFor } from '../../services/task-orchestration'

describe('agent-codenames', () => {
  test('same seed → same name', () => {
    expect(pickCodename('cycle-abc')).toBe(pickCodename('cycle-abc'))
  })

  test('exclude skips taken names', () => {
    const first = pickCodename('seed-1')
    const second = pickCodename('seed-1', [first])
    expect(second).not.toBe(first)
    expect(AGENT_CODENAME_POOL).toContain(second as (typeof AGENT_CODENAME_POOL)[number])
  })

  test('assignAgentCast gives unique names per role', () => {
    const cast = assignAgentCast(['explore', 'implement', 'review'], 'auth-refactor')
    expect(cast).toHaveLength(3)
    const names = cast.map((c) => c.name)
    expect(new Set(names).size).toBe(3)
    expect(formatAgentCastLine(cast)).toContain('explore→')
    expect(formatAgentCastLine(cast)).toContain('implement→')
  })

  test('castForFanout empty on direct, filled on parallel/crew', () => {
    expect(castForFanout('direct', 'x')).toEqual([])
    expect(castForFanout('parallel', 'x').map((c) => c.role)).toEqual([
      'explore',
      'implement',
      'review',
    ])
    expect(castForFanout('crew', 'x').map((c) => c.role)).toEqual([
      'leader',
      'implementer',
      'reviewer',
    ])
  })

  test('hashSeed is stable', () => {
    expect(hashSeed('hello')).toBe(hashSeed('hello'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('orchestrationFor embeds cast', () => {
  test('H2 feature directive includes Cast names', () => {
    const p = orchestrationFor(
      { level: 'H2', kind: 'feature', risk: 'medium' },
      'off',
      'off',
      'off',
      'seed-for-cast'
    )
    expect(p.fanout).toBe('parallel')
    expect(p.cast.length).toBe(3)
    expect(p.directive).toContain('Cast:')
    expect(p.directive).toContain(p.cast[0]!.name)
  })

  test('H0 has empty cast', () => {
    const p = orchestrationFor({ level: 'H0', kind: 'chore', risk: 'low' })
    expect(p.cast).toEqual([])
    expect(p.directive).not.toContain('Cast:')
  })
})
