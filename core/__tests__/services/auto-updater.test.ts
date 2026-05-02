/**
 * Auto-updater unit tests.
 *
 * Covers:
 *   - semver compare correctness
 *   - install-source detection (binary vs npm vs unknown)
 *   - throttle constant
 *
 * Network fetches + actual upgrades are deliberately not exercised
 * here — those are integration territory and would slow the suite.
 */

import { describe, expect, test } from 'bun:test'
import { _internal } from '../../services/auto-updater'

const { compareSemver, detectInstallSource, THROTTLE_MS } = _internal

describe('auto-updater — compareSemver', () => {
  test('equal versions return 0', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
  })

  test('detects patch upgrade', () => {
    expect(compareSemver('2.4.22', '2.4.21')).toBe(1)
    expect(compareSemver('2.4.21', '2.4.22')).toBe(-1)
  })

  test('detects minor upgrade', () => {
    expect(compareSemver('2.5.0', '2.4.99')).toBe(1)
  })

  test('detects major upgrade', () => {
    expect(compareSemver('3.0.0', '2.99.99')).toBe(1)
  })

  test('handles missing parts as 0', () => {
    expect(compareSemver('1', '1.0.0')).toBe(0)
    expect(compareSemver('1.0', '1.0.0')).toBe(0)
  })
})

describe('auto-updater — THROTTLE_MS', () => {
  test('is exactly 1 hour', () => {
    expect(THROTTLE_MS).toBe(60 * 60 * 1000)
  })
})

describe('auto-updater — detectInstallSource', () => {
  test('returns one of the known sources', () => {
    const source = detectInstallSource()
    expect(['binary', 'npm', 'bun', 'unknown']).toContain(source)
  })
})
