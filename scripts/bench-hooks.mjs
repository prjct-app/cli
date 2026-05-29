#!/usr/bin/env node
/**
 * Hook hot-path benchmark (Phase 0 instrumentation).
 *
 * Measures the REAL wall-clock cost a user pays per hook: the full
 * spawn → module load → hook body → exit cycle of `prjct hook <event>`,
 * exactly as Claude Code invokes it (`<bin> hook <subcommand>` with the
 * event JSON on stdin). This is the number that decides whether routing
 * hooks through the daemon is worth its complexity — run it before and
 * after any such change.
 *
 * It does NOT instrument the hot path itself (that would add overhead to
 * the thing we're trying to keep lean); it black-box-times the production
 * artifact in `dist/`.
 *
 * Usage:
 *   node scripts/bench-hooks.mjs [--iterations N] [--runtime node|bun|both]
 *
 * Notes:
 *   - Hooks always bypass the daemon (see bin/prjct.ts `_binCommands`), so
 *     this measures the cold path every prompt actually pays today.
 *   - Run from inside a real prjct project so the DB/config/vault paths are
 *     exercised. Defaults to the repo itself.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const distEntry = path.join(repoRoot, 'dist', 'bin', 'prjct.mjs')

function parseArgs(argv) {
  const out = { iterations: 30, runtime: 'both' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--iterations' || a === '-n') out.iterations = Number.parseInt(argv[++i], 10) || 30
    else if (a === '--runtime') out.runtime = argv[++i] ?? 'both'
  }
  return out
}

/** Realistic event payloads (the hook reads these from stdin). */
const EVENTS = [
  { name: 'session-start', stdin: JSON.stringify({ source: 'startup' }) },
  {
    name: 'prompt',
    stdin: JSON.stringify({ prompt: 'how should we cache the auth token responses?' }),
  },
  { name: 'stop', stdin: JSON.stringify({}) },
]

function hasBun() {
  return spawnSync('bun', ['--version'], { stdio: 'ignore' }).status === 0
}

function stats(samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b)
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
  return { min: sorted[0], p50: at(50), p95: at(95), max: sorted.at(-1), mean }
}

function timeOnce(runtime, event) {
  const start = process.hrtime.bigint()
  const res = spawnSync(runtime, [distEntry, 'hook', event.name], {
    input: event.stdin,
    cwd: repoRoot,
    env: { ...process.env, PRJCT_NO_DAEMON: '1', PRJCT_NO_UPDATE_NOTICE: '1' },
    encoding: 'utf-8',
  })
  const ms = Number(process.hrtime.bigint() - start) / 1_000_000
  return { ms, ok: res.status === 0 }
}

function benchRuntime(runtime, iterations) {
  console.log(`\n── runtime: ${runtime} ──`)
  for (const event of EVENTS) {
    // Warm the filesystem cache; discard.
    for (let i = 0; i < 3; i++) timeOnce(runtime, event)
    const samples = []
    let failures = 0
    for (let i = 0; i < iterations; i++) {
      const { ms, ok } = timeOnce(runtime, event)
      samples.push(ms)
      if (!ok) failures++
    }
    const s = stats(samples)
    const f = failures > 0 ? `  ⚠ ${failures} non-zero exits` : ''
    console.log(
      `  ${event.name.padEnd(14)} ` +
        `min ${s.min.toFixed(1)}ms  p50 ${s.p50.toFixed(1)}ms  ` +
        `p95 ${s.p95.toFixed(1)}ms  max ${s.max.toFixed(1)}ms  mean ${s.mean.toFixed(1)}ms${f}`
    )
  }
}

function main() {
  const { iterations, runtime } = parseArgs(process.argv.slice(2))
  if (!existsSync(distEntry)) {
    console.error(`dist not built: ${distEntry}\nRun \`npm run build\` first.`)
    process.exit(1)
  }
  console.log(`prjct hook hot-path benchmark — ${iterations} iterations/event, cwd=${repoRoot}`)
  const runtimes = runtime === 'both' ? ['node', ...(hasBun() ? ['bun'] : [])] : [runtime]
  for (const rt of runtimes) benchRuntime(rt, iterations)
  console.log(
    '\nHooks bypass the daemon today (bin/prjct.ts `_binCommands`), so these are the' +
      '\nper-event costs every session pays. Compare against a daemon-routed build to' +
      '\nquantify the win before committing to that refactor.'
  )
}

main()
