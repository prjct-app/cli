/**
 * decideRestart contract — the daemon's "should I restart BEFORE serving?"
 * decision. This is the fix for the recurring stale-daemon trap: the daemon
 * used to detect a new build AFTER serving, so the triggering request was
 * answered by the outdated code. These tests pin the ordering and the
 * time-throttled drift probe so that regression can't creep back.
 */

import { describe, expect, test } from 'bun:test'
import { decideRestart } from '../../daemon/staleness'

const NEVER = () => false
const ALWAYS = () => true

describe('decideRestart', () => {
  test('a rebuilt entry file (codeStale) restarts immediately, no drift probe', () => {
    let probed = false
    const d = decideRestart({
      codeStale: true,
      command: 'status',
      ownVersion: '1.0.0',
      now: 10_000,
      lastDriftCheckMs: 0,
      driftMinIntervalMs: 1000,
      checkDrift: () => {
        probed = true
        return false
      },
    })
    expect(d.restart).toBe(true)
    expect(probed).toBe(false) // mtime wins; never pays for the drift probe
  })

  test('global-install drift restarts and advances the throttle timestamp', () => {
    const d = decideRestart({
      codeStale: false,
      command: 'status',
      ownVersion: '1.0.0',
      now: 5000,
      lastDriftCheckMs: 0,
      driftMinIntervalMs: 1000,
      checkDrift: ALWAYS,
    })
    expect(d.restart).toBe(true)
    expect(d.lastDriftCheckMs).toBe(5000)
  })

  test('no staleness → no restart, throttle timestamp still advances after a probe', () => {
    const d = decideRestart({
      codeStale: false,
      command: 'status',
      ownVersion: '1.0.0',
      now: 5000,
      lastDriftCheckMs: 0,
      driftMinIntervalMs: 1000,
      checkDrift: NEVER,
    })
    expect(d.restart).toBe(false)
    expect(d.lastDriftCheckMs).toBe(5000) // a probe ran, so the clock advances
  })

  test('drift probe is throttled — skipped when within the min interval', () => {
    let probes = 0
    const d = decideRestart({
      codeStale: false,
      command: 'status',
      ownVersion: '1.0.0',
      now: 1500, // only 500ms since last check
      lastDriftCheckMs: 1000,
      driftMinIntervalMs: 1000,
      checkDrift: () => {
        probes++
        return true
      },
    })
    expect(probes).toBe(0) // throttled — no probe, no restart
    expect(d.restart).toBe(false)
    expect(d.lastDriftCheckMs).toBe(1000) // unchanged
  })

  test('drift probe fires once the min interval has elapsed', () => {
    let probes = 0
    const d = decideRestart({
      codeStale: false,
      command: 'status',
      ownVersion: '1.0.0',
      now: 2000, // exactly 1000ms since last check
      lastDriftCheckMs: 1000,
      driftMinIntervalMs: 1000,
      checkDrift: () => {
        probes++
        return false
      },
    })
    expect(probes).toBe(1)
    expect(d.lastDriftCheckMs).toBe(2000)
  })

  test('health pings (__ping) never trigger the drift probe', () => {
    let probed = false
    const d = decideRestart({
      codeStale: false,
      command: '__ping',
      ownVersion: '1.0.0',
      now: 999_999,
      lastDriftCheckMs: 0,
      driftMinIntervalMs: 1000,
      checkDrift: () => {
        probed = true
        return true
      },
    })
    expect(probed).toBe(false)
    expect(d.restart).toBe(false)
  })

  test('no ownVersion → drift probe is skipped (nothing to compare)', () => {
    let probed = false
    const d = decideRestart({
      codeStale: false,
      command: 'status',
      ownVersion: null,
      now: 999_999,
      lastDriftCheckMs: 0,
      driftMinIntervalMs: 1000,
      checkDrift: () => {
        probed = true
        return true
      },
    })
    expect(probed).toBe(false)
    expect(d.restart).toBe(false)
  })
})
