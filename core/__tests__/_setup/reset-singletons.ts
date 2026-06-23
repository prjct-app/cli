/**
 * Global test isolation preload (wired via `bunfig.toml` → [test].preload).
 *
 * The codebase has module-level singletons whose state leaks across test
 * files when the whole suite runs in one process. The worst offender is the
 * circuit-breaker registry in `core/utils/retry.ts`: it is shared across
 * every RetryPolicy instance, so when `agent-initialization` fails enough
 * times in one suite (common on a CI runner with no agent installed) the
 * breaker opens and every later test that initializes a project fails fast
 * with "circuit breaker is open" — a cascade of 30+ failures that has
 * nothing to do with the code under test, and that flips on/off purely with
 * test ordering and timing.
 *
 * Clearing the breaker before each test makes the suite order-independent
 * and the cascade impossible. Hooks declared in a preload apply globally to
 * every test file.
 */

import { beforeEach } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resetCircuitBreakers } from '../../utils/retry'

// Sandbox the vault root for the ENTIRE test process.
//
// `getWikiPath` defaults to `<vault-root>/<slug>/`. Any test that
// creates a tmp project and triggers vault generation (crew/retro/
// review-risk/sync/remember…) otherwise wrote a real folder into the user's
// `<vault-root>/` and never cleaned it — hundreds of orphan
// `prjct-*-test-*` vaults accumulated. `PRJCT_VAULT_ROOT` (honored by
// core/infrastructure/path-manager/wiki-paths.ts) redirects every vault into
// a throwaway temp dir that we remove on process exit. Set before any test
// imports the path manager so it's in effect process-wide.
if (!process.env.PRJCT_VAULT_ROOT) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-test-vault-'))
  process.env.PRJCT_VAULT_ROOT = sandbox
  const cleanup = () => {
    try {
      fs.rmSync(sandbox, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
}

// Deterministic agent detection for the whole test process.
//
// `agentService` only accepts agent type `claude` (VALID_AGENT_TYPES), but
// `agentDetector.detect()` falls back to `terminal` when it can't prove a
// Claude environment — which it proves via CLAUDE_AGENT/ANTHROPIC_CLAUDE
// env, MCP, a CLAUDE.md in cwd, or ~/.claude in HOME. On a dev machine
// ~/.claude almost always exists, so init succeeds. On a CI runner none of
// those hold, so detection returns `terminal` → "Unsupported agent type:
// terminal" → every test that initializes a project fails — but only when
// test ordering hasn't already cached a `claude` agent on the singleton.
// That made the suite pass on main by luck and fail here once new test
// files shifted ordering. Pinning the env makes detection deterministic
// everywhere, exactly as if running under Claude.
process.env.CLAUDE_AGENT = '1'

// Reset the module-level circuit-breaker registry (see core/utils/retry.ts)
// before every test so one suite's failures can't open the shared breaker
// and cascade "circuit breaker is open" into every later test.
beforeEach(() => {
  resetCircuitBreakers()
})
