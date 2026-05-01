/**
 * Daemon-shim ↔ bin/prjct.ts skip-list invariant.
 *
 * `bin/prjct.ts` declares `_binCommands` (commands handled directly by the
 * cold-start CLI). The daemon shim emitted by `scripts/build.js` declares
 * its own `skip` Set with the same purpose: commands not to forward to the
 * daemon socket.
 *
 * If the two lists drift, a command in `_binCommands` but absent from the
 * shim's skip Set gets forwarded to the daemon, which doesn't know it, and
 * is silently auto-routed to a default action. That is exactly what
 * happened to `crew` in 2.3.5 — `prjct crew install` ran `prjct init` instead.
 *
 * This test asserts the two lists agree.
 */

import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

function extractBinCommands(): Set<string> {
  const src = fs.readFileSync(path.join(ROOT, 'bin/prjct.ts'), 'utf-8')
  // Match the literal `const _binCommands = new Set([ ... ])` block.
  const m = src.match(/const _binCommands = new Set\(\[([\s\S]+?)\]\)/)
  if (!m) throw new Error('Could not find _binCommands declaration in bin/prjct.ts')
  return parseStringSet(m[1])
}

function extractShimSkip(): Set<string> {
  const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts/build.js'), 'utf-8')
  // Match the inline shim's `const skip=new Set([ ... ])`.
  const m = buildSrc.match(/const skip=new Set\(\[([^\]]+?)\]\)/)
  if (!m) throw new Error('Could not find skip declaration in scripts/build.js shim')
  return parseStringSet(m[1])
}

function parseStringSet(body: string): Set<string> {
  const out = new Set<string>()
  for (const m of body.matchAll(/['"]([^'"]+)['"]/g)) out.add(m[1])
  return out
}

describe('daemon-shim ↔ bin/prjct.ts sync', () => {
  test('every command in _binCommands appears in the shim skip set', () => {
    const bin = extractBinCommands()
    const shim = extractShimSkip()
    const missing = [...bin].filter((c) => !shim.has(c))
    expect(missing).toEqual([])
  })

  // (Reverse-direction check intentionally omitted: the shim historically
  // contained orphan entries like `dev`/`web`/`serve` that pre-date this
  // test. They are inert — they prevent forwarding-to-daemon for commands
  // that have no handler anyway. Forward direction is the load-bearing one.)

  test('crew is in both lists (regression for 2.3.5 → 2.3.6)', () => {
    const bin = extractBinCommands()
    const shim = extractShimSkip()
    expect(bin.has('crew')).toBe(true)
    expect(shim.has('crew')).toBe(true)
  })
})
