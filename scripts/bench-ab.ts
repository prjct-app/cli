/**
 * A/B performance benchmark: the installed/dev build vs a published version.
 *
 *   bun scripts/bench-ab.ts 3.20.0          # dev source vs npm version
 *   bun scripts/bench-ab.ts 3.20.0 3.21.2   # npm version vs npm version
 *
 * Real product-lifecycle commands (setup → init → work/remember/search/
 * guard/status), isolated PRJCT_CLI_HOME per side, median of N runs — the
 * same methodology used to validate the launcher and Schema v2 wins. Run it
 * before shipping perf-sensitive changes; a regression here is a regression
 * for every user turn.
 */

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REPO = path.resolve(import.meta.dir, '..')
const REPS = Number(process.env.BENCH_REPS ?? 15)

function fetchVersion(version: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bench-${version}-`))
  execFileSync('npm', ['pack', `prjct-cli@${version}`], { cwd: dir, stdio: 'ignore' })
  execFileSync('tar', ['-xzf', `prjct-cli-${version}.tgz`], { cwd: dir })
  return path.join(dir, 'package', 'bin', 'prjct.ts')
}

interface Side {
  label: string
  bin: string
  runner: string
  home: string
  proj: string
}

function makeSide(label: string, runner: string, bin: string): Side {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-h-'))
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-p-'))
  fs.writeFileSync(path.join(proj, 'package.json'), '{"name":"bench","version":"0.1.0"}')
  execFileSync('git', ['init', '-q'], { cwd: proj })
  const env = {
    ...process.env,
    PRJCT_CLI_HOME: home,
    HOME: home,
    PRJCT_NO_DAEMON: '1',
    CI: '1',
    NO_COLOR: '1',
  }
  execFileSync(runner, [bin, 'setup', '--non-interactive', '--md'], {
    cwd: proj,
    env,
    stdio: 'ignore',
  })
  execFileSync(runner, [bin, 'init', '--md'], { cwd: proj, env, stdio: 'ignore' })
  return { label, bin, runner, home, proj }
}

function once(side: Side, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const c = spawn(side.runner, [side.bin, ...args], {
      cwd: side.proj,
      stdio: 'ignore',
      env: {
        ...process.env,
        PRJCT_CLI_HOME: side.home,
        HOME: side.home,
        PRJCT_NO_DAEMON: '1',
        CI: '1',
        NO_COLOR: '1',
      },
    })
    c.on('exit', () => resolve(performance.now() - t0))
    c.on('error', () => resolve(-1))
  })
}

async function median(side: Side, args: string[]): Promise<number> {
  const xs: number[] = []
  for (let i = 0; i < REPS; i++) xs.push(await once(side, args))
  xs.sort((a, b) => a - b)
  return xs[xs.length >> 1]
}

const CASES: Array<[string, string[]]> = [
  ['--version', ['--version']],
  ['status --md', ['status', '--md']],
  ['remember --md', ['remember', 'decision', 'bench probe', '--md']],
  ['search --md', ['search', 'bench', '--md']],
  ['guard file --md', ['guard', 'package.json', '--md']],
]

const [a, b] = process.argv.slice(2)
if (!a) {
  console.error('Usage: bun scripts/bench-ab.ts <baseline-version> [candidate-version]')
  process.exit(1)
}

console.log(`Fetching baseline prjct-cli@${a}…`)
const baseline = makeSide(`v${a}`, 'bun', fetchVersion(a))
let candidate: Side
if (b) {
  console.log(`Fetching candidate prjct-cli@${b}…`)
  candidate = makeSide(`v${b}`, 'bun', fetchVersion(b))
} else {
  candidate = makeSide('dev', 'bun', path.join(REPO, 'bin', 'prjct.ts'))
}

console.log(
  `\n${'command'.padEnd(18)} ${baseline.label.padStart(10)} ${candidate.label.padStart(10)}   Δ`
)
let regressions = 0
for (const [label, args] of CASES) {
  const mA = await median(baseline, args)
  const mB = await median(candidate, args)
  const pct = ((mA - mB) / mA) * 100
  if (pct < -10) regressions++
  console.log(
    `${label.padEnd(18)} ${`${mA.toFixed(1)}ms`.padStart(10)} ${`${mB.toFixed(1)}ms`.padStart(10)}   ${pct >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(0)}%${pct < -10 ? '  ⚠ REGRESSION' : ''}`
  )
}

for (const s of [baseline, candidate]) {
  fs.rmSync(s.home, { recursive: true, force: true })
  fs.rmSync(s.proj, { recursive: true, force: true })
}
if (regressions > 0) {
  console.error(`\n${regressions} command(s) regressed >10% vs ${baseline.label}.`)
  process.exit(1)
}
console.log('\nNo regressions >10%.')
