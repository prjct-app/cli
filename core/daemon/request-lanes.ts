/**
 * Serialized request lanes for the daemon.
 *
 * Commands patch the GLOBAL console.log/error to capture output, so they
 * must never run concurrently with each other. Hooks use HookIo (not console
 * capture) and are the latency-critical path for Claude Code — a long
 * `prjct sync` must not head-of-line-block Prompt/Stop.
 *
 * Two lanes:
 *   - command: exclusive, one-at-a-time
 *   - hook: exclusive among hooks, independent of the command lane
 *
 * SQLite remains single-writer at the C boundary (better-sqlite3 is sync);
 * interleaving at await points already happens across MCP processes (see
 * concurrent-MCP gotcha). Hook afterEmit is detached, so the hook lane stays
 * short.
 */

export type LaneName = 'command' | 'hook'

export class RequestLanes {
  private commandChain: Promise<unknown> = Promise.resolve()
  private hookChain: Promise<unknown> = Promise.resolve()

  run<T>(lane: LaneName, work: () => Promise<T>): Promise<T> {
    const chain = lane === 'hook' ? this.hookChain : this.commandChain
    const run = chain.then(work, work)
    const settled = run.then(
      () => undefined,
      () => undefined
    )
    if (lane === 'hook') this.hookChain = settled
    else this.commandChain = settled
    return run
  }
}

export const daemonRequestLanes = new RequestLanes()
