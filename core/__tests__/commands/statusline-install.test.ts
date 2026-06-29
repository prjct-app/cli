/**
 * Statusline install guard tests.
 *
 * The monolithic (bash-3.2-safe) statusline generator must:
 *   - REPLACE an old/legacy body (e.g. the project.json-based one that caused
 *     the permanent false "upgrade available" banner) with the flag-reading
 *     body that consults ~/.prjct-cli/state/update-status.json
 *   - NEVER clobber a modern modular ("v2") statusline (detected by the
 *     `build_statusline` marker), which lives in statusline-installer.ts and
 *     requires bash 4+ — downgrading those users would break their statusline.
 *
 * HOME is redirected to a temp dir (resolveUserHome reads process.env.HOME
 * live) so nothing touches the real ~/.claude.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SetupCommands } from '../../commands/setup'

let tmpHome: string
let prevHome: string | undefined
let statusLinePath: string

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-statusline-'))
  fs.mkdirSync(path.join(tmpHome, '.claude'), { recursive: true })
  statusLinePath = path.join(tmpHome, '.claude', 'prjct-statusline.sh')
  prevHome = process.env.HOME
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME
  else process.env.HOME = prevHome
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

describe('installStatusLine — guard', () => {
  test('replaces a legacy project.json body with the flag-reading body', async () => {
    fs.writeFileSync(
      statusLinePath,
      '#!/bin/bash\nCLI_VERSION="3.0.0"\n# legacy: checks project.json\n'
    )

    const result = await new SetupCommands().installStatusLine()
    expect(result.success).toBe(true)

    const body = fs.readFileSync(statusLinePath, 'utf-8')
    expect(body).toContain('update-status.json')
    expect(body).not.toContain('project.json')
  })

  test('does not clobber a modern modular (v2) statusline', async () => {
    const modular = '#!/usr/bin/env bash\n# prjct statusline v2\nbuild_statusline() { :; }\n'
    fs.writeFileSync(statusLinePath, modular)

    const result = await new SetupCommands().installStatusLine()
    expect(result.success).toBe(true)

    // Untouched — still the modular script.
    expect(fs.readFileSync(statusLinePath, 'utf-8')).toBe(modular)
  })

  test('installs the flag-reading body on a fresh machine', async () => {
    const result = await new SetupCommands().installStatusLine()
    expect(result.success).toBe(true)

    const body = fs.readFileSync(statusLinePath, 'utf-8')
    expect(body).toContain('update-status.json')
    expect(body).not.toContain('project.json')
  })
})
