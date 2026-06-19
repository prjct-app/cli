/**
 * Global test isolation (mem_1560 — test vault pollution root cause).
 *
 * Point PRJCT_CLI_HOME at a throwaway temp dir for the WHOLE test run, BEFORE
 * any prjct module loads. pathManager reads PRJCT_CLI_HOME at construction
 * (singleton import time), so setting it in a preload means every test that
 * does NOT explicitly isolate (via PRJCT_PROJECTS_DIR or setGlobalBaseDir)
 * writes its fixture projects/cache/state into the temp dir instead of the
 * real ~/.prjct-cli. Must be the FIRST preload (before reset-singletons, which
 * imports prjct modules). An explicit PRJCT_CLI_HOME (e.g. CI sandbox) wins.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

if (!process.env.PRJCT_CLI_HOME) {
  process.env.PRJCT_CLI_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-test-home-'))
}
