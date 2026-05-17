/**
 * `prjct review-risk` — advisory size/delivery-geometry signal
 * (#18/19/20, minimal cut). Pure tier/geometry logic + an integration
 * smoke over a real tmp git repo + the graceful no-base path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _internal, ReviewRiskCommands } from '../../commands/review-risk'
import { execFileAsync } from '../../utils/exec'

describe('review-risk — tier + geometry (pure)', () => {
  it('trivial → direct', () => {
    const t = _internal.tierOf({ base: 'x', files: 1, loc: 5, dirs: ['core'] })
    expect(t).toBe('trivial')
    expect(_internal.geometryOf(t)).toBe('direct')
  })
  it('normal → single', () => {
    const t = _internal.tierOf({ base: 'x', files: 6, loc: 200, dirs: ['core'] })
    expect(t).toBe('normal')
    expect(_internal.geometryOf(t)).toBe('single')
  })
  it('large (by files or LOC) → split', () => {
    expect(_internal.tierOf({ base: 'x', files: 40, loc: 50, dirs: [] })).toBe('large')
    expect(_internal.tierOf({ base: 'x', files: 3, loc: 900, dirs: [] })).toBe('large')
    expect(_internal.geometryOf('large')).toBe('split')
  })
})

describe('review-risk — integration (git)', () => {
  let dir: string
  const cmd = new ReviewRiskCommands()

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-reviewrisk-'))
    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
    await execFileAsync('git', ['config', 'user.email', 't@example.com'], { cwd: dir })
    await execFileAsync('git', ['config', 'user.name', 'T'], { cwd: dir })
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir })
    await fs.mkdir(path.join(dir, '.prjct'), { recursive: true })
    await fs.writeFile(
      path.join(dir, '.prjct/prjct.config.json'),
      JSON.stringify({ projectId: `rr-${Date.now()}` })
    )
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  it('graceful no-signal when nothing is ahead of the base', async () => {
    await fs.writeFile(path.join(dir, 'a.txt'), 'x')
    await execFileAsync('git', ['add', '.'], { cwd: dir })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
    const r = await cmd.reviewRisk(null, dir, { md: true })
    expect(r.success).toBe(true)
    expect(r.files).toBe(0)
    expect(r.tier).toBe('trivial')
    // Regression: the no-signal early-return must still carry `geometry`
    // (was omitted → undefined for structured-result consumers).
    expect(r.geometry).toBe('direct')
  })

  it('flags a large changeset on a feature branch and suggests split', async () => {
    await fs.writeFile(path.join(dir, 'seed.txt'), 'x')
    await execFileAsync('git', ['add', '.'], { cwd: dir })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
    await execFileAsync('git', ['checkout', '-q', '-b', 'feat/big'], { cwd: dir })
    for (let i = 0; i < 12; i++) {
      await fs.writeFile(path.join(dir, `f${i}.ts`), `export const v${i} = ${i}\n`.repeat(40))
    }
    await execFileAsync('git', ['add', '.'], { cwd: dir })
    await execFileAsync('git', ['commit', '-q', '-m', 'big'], { cwd: dir })
    const r = await cmd.reviewRisk(null, dir, { md: true })
    expect(r.success).toBe(true)
    expect(r.tier).toBe('large')
    expect(r.geometry).toBe('split')
  })
})
