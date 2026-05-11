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

/**
 * Fallback-policy regression: the shim must NOT silently re-execute a command
 * that the daemon may have already started running.
 *
 * Background: v2.19.1 → v2.19.2 and v2.19.3 → v2.19.4 each shipped twice
 * because the shim's 5s timeout fell through to a full re-import of
 * prjct-core, while the daemon's slow `ship` step kept running. Source
 * `bin/prjct.ts` (commit d08727b8) was hardened to refuse retry on anything
 * except ECONNREFUSED/ENOENT — the shim was missed.
 */
describe('daemon-shim fallback policy', () => {
  const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts/build.js'), 'utf-8')

  test('timeout is 30s, matching core/daemon/client.ts sendRequest', () => {
    expect(buildSrc).toContain('30000)')
    // 5000 was the old hair-trigger timeout that caused the double-fire.
    expect(buildSrc).not.toMatch(/setTimeout\([^)]*,\s*5000\)/)
  })

  test('socket error path checks ECONNREFUSED / ENOENT before fallback', () => {
    // Must whitelist the safe-retry conditions, matching bin/prjct.ts:238-242.
    expect(buildSrc).toContain('ECONNREFUSED')
    expect(buildSrc).toContain('ENOENT')
    expect(buildSrc).toMatch(/isSafeRetry|safeRetry/)
  })

  test('socket close before response does NOT silently re-import core', () => {
    // The pre-fix shim had `sock.on("close",()=>{...;fallback()})` — that's
    // what made ship re-run mid-flight. Reject any line that pairs
    // `sock.on("close"` with an unconditional fallback().
    const closeHandler = buildSrc.match(/sock\.on\("close"[^)]*\)[^;]*;?/g) ?? []
    expect(closeHandler.length).toBeGreaterThan(0)
    for (const h of closeHandler) {
      // It is OK if the close handler calls refuse() or another non-recursive
      // helper; it is NOT OK if it falls through to fallback() unconditionally.
      const callsFallback = /fallback\(\)/.test(h)
      const callsRefuse = /refuse\(/.test(h)
      // If we ever fall back from close, it must be gated by a safe-retry check
      // — which today only lives in the error handler. Close = always refuse.
      if (callsFallback) expect(callsRefuse).toBe(true)
    }
  })

  test('timeout path does NOT silently re-import core', () => {
    // Same hazard: the daemon may still be working when the shim gives up.
    const timeoutBlock = buildSrc.match(/setTimeout\(\(\)\s*=>\s*\{[^}]+\}/g) ?? []
    const shimTimeout = timeoutBlock.find((b) => b.includes('done') && b.includes('sock'))
    expect(shimTimeout).toBeDefined()
    if (shimTimeout) {
      const callsFallback = /fallback\(\)/.test(shimTimeout)
      const callsRefuse = /refuse\(/.test(shimTimeout)
      if (callsFallback) expect(callsRefuse).toBe(true)
    }
  })
})
