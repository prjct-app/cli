import { describe, expect, it } from 'bun:test'
import { COMMANDS } from '../../commands/command-data'
import { REGISTERED_VERBS_SET } from '../../commands/verb-names'

describe('COMMANDS', () => {
  it('treats ship feature name as optional', () => {
    const ship = COMMANDS.find((command) => command.name === 'ship')

    expect(ship).toBeDefined()
    expect(ship?.params).toBe('[feature]')
  })

  it('registers agents doctor as the compatibility audit command', () => {
    const agents = COMMANDS.find((command) => command.name === 'agents')

    expect(agents?.routing).toEqual({ group: 'agents', method: 'agents' })
    expect(agents?.optionSchema).toEqual({ booleans: ['fix'] })
    expect(agents?.requiresProject).toBe(false)
    expect(REGISTERED_VERBS_SET.has('agents')).toBe(true)
  })

  it('registers paid-tier proof commands through the product command group', () => {
    const expected = [
      ['value', 'value'],
      ['memory-doctor', 'memoryDoctor'],
      ['report', 'report'],
      ['handoff', 'handoff'],
      ['guardrails', 'guardrails'],
    ] as const

    for (const [name, method] of expected) {
      const command = COMMANDS.find((entry) => entry.name === name)
      expect(command?.routing).toEqual({ group: 'product', method })
      expect(command?.requiresProject).toBe(true)
      expect(REGISTERED_VERBS_SET.has(name)).toBe(true)
    }

    expect(COMMANDS.find((entry) => entry.name === 'report')?.optionSchema).toEqual({
      numbers: ['days'],
    })
  })
})
