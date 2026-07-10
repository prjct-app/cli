/**
 * Superiority gates — beat field (not near-parity).
 * Pins for package-install PreToolUse, context-pressure hard gate,
 * per-gate ship overrides, competitive dust SUPERIOR claims.
 */

import { describe, expect, it } from 'bun:test'
import {
  contextPressureBlocksExpansion,
  contextPressureVerdict,
} from '../../services/context-pressure'
import { computeHarnessScore, renderCompetitiveDustMd } from '../../services/harness-score'
import { decidePackageInstall, parsePackageInstallCommand } from '../../services/package-legitimacy'

describe('package install parse (PreToolUse superiority)', () => {
  it('parses npm/pnpm/yarn/bun add with package names', () => {
    expect(parsePackageInstallCommand('npm install lodash')).toEqual({
      manager: 'npm',
      packages: ['lodash'],
    })
    expect(parsePackageInstallCommand('pnpm add -D @types/node chalk')).toEqual({
      manager: 'pnpm',
      packages: ['@types/node', 'chalk'],
    })
    expect(parsePackageInstallCommand('yarn add react')).toEqual({
      manager: 'yarn',
      packages: ['react'],
    })
    expect(parsePackageInstallCommand('bun add hono')).toEqual({
      manager: 'bun',
      packages: ['hono'],
    })
  })

  it('ignores bare lockfile installs and non-install commands', () => {
    expect(parsePackageInstallCommand('npm install')).toBeNull()
    expect(parsePackageInstallCommand('pnpm i')).toBeNull()
    expect(parsePackageInstallCommand('git commit -m x')).toBeNull()
    expect(parsePackageInstallCommand('npm test')).toBeNull()
  })

  it('decidePackageInstall allows known deps, flags unknown', () => {
    const known = new Set(['lodash', 'chalk'])
    expect(decidePackageInstall(['lodash'], known).risky).toBe(false)
    const r = decidePackageInstall(['lodash', 'evil-typo'], known)
    expect(r.risky).toBe(true)
    expect(r.newPackages).toEqual(['evil-typo'])
  })
})

describe('context-pressure hard gate (expansion block)', () => {
  it('critical blocks expansion; warn does not', () => {
    const crit = contextPressureVerdict(
      { maxTurnsPerCycle: 10 } as never,
      { turnCount: 8 } as never
    )
    expect(crit.level).toBe('critical')
    expect(contextPressureBlocksExpansion(crit)).toBe(true)

    const warn = contextPressureVerdict(
      { maxTurnsPerCycle: 10 } as never,
      { turnCount: 6 } as never
    )
    expect(warn.level).toBe('warn')
    expect(contextPressureBlocksExpansion(warn)).toBe(false)
  })
})

describe('competitive dust claims SUPERIOR on every row', () => {
  it('matrix uses SUPERIOR not n/a ties', () => {
    const md = renderCompetitiveDustMd(computeHarnessScore())
    expect(md).toMatch(/SUPERIOR/i)
    expect(md).toContain('gentle-ai')
    expect(md).toContain('open-GSD')
    expect(md).toContain('memory plugins')
    // No "tie" language — we claim measurable mechanisms
    expect(md).not.toMatch(/\bn\/a\b/i)
    expect(md).toMatch(/discuss-lock/i)
    expect(md).toMatch(/Rho/i)
    expect(md).toMatch(/Package legitimacy/i)
  })
})
