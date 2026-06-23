import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')
const source = () => fs.readFileSync(path.join(ROOT, 'bin', 'prjct.cjs'), 'utf-8')

describe('portable CJS launcher setup gate', () => {
  test('keeps setup state under PRJCT_CLI_HOME and not only HOME', () => {
    const src = source()

    expect(src).toContain('process.env.PRJCT_CLI_HOME')
    expect(src).toContain('SETUP_STAMP_PATH')
    expect(src).toContain("path.join(CLI_HOME, 'statusline')")
  })

  test('does not run ensureSetup unconditionally on every invocation', () => {
    const src = source()

    expect(src).toContain('function shouldRunSetup(version)')
    expect(src).toContain('writeSetupStamp(version)')
    expect(src).toContain('if (!setupSkipCommands.has(args[0]) && shouldRunSetup(version))')
    expect(src).not.toContain('  ensureSetup()\n\n  if (runWithBun(args)) return')
  })

  test('skips setup for diagnostic and hot hook paths', () => {
    const src = source()

    for (const command of ['version', '--version', '--help', 'hook', '__internal-auto-update']) {
      expect(src).toContain(`'${command}'`)
    }
  })
})
