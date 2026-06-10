/**
 * Command-manifest completeness invariants.
 *
 * command-data.ts is the single source of truth for which commands exist
 * and where they route: `routingMode: 'bin-only'` drives `_binCommands`
 * (bin/prjct.ts) AND the daemon shim's skip set (scripts/build.js), and
 * `optionSchema` drives generic flag mapping in BOTH dispatch paths.
 * These tests pin the invariants that make "add a command = one manifest
 * entry" true.
 */

import { describe, expect, test } from 'bun:test'
import { BIN_ONLY_COMMANDS, COMMAND_ALIASES, COMMANDS } from '../../commands/command-data'
import { mapOptions } from '../../commands/option-mapper'
import { BIN_COMMANDS_SET, REGISTERED_VERBS_SET } from '../../commands/verb-names'

describe('command manifest — completeness', () => {
  test('every bin-only command has a manifest entry (no ghost commands)', () => {
    const names = new Set(COMMANDS.map((c) => c.name))
    const ghosts = [...BIN_ONLY_COMMANDS].filter((c) => !names.has(c) && !(c in COMMAND_ALIASES))
    expect(ghosts).toEqual([])
  })

  test('aliases resolve to real bin-only entries', () => {
    const names = new Set(COMMANDS.map((c) => c.name))
    for (const [alias, target] of Object.entries(COMMAND_ALIASES)) {
      expect(names.has(target)).toBe(true)
      expect(alias.startsWith('-')).toBe(true)
    }
  })

  test('BIN_COMMANDS_SET re-export matches the manifest derivation', () => {
    expect([...BIN_COMMANDS_SET].sort()).toEqual([...BIN_ONLY_COMMANDS].sort())
  })

  test('no command is both bin-only and expected on the daemon verb fast-path', () => {
    // A bin-only command may still have registry routing (cold-path reuse),
    // but the daemon fast path in bin/prjct.ts excludes _binCommands first —
    // assert the two sets at least make that exclusion meaningful.
    const both = [...BIN_COMMANDS_SET].filter(
      (c) => REGISTERED_VERBS_SET.has(c) && !COMMANDS.find((m) => m.name === c)?.routing
    )
    expect(both).toEqual([])
  })

  test('schema-covered commands declare routing (the generic path needs a handler)', () => {
    const broken = COMMANDS.filter((c) => c.optionSchema && !c.routing).map((c) => c.name)
    expect(broken).toEqual([])
  })

  test('every daemon-routed simple command has an optionSchema', () => {
    // Complex signatures (object params, multi-positional, no-projectPath)
    // are the ONLY commands allowed to live outside the schema path.
    const complex = new Set([
      'sync',
      'init',
      'analyze',
      'analysis-save-llm',
      'spec',
      'audit-spec',
      'regen',
      'start',
      'setup',
      'update',
      'uninstall',
      'login',
      'logout',
      'auth',
    ])
    const missing = COMMANDS.filter(
      (c) => c.routing && !complex.has(c.name) && !c.optionSchema
    ).map((c) => c.name)
    expect(missing).toEqual([])
  })
})

describe('option mapper', () => {
  test('maps booleans, strings, numbers; md always included', () => {
    const mapped = mapOptions(
      { md: true, force: true, tags: 'a:b', limit: '3' },
      { booleans: ['force'], strings: ['tags'], numbers: ['limit'] }
    )
    expect(mapped).toEqual({ md: true, force: true, tags: 'a:b', limit: 3 })
  })

  test('resolves kebab-case wire flags to camelCase schema keys', () => {
    const mapped = mapOptions(
      { 'no-spec-gate': true, 'skip-hooks': true, 'base-url': 'http://x' },
      { booleans: ['noSpecGate', 'skipHooks'], strings: ['baseUrl'] }
    )
    expect(mapped.noSpecGate).toBe(true)
    expect(mapped.skipHooks).toBe(true)
    expect(mapped.baseUrl).toBe('http://x')
  })

  test('absent flags map to false (booleans) / undefined (strings, numbers)', () => {
    const mapped = mapOptions({}, { booleans: ['force'], strings: ['tags'], numbers: ['limit'] })
    expect(mapped.force).toBe(false)
    expect(mapped.tags).toBeUndefined()
    expect(mapped.limit).toBeUndefined()
    expect(mapped.md).toBe(false)
  })
})
