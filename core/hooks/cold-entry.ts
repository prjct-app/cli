#!/usr/bin/env node
/**
 * Dedicated COLD hook entry — the in-process path a freshly-spawned `prjct
 * hook <event>` takes when the daemon is unreachable or disabled
 * (PRJCT_NO_DAEMON=1).
 *
 * WHY THIS FILE EXISTS (perf):
 *   The daemon shim (scripts/build.js `generateDaemonShim`) used to fall back
 *   to `import("./prjct-core.mjs")` for cold hooks — the FULL ~936KB CLI
 *   bundle (every command, the MCP server, sync, wiki, analysis…), just to run
 *   one hook whose real dependency closure is ~136KB. Parsing the extra ~800KB
 *   on every cold hook is the dominant cost the hot-path benchmark measures
 *   (scripts/bench-hooks.mjs; see mem_360 — spawn + module-load dominated, not
 *   hook logic). esbuild bundles THIS entry on its own into
 *   `dist/bin/prjct-hooks.mjs`, so the cold path parses only the hook closure.
 *
 * CONTRACT (must stay byte-identical to the old cold path in bin/prjct.ts):
 *   - emit the hook's JSON line to stdout, then AWAIT every `afterEmit`
 *     side-effect (vault regen, transcript ingest) before exit — cold mode has
 *     no daemon to detach them onto, and skipping them is what made the vault
 *     go stale. afterEmit is awaited here exactly as bin/prjct.ts did.
 *   - fail-soft: any throw degrades to `{}` + exit 0; a hook must never disturb
 *     the host session.
 *
 * The warm daemon path (core/daemon/daemon.ts handleHookRequest) and the
 * dev/source path (`bun bin/prjct.ts hook`) are unchanged.
 */

import { getHookRunner } from './registry'

/** Read all of stdin (the hook event JSON) with a timeout safety net.
 *  Mirrors bin/prjct.ts `readAllStdin`. */
async function readAllStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return ''
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve(Buffer.concat(chunks).toString('utf-8'))
    }
    process.stdin.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    process.stdin.on('end', finish)
    process.stdin.on('error', finish)
    setTimeout(finish, timeoutMs)
  })
}

async function main(): Promise<void> {
  // argv after the runtime + script: ["hook", "<subcommand>", ...].
  const args = process.argv.slice(2)
  const subcommand = args[1]
  try {
    const runner = getHookRunner(subcommand)
    if (!runner) {
      process.stdout.write('{}\n')
      process.exit(0)
    }
    const stdinPayload = await readAllStdin(1000)
    let input: unknown = {}
    try {
      input = stdinPayload ? JSON.parse(stdinPayload) : {}
    } catch {
      input = {}
    }
    const pending: Array<() => Promise<void>> = []
    await runner(process.cwd(), {
      input,
      sink: (chunk: string) => {
        process.stdout.write(chunk)
      },
      detachAfterEmit: (fn: () => Promise<void>) => {
        pending.push(fn)
      },
    })
    for (const fn of pending) await fn().catch(() => undefined)
    process.exit(0)
  } catch {
    process.stdout.write('{}\n')
    process.exit(0)
  }
}

void main()
