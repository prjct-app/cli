import { describe, expect, it } from 'bun:test'
import { getHelp } from '../../utils/help'

describe('getHelp', () => {
  it('does not advertise removed bug command in main help', () => {
    const help = getHelp()

    expect(help).not.toContain('p. bug')
    expect(help).not.toContain('Report and track bugs with priority')
  })

  it('does not render terminal-only commands as p. commands', () => {
    expect(getHelp('login')).toContain('prjct login - Authenticate with prjct cloud')
    expect(getHelp('login')).not.toContain('p. login -')
    expect(getHelp('commands')).not.toContain('p. login')
  })

  it('does not list commands removed during cleanup', () => {
    const help = getHelp('commands')

    for (const command of ['suggest', 'git', 'test', 'migrate']) {
      expect(help).not.toContain(`p. ${command}`)
      expect(help).not.toContain(`prjct ${command}`)
    }
  })
})
