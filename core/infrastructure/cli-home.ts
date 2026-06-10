/**
 * The single definition of where prjct's global data lives.
 *
 * Resolved PER CALL, not at module load: tests mutate `PRJCT_CLI_HOME`
 * between cases, and under Bun `os.homedir()` ignores a changed HOME env
 * var — so any module-level `const X = path.join(os.homedir(), '.prjct-cli',
 * …)` silently reads/writes the user's REAL data from inside a test (the
 * vault-pollution bug class). Every consumer of the global dir must go
 * through here (or pathManager, whose constructor uses this).
 */

import os from 'node:os'
import path from 'node:path'

export function resolveCliHome(): string {
  const override = process.env.PRJCT_CLI_HOME?.trim()
  return override ? path.resolve(override) : path.join(os.homedir(), '.prjct-cli')
}
