/**
 * Typed process chokepoint (core/utils/exec.ts).
 *
 * Superiority contract vs gentle-ai v2.1.8 typed process errors:
 *   - deadline FIRST (timeoutMs + AbortSignal), then spawn, then overflow, then exit
 *   - only exitCodeMeans(code≥0) is a domain negative
 *   - overflow is INFRA (never synthetic exit -1)
 *   - envelopes sanitized ≤240; full cause stays in-process
 */

import { describe, expect, test } from 'bun:test'
import type { ChildProcess, spawn } from 'node:child_process'
import { exec as execCallback } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  exitCodeMeans,
  GitInfraError,
  gitInfraErrorOf,
  gitStdout,
  isProcInfra,
  matchProc,
  PROC_ENVELOPE_MAX,
  type ProcResult,
  procErrorOf,
  runProc,
  sanitizeProcEnvelope,
  throwProc,
} from '../../utils/exec'

const execAsync = promisify(execCallback)
const NODE = process.execPath

/** A spawn double whose process never produces output or exits. */
function hangingSpawn(): typeof spawn {
  return (() => {
    const child = new EventEmitter() as ChildProcess
    ;(child as { stdout: unknown }).stdout = new EventEmitter()
    ;(child as { stderr: unknown }).stderr = new EventEmitter()
    ;(child as { pid: number }).pid = 999_999_999
    ;(child as { kill: () => boolean }).kill = () => true
    return child
  }) as unknown as typeof spawn
}

