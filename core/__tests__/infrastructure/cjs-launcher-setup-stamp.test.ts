import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
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

describe('portable CJS launcher — in-process fast start', () => {
  test('runs the bundled entry in-process, tried BEFORE spawning a runtime', () => {
    const src = source()
    // The perf fix: import the entry in-process (no second runtime boot)
    // instead of spawnSync'ing bun/node — the double boot was ~40ms/command.
    expect(src).toContain('async function runInProcess()')
    expect(src).toContain('await import(url.pathToFileURL(distBin).href)')
    // In-process must be attempted before the spawn fallbacks, or the win is lost.
    const inProcIdx = src.indexOf('if (await runInProcess()) return')
    const bunIdx = src.indexOf('if (runWithBun(args)) return')
    const nodeIdx = src.indexOf('runWithNode(args)\n}')
    expect(inProcIdx).toBeGreaterThan(0)
    expect(inProcIdx).toBeLessThan(bunIdx)
    expect(bunIdx).toBeLessThan(nodeIdx)
    // main() must be async to await the in-process import.
    expect(src).toContain('async function main()')
  })

  test('suppresses the cosmetic node:sqlite ExperimentalWarning (clean stderr)', () => {
    const src = source()
    expect(src).toContain('process.emitWarning =')
    expect(src).toContain('/sqlite/i')
  })

  test('gates in-process on node >=22.5 and a present bundle; Windows keeps spawn', () => {
    const src = source()
    expect(src).toContain('if (!fs.existsSync(distBin) || !nodeVersionOk()) return false')
    expect(src).toContain("if (process.platform === 'win32') return false")
  })

  // Runtime proof — only when a build exists (skipped in unbuilt checkouts so
  // the source-inspection tests above still run everywhere).
  const distBin = path.join(ROOT, 'dist', 'bin', 'prjct.mjs')
  const cjs = path.join(ROOT, 'bin', 'prjct.cjs')
  test.if(fs.existsSync(distBin))(
    'in-process launch executes a command with a clean exit + no sqlite warning',
    () => {
      const r = spawnSync('node', [cjs, '--version'], {
        encoding: 'utf-8',
        env: { ...process.env, PRJCT_NO_DAEMON: '1' },
      })
      expect(r.status).toBe(0)
      expect(r.stdout).toMatch(/v\d+\.\d+\.\d+/)
      expect(r.stderr).not.toMatch(/sqlite/i)
    }
  )
})
