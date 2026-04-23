import { describe, expect, it } from 'bun:test'
import { COMMANDS } from '../../commands/command-data'

describe('COMMANDS', () => {
  it('treats ship feature name as optional', () => {
    const ship = COMMANDS.find((command) => command.name === 'ship')

    expect(ship).toBeDefined()
    expect(ship?.params).toBe('[feature]')
  })
})
