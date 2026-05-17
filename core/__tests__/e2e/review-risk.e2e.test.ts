/**
 * E2E: `prjct review-risk` through the real CLI subprocess against real git
 * repos of varying shapes. The unit test covers the pure tier/geometry math;
 * this covers the actual command end-to-end (git parsing + --md output +
 * exit codes) in a hermetic sandbox.
 *
 *   no-signal → trivial/direct → large/split
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { makeSandbox, type Sandbox } from './_harness'

setDefaultTimeout(120_000)

function git(cwd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd, stdio: 'ignore' })
    p.on('error', reject)
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`git ${args[0]} → ${c}`))))
  })
}

describe('e2e: review-risk (real CLI, hermetic git repos)', () => {
  let sb: Sandbox

  beforeAll(async () => {
    sb = await makeSandbox()
    expect((await sb.cli(['init'], { timeoutMs: 90_000 })).code).toBe(0)
    expect((await sb.cli(['setup'], { timeoutMs: 90_000 })).code).toBe(0)
  })
  afterAll(async () => {
    await sb.cleanup()
  })

  test('no-signal (nothing ahead of base) → exit 0, graceful message', async () => {
    const r = await sb.cli(['review-risk', '--md'])
    expect(r.code).toBe(0)
    expect(r.stdout.toLowerCase()).toMatch(/no comparable|review risk|trivial/)
  })

  test('trivial change on a feature branch → direct', async () => {
    await git(sb.dir, ['checkout', '-q', '-b', 'feat/tiny'])
    await fs.writeFile(path.join(sb.dir, 'tiny.txt'), 'one small line\n')
    await git(sb.dir, ['add', '.'])
    await git(sb.dir, ['commit', '-q', '-m', 'tiny'])

    const r = await sb.cli(['review-risk', '--md'])
    expect(r.code).toBe(0)
    expect(r.stdout.toLowerCase()).toMatch(/trivial|direct/)
  })

  test('large change (many files) → split, never mutates git', async () => {
    await git(sb.dir, ['checkout', '-q', 'main'])
    await git(sb.dir, ['checkout', '-q', '-b', 'feat/huge'])
    for (let i = 0; i < 14; i++) {
      await fs.writeFile(path.join(sb.dir, `mod${i}.ts`), `export const v${i} = ${i}\n`.repeat(50))
    }
    await git(sb.dir, ['add', '.'])
    await git(sb.dir, ['commit', '-q', '-m', 'huge'])

    const head = (await sb.cli(['review-risk'])).stdout // also exercise non-md
    const r = await sb.cli(['review-risk', '--md'])
    expect(r.code).toBe(0)
    expect((head + r.stdout).toLowerCase()).toMatch(/large|split/)

    // Read-only contract: branch unchanged, no stray commits.
    const log = await new Promise<string>((resolve) => {
      let out = ''
      const p = spawn('git', ['log', '--oneline'], { cwd: sb.dir })
      p.stdout.on('data', (d) => {
        out += d.toString()
      })
      p.on('exit', () => resolve(out))
    })
    expect(log.split('\n').filter(Boolean).length).toBe(2) // init + huge only
  })
})
