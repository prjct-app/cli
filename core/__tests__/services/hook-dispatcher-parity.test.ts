/**
 * Root-cause guard: the installer (`PRJCT_HOOKS`) and the CLI hook
 * dispatcher each own half of the hook contract. If they drift —
 * installer writes a subcommand the dispatcher doesn't know, or vice
 * versa — every Claude Code session tail shows "Unknown command: hook"
 * until someone notices.
 *
 * The dispatcher branches were extracted from bin/prjct.ts main() into
 * core/cli/bin-commands.ts; bin/prjct.ts keeps the top-level fail-soft
 * catch and derives its command gate from the manifest.
 *
 * This test fails fast on that drift so CI catches it, not customers.
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BIN_COMMANDS_SET } from '../../commands/verb-names'
import { PRJCT_HOOKS } from '../../services/settings-installer'

const binPath = path.join(__dirname, '../../../bin/prjct.ts')
const binCommandsPath = path.join(__dirname, '../../cli/bin-commands.ts')

describe('hook dispatcher parity', () => {
  test('every PRJCT_HOOKS subcommand has a matching dispatcher case', async () => {
    const source = await fs.readFile(binCommandsPath, 'utf-8')

    for (const spec of PRJCT_HOOKS) {
      const needle = `case '${spec.subcommand}':`
      expect(source).toContain(needle)
    }
  })

  test('dispatcher intercepts `hook` before the registry falls through', async () => {
    const source = await fs.readFile(binCommandsPath, 'utf-8')
    // Top-level intercept in the bin-command dispatch chain.
    expect(source).toContain(`args[0] === 'hook'`)
    // Command gate — keeps the daemon fast path and the capture
    // auto-route from swallowing `prjct hook <name>`. Derived from the
    // manifest, so assert the runtime set instead of a source literal.
    expect(BIN_COMMANDS_SET.has('hook')).toBe(true)
  })

  test('dispatcher has a catch-all for unknown hook names', async () => {
    const source = await fs.readFile(binCommandsPath, 'utf-8')
    // Unknown subcommand must not explode — empty JSON + exit 0.
    expect(source).toMatch(
      /default:\s*\n\s*\/\/ Unknown hook[\s\S]*?process\.stdout\.write\('\{\}\\n'\)/
    )
  })

  test('top-level catch emits no-op for `hook` to honor the contract', async () => {
    const source = await fs.readFile(binPath, 'utf-8')
    // Defense in depth: even if main() blows up before reaching the
    // dispatcher, `prjct hook <name>` must not print a fatal banner.
    expect(source).toMatch(/process\.argv\[2\] === 'hook'/)
  })
})
