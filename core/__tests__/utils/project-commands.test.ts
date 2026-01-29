/**
 * Project command detection tests
 * Ensures prjct-cli uses the repo's own test/lint tooling (not hardcoded).
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { detectProjectCommands } from '../../utils/project-commands'

let tmpRoot: string | null = null

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

describe('detectProjectCommands', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-detect-commands-'))
  })

  afterEach(async () => {
    if (!tmpRoot) return
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  })

  it('detects JS project and respects declared pnpm packageManager', async () => {
    await writeJson(path.join(tmpRoot!, 'package.json'), {
      name: 'x',
      packageManager: 'pnpm@9.0.0',
      scripts: { test: 'vitest', lint: 'eslint .', typecheck: 'tsc -p tsconfig.json' },
    })

    const detected = await detectProjectCommands(tmpRoot!)
    expect(detected.stack).toBe('js')
    expect(detected.packageManager).toBe('pnpm')
    expect(detected.test?.command).toBe('pnpm test')
    expect(detected.lint?.command).toBe('pnpm run lint')
    expect(detected.typecheck?.command).toBe('pnpm run typecheck')
  })

  it('detects Python pytest via pytest.ini', async () => {
    await writeText(path.join(tmpRoot!, 'pytest.ini'), '[pytest]\n')
    const detected = await detectProjectCommands(tmpRoot!)
    expect(detected.stack).toBe('python')
    expect(detected.test?.command).toBe('pytest')
  })

  it('detects Go via go.mod', async () => {
    await writeText(path.join(tmpRoot!, 'go.mod'), 'module example.com/test\n')
    const detected = await detectProjectCommands(tmpRoot!)
    expect(detected.stack).toBe('go')
    expect(detected.test?.command).toBe('go test ./...')
  })

  it('detects Rust via Cargo.toml', async () => {
    await writeText(path.join(tmpRoot!, 'Cargo.toml'), '[package]\nname="x"\nversion="0.1.0"\n')
    const detected = await detectProjectCommands(tmpRoot!)
    expect(detected.stack).toBe('rust')
    expect(detected.test?.command).toBe('cargo test')
  })
})


