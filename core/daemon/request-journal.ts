import type { DaemonRequest, DaemonResponse } from '../types/daemon'

interface JournalEntry {
  createdAt: number
  fingerprint: string
  promise?: Promise<DaemonResponse>
  response?: DaemonResponse
}

export interface RequestJournalOptions {
  ttlMs?: number
  maxEntries?: number
  now?: () => number
}

export class RequestJournal {
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number
  private readonly entries = new Map<string, JournalEntry>()

  constructor(options: RequestJournalOptions = {}) {
    this.ttlMs = options.ttlMs ?? 120_000
    this.maxEntries = options.maxEntries ?? 512
    this.now = options.now ?? Date.now
  }

  run(request: DaemonRequest, runner: () => Promise<DaemonResponse>): Promise<DaemonResponse> {
    const now = this.now()
    this.prune(now)

    const fingerprint = requestFingerprint(request)
    const existing = this.entries.get(request.id)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return Promise.resolve({
          id: request.id,
          success: false,
          exitCode: 1,
          stderr: 'Duplicate daemon request id reused with different payload',
        })
      }
      if (existing.response) return Promise.resolve(cloneResponse(existing.response))
      if (existing.promise) return existing.promise.then(cloneResponse)
    }

    const entry: JournalEntry = { createdAt: now, fingerprint }
    const promise = runner()
      .then((response) => {
        entry.response = cloneResponse(response)
        entry.promise = undefined
        return cloneResponse(response)
      })
      .catch((error) => {
        this.entries.delete(request.id)
        throw error
      })

    entry.promise = promise
    this.entries.set(request.id, entry)
    this.enforceMaxEntries()
    return promise
  }

  clear(): void {
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }

  private prune(now: number): void {
    for (const [id, entry] of this.entries) {
      if (now - entry.createdAt > this.ttlMs) this.entries.delete(id)
    }
  }

  private enforceMaxEntries(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (!oldest) break
      this.entries.delete(oldest)
    }
  }
}

function requestFingerprint(request: DaemonRequest): string {
  return stableStringify({
    command: request.command,
    args: request.args,
    options: request.options,
    cwd: request.cwd,
    stdin: request.stdin,
  })
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function cloneResponse(response: DaemonResponse): DaemonResponse {
  return { ...response }
}

export const daemonRequestJournal = new RequestJournal()
