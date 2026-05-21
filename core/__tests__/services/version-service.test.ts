import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { bumpPatch, VersionService } from '../../services/version-service'
import { execFileAsync } from '../../utils/exec'

describe('bumpPatch', () => {
  it('bumps stable patch', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4')
    expect(bumpPatch('0.0.0')).toBe('0.0.1')
    expect(bumpPatch('10.20.30')).toBe('10.20.31')
  })

  it('increments trailing numeric identifier in prerelease', () => {
    expect(bumpPatch('2.0.0-alpha.12')).toBe('2.0.0-alpha.13')
    expect(bumpPatch('1.0.0-rc.0')).toBe('1.0.0-rc.1')
    expect(bumpPatch('3.1.4-beta.99')).toBe('3.1.4-beta.100')
  })

  it('appends .1 to prerelease without numeric tail', () => {
    expect(bumpPatch('0.1.0-beta')).toBe('0.1.0-beta.1')
    expect(bumpPatch('1.0.0-alpha')).toBe('1.0.0-alpha.1')
    expect(bumpPatch('2.0.0-rc')).toBe('2.0.0-rc.1')
  })

  it('handles multi-segment prerelease with numeric tail', () => {
    expect(bumpPatch('1.0.0-alpha.beta.5')).toBe('1.0.0-alpha.beta.6')
  })

  it('appends .1 when multi-segment prerelease ends non-numerically', () => {
    expect(bumpPatch('1.0.0-alpha.beta')).toBe('1.0.0-alpha.beta.1')
  })

  it('drops build metadata on bump', () => {
    expect(bumpPatch('1.2.3+build.42')).toBe('1.2.4')
    expect(bumpPatch('2.0.0-alpha.1+sha.abc')).toBe('2.0.0-alpha.2')
  })

  it('returns unchanged when input is not a valid semver', () => {
    expect(bumpPatch('not-a-version')).toBe('not-a-version')
    expect(bumpPatch('1.2')).toBe('1.2')
    expect(bumpPatch('')).toBe('')
    expect(bumpPatch('v1.2.3')).toBe('v1.2.3')
  })

  it('does NOT regress prerelease to stable (P0 guard)', () => {
    expect(bumpPatch('2.0.0-alpha.12')).not.toBe('2.0.1')
    expect(bumpPatch('1.0.0-rc.1')).not.toBe('1.0.1')
  })
})

// VersionService.bump idempotency — prevents the "double-bump on ship retry"
// failure mode where v2.4.39 → v2.4.41 → v2.4.43 stacks across runs.

describe('VersionService.bump (idempotency)', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-version-'))
    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir })
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir })
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  async function commitPkg(version: string): Promise<void> {
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ version }, null, 2))
    await execFileAsync('git', ['add', 'package.json'], { cwd: dir })
    await execFileAsync('git', ['commit', '-q', '-m', `v${version}`], { cwd: dir })
  }

  async function readPkgVersion(): Promise<string> {
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf-8')
    return (JSON.parse(raw) as { version: string }).version
  }

  it('bumps normally when working tree matches HEAD', async () => {
    await commitPkg('1.2.3')
    const next = await new VersionService(dir).bump()
    expect(next).toBe('1.2.4')
    expect(await readPkgVersion()).toBe('1.2.4')
  })

  it('returns working-tree version unchanged when already ahead of HEAD', async () => {
    // Simulate a partial-ship: HEAD is 1.2.3 but working tree was bumped to 1.2.4.
    await commitPkg('1.2.3')
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ version: '1.2.4' }, null, 2)
    )

    // Retry: should NOT bump to 1.2.5.
    const next = await new VersionService(dir).bump()
    expect(next).toBe('1.2.4')
    expect(await readPkgVersion()).toBe('1.2.4')
  })

  it('still bumps when working tree equals HEAD even after multi-bump history', async () => {
    // Successful prior ship: HEAD is 1.2.4, working tree is 1.2.4.
    // Next ship should bump normally to 1.2.5.
    await commitPkg('1.2.3')
    await commitPkg('1.2.4')
    const next = await new VersionService(dir).bump()
    expect(next).toBe('1.2.5')
  })

  it('falls back to normal bump when no git HEAD exists', async () => {
    // Fresh repo with no commits — package.json is untracked.
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ version: '0.1.0' }, null, 2)
    )
    const next = await new VersionService(dir).bump()
    expect(next).toBe('0.1.1')
  })
})