describe('runProc classification', () => {
  test('ok result captures stdout/stderr + durationMs', async () => {
    const res = await runProc(NODE, ['-e', 'console.log("out"); console.error("err")'])
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.stdout.trim()).toBe('out')
      expect(res.stderr.trim()).toBe('err')
      expect(res.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  test('non-zero exit → kind exit with code, signal null, and streams', async () => {
    const res = await runProc(NODE, ['-e', 'console.error("boom"); process.exit(7)'])
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('exit')
      if (res.kind === 'exit') {
        expect(res.code).toBe(7)
        expect(res.signal).toBeNull()
        expect(res.stderr).toContain('boom')
      }
    }
  })

  test('missing binary → kind spawn with OS cause + code (never an exit)', async () => {
    const res = await runProc('prjct-definitely-not-a-real-binary-xyz', [])
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('spawn')
      if (res.kind === 'spawn') {
        expect(res.cause.message).toMatch(/ENOENT|not found/i)
        expect(res.code === undefined || res.code === 'ENOENT').toBe(true)
      }
    }
  })

  test('deadline → kind timeout carrying budget + budgetSource:timeout', async () => {
    const res = await runProc(NODE, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 150 })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('timeout')
      if (res.kind === 'timeout') {
        expect(res.budgetMs).toBe(150)
        expect(res.budgetSource).toBe('timeout')
      }
    }
  })

  test('AbortSignal (caller budget) wins without waiting the full timeoutMs', async () => {
    const ac = new AbortController()
    const pending = runProc(NODE, ['-e', 'setTimeout(() => {}, 5000)'], {
      timeoutMs: 10_000,
      signal: ac.signal,
    })
    setTimeout(() => ac.abort(), 50)
    const res = await pending
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('timeout')
      if (res.kind === 'timeout') expect(res.budgetSource).toBe('abort')
    }
  })

  test('already-aborted signal never spawns', async () => {
    const ac = new AbortController()
    ac.abort()
    const res = await runProc(NODE, ['-e', 'console.log("should-not-run")'], {
      signal: ac.signal,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('timeout')
      if (res.kind === 'timeout') {
        expect(res.budgetSource).toBe('abort')
        expect(res.budgetMs).toBe(0)
      }
    }
  })

  test('deadline precedence: timeout wins even when the process never closes cleanly', async () => {
    const res = await runProc(
      NODE,
      ['-e', 'process.on("SIGTERM", () => {}); setTimeout(() => {}, 5000)'],
      { timeoutMs: 150 }
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.kind).toBe('timeout')
  })

  test('timeout kills the whole process tree — grandchildren cannot escape', async () => {
    if (process.platform === 'win32') return
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-proc-tree-'))
    const marker = path.join(dir, 'grandchild-survived')
    try {
      const res = await runProc('sh', ['-c', `(sleep 1; touch "${marker}") & sleep 30`], {
        timeoutMs: 200,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.kind).toBe('timeout')
      await new Promise((resolve) => setTimeout(resolve, 1400))
      const exists = await fs
        .access(marker)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  test('maxBuffer overflow is INFRA (kind overflow) — never synthetic exit -1', async () => {
    const res = await runProc(NODE, ['-e', 'console.log("x".repeat(2_000_000))'], {
      maxBuffer: 1024,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.kind).toBe('overflow')
      if (res.kind === 'overflow') {
        expect(res.maxBuffer).toBe(1024)
        expect(isProcInfra(res)).toBe(true)
        // Domain-negative footgun must stay shut:
        expect(exitCodeMeans(res, -1)).toBe(false)
      }
    }
  })

  test('overflow settles immediately (does not wait for close/timeout)', async () => {
    const t0 = Date.now()
    const res = await runProc(
      NODE,
      ['-e', 'console.log("x".repeat(5_000_000)); setTimeout(()=>{}, 30_000)'],
      {
        maxBuffer: 512,
        timeoutMs: 30_000,
      }
    )
    const elapsed = Date.now() - t0
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.kind).toBe('overflow')
    // Must not wait for the 30s timeout — hang regression guard.
    expect(elapsed).toBeLessThan(5_000)
  })
})

describe('exitCodeMeans / gitInfraErrorOf / procErrorOf / matchProc', () => {
  const ok: ProcResult = { ok: true, stdout: '', stderr: '', durationMs: 1 }
  const exit1: ProcResult = {
    ok: false,
    kind: 'exit',
    code: 1,
    signal: null,
    stderr: 'no match',
    stdout: '',
    args: ['git', 'grep'],
    durationMs: 1,
  }
  const exitNeg: ProcResult = {
    ok: false,
    kind: 'exit',
    code: -1,
    signal: 'SIGKILL',
    stderr: '',
    stdout: '',
    args: ['git'],
    durationMs: 1,
  }
  const timeout: ProcResult = {
    ok: false,
    kind: 'timeout',
    budgetMs: 10,
    budgetSource: 'timeout',
    args: ['git'],
    stdout: '',
    stderr: '',
    durationMs: 1,
  }
  const spawnFail: ProcResult = {
    ok: false,
    kind: 'spawn',
    cause: new Error('ENOENT'),
    code: 'ENOENT',
    args: ['git'],
    durationMs: 1,
  }
  const overflow: ProcResult = {
    ok: false,
    kind: 'overflow',
    maxBuffer: 10,
    args: ['git'],
    stdout: '',
    stderr: 'maxBuffer',
    durationMs: 1,
  }

  test('only a typed exit with a real code ≥ 0 is a domain negative', () => {
    expect(exitCodeMeans(exit1, 1)).toBe(true)
    expect(exitCodeMeans(exit1, 2)).toBe(false)
    expect(exitCodeMeans(timeout, 1)).toBe(false)
    expect(exitCodeMeans(spawnFail, 1)).toBe(false)
    expect(exitCodeMeans(overflow, 1)).toBe(false)
    // Synthetic / signal-only codes are never domain:
    expect(exitCodeMeans(exitNeg, -1)).toBe(false)
    expect(exitCodeMeans(exit1, -1)).toBe(false)
  })

  test('isProcInfra covers timeout/spawn/overflow only', () => {
    expect(isProcInfra(ok)).toBe(false)
    expect(isProcInfra(exit1)).toBe(false)
    expect(isProcInfra(timeout)).toBe(true)
    expect(isProcInfra(spawnFail)).toBe(true)
    expect(isProcInfra(overflow)).toBe(true)
  })

  test('infra errors build GitInfraError; exit/ok build nothing', () => {
    expect(gitInfraErrorOf(ok)).toBeNull()
    expect(gitInfraErrorOf(exit1)).toBeNull()
    const infra = gitInfraErrorOf(timeout)
    expect(infra).toBeInstanceOf(GitInfraError)
    expect(infra?.kind).toBe('timeout')
    expect(gitInfraErrorOf(spawnFail)?.kind).toBe('spawn')
    expect(gitInfraErrorOf(overflow)?.kind).toBe('overflow')
  })

  test('procErrorOf: null on ok; generic Error on exit; GitInfraError on infra', () => {
    expect(procErrorOf(ok)).toBeNull()
    const exitErr = procErrorOf(exit1)
    expect(exitErr).toBeInstanceOf(Error)
    expect(exitErr).not.toBeInstanceOf(GitInfraError)
    expect(exitErr?.message).toMatch(/exit 1/)
    expect(exitErr?.message).toContain('no match')
    expect(procErrorOf(timeout)).toBeInstanceOf(GitInfraError)
    expect(procErrorOf(spawnFail)).toBeInstanceOf(GitInfraError)
    expect(procErrorOf(overflow)).toBeInstanceOf(GitInfraError)
  })

  test('throwProc never throws null — always a real Error', () => {
    expect(() => throwProc(exit1)).toThrow(/exit 1/)
    expect(() => throwProc(timeout)).toThrow(GitInfraError)
    expect(() => throwProc(overflow)).toThrow(GitInfraError)
    expect(() => throwProc(ok)).toThrow(/throwProc called on ok/)
  })

  test('matchProc is exhaustive and routes overflow away from exit', () => {
    const label = (r: ProcResult) =>
      matchProc(r, {
        ok: () => 'ok',
        exit: () => 'exit',
        timeout: () => 'timeout',
        spawn: () => 'spawn',
        overflow: () => 'overflow',
      })
    expect(label(ok)).toBe('ok')
    expect(label(exit1)).toBe('exit')
    expect(label(timeout)).toBe('timeout')
    expect(label(spawnFail)).toBe('spawn')
    expect(label(overflow)).toBe('overflow')
  })

  test('sanitizeProcEnvelope caps length and strips path-like segments', () => {
    const long = 'x'.repeat(500)
    expect(sanitizeProcEnvelope(long).length).toBeLessThanOrEqual(PROC_ENVELOPE_MAX)
    const withPath = 'failed reading /Users/jj/secret/repo/.git/config boom'
    expect(sanitizeProcEnvelope(withPath)).not.toContain('/Users/jj')
    expect(sanitizeProcEnvelope(withPath)).toContain('…')
  })

  test('GitInfraError.message is envelope-sanitized; detail keeps full text', () => {
    const detail = `exceeded while reading /Users/jj/secret/project/.git`
    const err = new GitInfraError('timeout', ['git', 'status'], detail)
    expect(err.message.length).toBeLessThanOrEqual(PROC_ENVELOPE_MAX)
    expect(err.message).not.toContain('/Users/jj')
    expect(err.detail).toBe(detail)
  })
})

describe('gitStdout', () => {
  test('returns trimmed stdout on success', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-gitstdout-'))
    try {
      await execAsync('git init -q', { cwd: dir })
      const out = await gitStdout(dir, ['rev-parse', '--is-inside-work-tree'])
      expect(out).toBe('true')
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  test('typed exit (missing ref) → null, the legitimate domain negative', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-gitstdout-'))
    try {
      await execAsync('git init -q', { cwd: dir })
      const out = await gitStdout(dir, ['rev-parse', '--verify', '--quiet', 'no-such-ref'])
      expect(out).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  test('timeout → throws GitInfraError instead of collapsing to null', async () => {
    await expect(
      gitStdout(process.cwd(), ['status'], { spawnFn: hangingSpawn(), timeoutMs: 100 })
    ).rejects.toBeInstanceOf(GitInfraError)
  })

  test('spawn failure → throws GitInfraError (never null domain negative)', async () => {
    const spawnFn = (() => {
      const child = new EventEmitter() as ChildProcess
      ;(child as { stdout: unknown }).stdout = new EventEmitter()
      ;(child as { stderr: unknown }).stderr = new EventEmitter()
      ;(child as { pid: number }).pid = 1
      ;(child as { kill: () => boolean }).kill = () => true
      queueMicrotask(() =>
        child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }))
      )
      return child
    }) as unknown as typeof spawn
    await expect(gitStdout(process.cwd(), ['status'], { spawnFn })).rejects.toBeInstanceOf(
      GitInfraError
    )
  })
})
