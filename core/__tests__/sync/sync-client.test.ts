import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import authConfig from '../../sync/auth-config'
import syncClient from '../../sync/sync-client'
import type { SyncEvent } from '../../types/events'

type FetchCall = { url: string; init: RequestInit | undefined }

let tmpDir: string
let tmpPath: string
const originalConfigPath = (authConfig as unknown as { configPath: string }).configPath
const originalFetch = globalThis.fetch
let calls: FetchCall[] = []

async function seedAuth(apiKey: string | null = 'sk_test_key') {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-sync-client-test-'))
  tmpPath = path.join(tmpDir, 'auth.json')
  ;(authConfig as unknown as { configPath: string }).configPath = tmpPath
  authConfig.clearCache()
  if (apiKey) {
    await authConfig.saveAuth(apiKey, 'user-1', 'u@x')
  }
}

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
  calls = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    calls.push({ url: urlStr, init })
    return impl(urlStr, init)
  }) as typeof fetch
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  ;(authConfig as unknown as { configPath: string }).configPath = originalConfigPath
  authConfig.clearCache()
  if (tmpDir) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

describe('SyncClient.pushEvents', () => {
  beforeEach(async () => {
    await seedAuth()
  })

  it('throws AUTH_REQUIRED when no api key', async () => {
    await authConfig.clearAuth()
    await expect(syncClient.pushEvents('proj-1', [])).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    })
  })

  it('posts transformed events to /sync/batch', async () => {
    const payload = { success: true, processed: 1, errors: [], syncedAt: '2026-04-10T00:00:00Z' }
    stubFetch(() => jsonResponse(200, payload))

    const events: SyncEvent[] = [
      {
        type: 'task.created',
        path: [],
        data: { id: 't1', title: 'hello' },
        timestamp: '2026-04-10T00:00:00Z',
        projectId: 'proj-1',
      },
    ]

    const result = await syncClient.pushEvents('proj-1', events)

    expect(result).toEqual(payload)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/sync/batch')
    expect(calls[0].init?.method).toBe('POST')
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['X-Api-Key']).toBe('sk_test_key')

    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.projectId).toBe('proj-1')
    expect(body.events).toHaveLength(1)
    expect(body.events[0].entity_type).toBe('tasks')
  })

  it('surfaces 401 as AUTH_REQUIRED error', async () => {
    stubFetch(() => jsonResponse(401, { error: 'bad key' }))
    await expect(syncClient.pushEvents('proj-1', [])).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
    })
  })

  it('surfaces 400 as API_ERROR', async () => {
    stubFetch(() => jsonResponse(400, { message: 'malformed' }))
    await expect(syncClient.pushEvents('proj-1', [])).rejects.toMatchObject({
      code: 'API_ERROR',
      status: 400,
      message: 'malformed',
    })
  })
})

describe('SyncClient.pullEvents', () => {
  beforeEach(async () => {
    await seedAuth()
  })

  it('calls /sync/pull with sinceEventId in the body', async () => {
    stubFetch(() => jsonResponse(200, { events: [] }))

    await syncClient.pullEvents('proj-1', 42)

    expect(calls[0].url).toContain('/sync/pull')
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.projectId).toBe('proj-1')
    expect(body.sinceEventId).toBe(42)
  })

  it('Phase 1.6 / B4: NEVER sends `since` (legacy timestamp), even when caller passes one', async () => {
    stubFetch(() => jsonResponse(200, { events: [] }))

    // Caller still allowed to pass sinceTimestamp for source-compat —
    // it must be silently ignored, not forwarded on the wire.
    await syncClient.pullEvents('proj-1', 42, '2026-04-01T00:00:00Z')

    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.since).toBeUndefined()
    expect('since' in body).toBe(false)
    // sinceEventId still rides through.
    expect(body.sinceEventId).toBe(42)
  })

  it('omits sinceEventId when zero or missing (initial pull)', async () => {
    stubFetch(() => jsonResponse(200, { events: [] }))

    await syncClient.pullEvents('proj-1')

    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.projectId).toBe('proj-1')
    expect('sinceEventId' in body).toBe(false)
    expect('since' in body).toBe(false)
  })

  it('throws AUTH_REQUIRED when unauthenticated', async () => {
    await authConfig.clearAuth()
    await expect(syncClient.pullEvents('proj-1')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    })
  })
})

describe('SyncClient.testConnection', () => {
  it('returns false when no api key', async () => {
    await seedAuth(null)
    expect(await syncClient.testConnection()).toBe(false)
  })

  it('returns true on healthy 200', async () => {
    await seedAuth()
    stubFetch(() => new Response('ok', { status: 200 }))
    expect(await syncClient.testConnection()).toBe(true)
  })

  it('returns false on network error', async () => {
    await seedAuth()
    stubFetch(() => {
      throw new Error('network down')
    })
    expect(await syncClient.testConnection()).toBe(false)
  })
})

describe('SyncClient.hasAuth', () => {
  it('reflects authConfig state', async () => {
    await seedAuth()
    expect(await syncClient.hasAuth()).toBe(true)
    await authConfig.clearAuth()
    expect(await syncClient.hasAuth()).toBe(false)
  })
})
