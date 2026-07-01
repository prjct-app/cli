/**
 * Pattern Detector — hot file detection tests.
 *
 * Covers the ignore-pattern filter and detect-on-empty behavior. The
 * full detectHotFiles() flow needs a real git repo and is integration
 * tested via Stop hook in production sessions.
 */

import { describe, expect, test } from 'bun:test'
import { _internal } from '../../services/pattern-detector'

const { isIgnored, IGNORE_PATTERNS, HOT_THRESHOLD, WINDOW_DAYS } = _internal

describe('pattern-detector — isIgnored', () => {
  test('ignores lock files', () => {
    expect(isIgnored('package.json')).toBe(true)
    expect(isIgnored('package-lock.json')).toBe(true)
    expect(isIgnored('bun.lock')).toBe(true)
    expect(isIgnored('bun.lockb')).toBe(true)
    expect(isIgnored('pnpm-lock.yaml')).toBe(true)
    expect(isIgnored('yarn.lock')).toBe(true)
  })

  test('ignores changelog and gitignore', () => {
    expect(isIgnored('CHANGELOG.md')).toBe(true)
    expect(isIgnored('.gitignore')).toBe(true)
  })

  test('ignores snapshot tests', () => {
    expect(isIgnored('__tests__/foo.test.ts.snap')).toBe(true)
  })

  test('ignores generated dirs', () => {
    expect(isIgnored('dist/index.js')).toBe(true)
    expect(isIgnored('node_modules/react/index.js')).toBe(true)
  })

  test('does not ignore source files', () => {
    expect(isIgnored('src/index.ts')).toBe(false)
    expect(isIgnored('core/services/sync-service.ts')).toBe(false)
    expect(isIgnored('README.md')).toBe(false)
  })

  test('matches against basename, not just path', () => {
    expect(isIgnored('subdir/package.json')).toBe(true)
    expect(isIgnored('vendor/foo/bun.lockb')).toBe(true)
  })
})

describe('pattern-detector — constants', () => {
  test('HOT_THRESHOLD is conservative', () => {
    // 3+ touches over a week is the documented contract. Lowering this
    // would flood memory with churn from any active repo.
    expect(HOT_THRESHOLD).toBe(3)
  })

  test('WINDOW_DAYS is 7', () => {
    expect(WINDOW_DAYS).toBe(7)
  })

  test('ignore patterns cover common noise', () => {
    expect(IGNORE_PATTERNS.length).toBeGreaterThan(5)
  })

  test('recurring-bug detection uses 30 day window + 2+ threshold', () => {
    expect(_internal.RECURRING_WINDOW_DAYS).toBe(30)
    expect(_internal.RECURRING_THRESHOLD).toBe(2)
  })

  test('tech-debt growth threshold is 5 (avoids noise from 1-2 churn)', () => {
    expect(_internal.TECH_DEBT_GROWTH_THRESHOLD).toBe(5)
  })
})

describe('pattern-detector — measureTechDebt', () => {
  test('returns a non-negative count for this repo', async () => {
    // Integration smoke test: this repo has at least some TODO/FIXME
    // markers. Just verify the function returns a finite, non-negative
    // number rather than asserting an exact count.
    const snap = await _internal.measureTechDebt(process.cwd())
    expect(snap.totalCount).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(snap.totalCount)).toBe(true)
  })
})
