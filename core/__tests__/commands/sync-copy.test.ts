import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { COMMANDS } from '../../commands/command-data'

const ROOT = process.cwd()

describe('sync command copy', () => {
  test('does not suggest the removed /p:sync slash command', () => {
    const sync = COMMANDS.find((command) => command.name === 'sync')
    expect(sync?.usage?.claude).toBe('p. sync')

    const setupSource = fs.readFileSync(path.join(ROOT, 'core', 'commands', 'setup.ts'), 'utf-8')
    expect(setupSource).not.toContain('Run /p:sync')
    expect(setupSource).not.toContain('Run p. sync')
    expect(setupSource).toContain('Run p. upgrade')
  })
})
