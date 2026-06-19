/**
 * pathManager.globalProjectsDir — PRJCT_PROJECTS_DIR override (mem_1560).
 *
 * The projects dir is resolved at ACCESS time and honors PRJCT_PROJECTS_DIR so
 * a test run can point it at a temp dir instead of polluting the real
 * ~/.prjct-cli/projects. ~18 test files already set this env var in beforeEach;
 * before this it was silently ignored (code read only PRJCT_CLI_HOME, resolved
 * at construction), so every run leaked fixture projects into the real dir.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'

describe('pathManager.globalProjectsDir — PRJCT_PROJECTS_DIR override', () => {
  const original = process.env.PRJCT_PROJECTS_DIR
  afterEach(() => {
    if (original === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = original
  })

  it('honors PRJCT_PROJECTS_DIR at access time, resolved absolute', () => {
    process.env.PRJCT_PROJECTS_DIR = '/tmp/prjct-test-projects-xyz'
    expect(pathManager.globalProjectsDir).toBe(path.resolve('/tmp/prjct-test-projects-xyz'))
    expect(pathManager.getGlobalProjectPath('abc-123')).toBe(
      path.join(path.resolve('/tmp/prjct-test-projects-xyz'), 'abc-123')
    )
  })

  it('falls back to <globalBaseDir>/projects when unset', () => {
    delete process.env.PRJCT_PROJECTS_DIR
    expect(pathManager.globalProjectsDir).toBe(path.join(pathManager.globalBaseDir, 'projects'))
  })
})
