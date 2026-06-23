import { describe, expect, test } from 'bun:test'
import { RequestJournal } from '../../daemon/request-journal'
import type { DaemonRequest, DaemonResponse } from '../../types/daemon'

function request(overrides: Partial<DaemonRequest> = {}): DaemonRequest {
  return {
    id: 'req-1',
    command: 'capture',
    args: ['note'],
    options: { md: true },
    cwd: '/tmp/project',
    ...overrides,
  }
}

describe('RequestJournal', () => {
  test('shares one in-flight runner for duplicate request ids', async () => {
    const journal = new RequestJournal()
    let calls = 0
    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })

    const runner = async (): Promise<DaemonResponse> => {
      calls++
      await wait
      return { id: 'req-1', success: true, exitCode: 0, stdout: 'ok' }
    }

    const first = journal.run(request(), runner)
    const second = journal.run(request(), runner)
    release()

    expect(await first).toEqual({ id: 'req-1', success: true, exitCode: 0, stdout: 'ok' })
    expect(await second).toEqual({ id: 'req-1', success: true, exitCode: 0, stdout: 'ok' })
    expect(calls).toBe(1)
  })

  test('replays a completed response without rerunning side effects', async () => {
    const journal = new RequestJournal()
    let calls = 0
    const runner = async (): Promise<DaemonResponse> => {
      calls++
      return { id: 'req-1', success: true, exitCode: 0, result: { done: true } }
    }

    expect(await journal.run(request(), runner)).toEqual({
      id: 'req-1',
      success: true,
      exitCode: 0,
      result: { done: true },
    })
    expect(await journal.run(request(), runner)).toEqual({
      id: 'req-1',
      success: true,
      exitCode: 0,
      result: { done: true },
    })
    expect(calls).toBe(1)
  })

  test('rejects the same request id with a different payload', async () => {
    const journal = new RequestJournal()
    const runner = async (): Promise<DaemonResponse> => ({
      id: 'req-1',
      success: true,
      exitCode: 0,
    })

    await journal.run(request(), runner)
    const conflict = await journal.run(request({ command: 'done' }), runner)

    expect(conflict.success).toBe(false)
    expect(conflict.stderr).toContain('Duplicate daemon request id')
  })

  test('expires old entries by ttl', async () => {
    let now = 0
    const journal = new RequestJournal({ ttlMs: 10, now: () => now })
    let calls = 0
    const runner = async (): Promise<DaemonResponse> => {
      calls++
      return { id: 'req-1', success: true, exitCode: 0 }
    }

    await journal.run(request(), runner)
    now = 11
    await journal.run(request(), runner)

    expect(calls).toBe(2)
  })
})
