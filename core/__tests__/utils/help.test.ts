import { describe, expect, it } from 'bun:test'
import { getHelp } from '../../utils/help'

describe('getHelp', () => {
  it('does not advertise removed bug command in main help', () => {
    const help = getHelp()

    expect(help).not.toContain('p. bug')
    expect(help).not.toContain('Report and track bugs with priority')
  })
})
