/**
 * Cold-path ↔ daemon-path option-forwarding parity.
 *
 * Root-cause guard for a recurring class of bug ("works in the terminal,
 * broken via the daemon"): a command's COLD handler in `core/index.ts`
 * (`standardCommands`) reads option flags (`options.key`, `options['no-spec-
 * gate']`, …) and forwards them, but the DAEMON path (`core/daemon/dispatch.ts`)
 * has no explicit `case` for it — so it falls through to the option-less
 * `commandRegistry.execute`, silently dropping every flag.
 *
 * This bit `embeddings` (`set --key` became a no-op via the daemon, 2.34.0)
 * and `init`/`login`/`auth`/`regen` (flags dropped). Every command whose cold
 * handler consumes an `options.X` flag MUST be either:
 *   - cold-handled (listed in `_binCommands` in bin/prjct.ts → never forwarded), or
 *   - explicitly cased in dispatch.ts (so the daemon forwards its flags).
 *
 * If this test fails, add a `case` in dispatch.ts mirroring the index.ts handler
 * (and pass `request.cwd`, not the daemon's cwd).
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

/** Keys in `standardCommands` whose handler body reads an `options.X` flag. */
function optionBearingColdCommands(): string[] {
  const src = fs.readFileSync(path.join(ROOT, 'core/index.ts'), 'utf-8')
  const start = src.indexOf('const standardCommands')
  // The object is consumed right after via `standardCommands[commandName]`.
  const end = src.indexOf('const handler = standardCommands', start)
  if (start < 0 || end < 0) throw new Error('Could not bound standardCommands in core/index.ts')
  const block = src.slice(start, end)

  // Handler entries look like `  task: (p) =>` / `  'audit-spec': (p) =>` /
  // `  logout: () =>`. Capture each key and the slice up to the next entry.
  const keyRe = /\n {8}('?[\w-]+'?):\s*\(/g
  const entries: { key: string; index: number }[] = []
  for (const m of block.matchAll(keyRe)) {
    entries.push({ key: m[1].replace(/'/g, ''), index: m.index ?? 0 })
  }

  const optionBearing: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const body = block.slice(entries[i].index, entries[i + 1]?.index ?? block.length)
    // A real option flag is `options.<name>` or `options['<name>']`. The
    // local `md` var and the positional `p` are not option flags.
    if (/\boptions[.[]/.test(body)) optionBearing.push(entries[i].key)
  }
  return optionBearing
}

function binCommandsSkipSet(): Set<string> {
  const src = fs.readFileSync(path.join(ROOT, 'bin/prjct.ts'), 'utf-8')
  const m = src.match(/_binCommands = new Set\(\[([\s\S]+?)\]\)/)
  if (!m) throw new Error('Could not find _binCommands in bin/prjct.ts')
  const out = new Set<string>()
  for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) out.add(s[1])
  return out
}

function dispatchCaseLabels(): Set<string> {
  const src = fs.readFileSync(path.join(ROOT, 'core/daemon/dispatch.ts'), 'utf-8')
  const out = new Set<string>()
  for (const m of src.matchAll(/case\s+'([\w-]+)'\s*:/g)) out.add(m[1])
  return out
}

describe('cold ↔ daemon option-forwarding parity', () => {
  test('every option-bearing cold command is cold-handled or explicitly cased in dispatch', () => {
    const optionBearing = optionBearingColdCommands()
    // Sanity: the extractor actually found the known flag-bearing commands.
    expect(optionBearing).toContain('embeddings')
    expect(optionBearing).toContain('init')
    expect(optionBearing).toContain('ship')

    const cold = binCommandsSkipSet()
    const cased = dispatchCaseLabels()

    const dropped = optionBearing.filter((c) => !cold.has(c) && !cased.has(c))
    expect(dropped).toEqual([])
  })

  test('the previously-broken commands now have dispatch cases', () => {
    const cased = dispatchCaseLabels()
    for (const c of ['embeddings', 'init', 'regen', 'login', 'logout', 'auth', 'capture']) {
      expect(cased.has(c)).toBe(true)
    }
  })
})
