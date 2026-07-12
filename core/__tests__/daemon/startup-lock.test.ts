import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  decideListenFailure,
  releaseSpawnLock,
  spawnLockPath,
  tryAcquireSpawnLock,
} from '../../daemon/startup-lock'

describe('decideListenFailure', () => {
  test('lost race with healthy peer exits 0', () => {
    expect(
      decideListenFailure({
        errorCode: 'EADDRINUSE',
        errorMessage: 'listen EADDRINUSE',
        peerHealthy: true,
      })
    ).toEqual({ exitCode: 0, reason: 'lost-spawn-race-peer-healthy' })
  })

  test('listen fail without peer is fatal', () => {
    const d = decideListenFailure({
      errorCode: 'EADDRINUSE',
      errorMessage: 'Failed to listen at /tmp/daemon.sock',
      peerHealthy: false,
    })
    expect(d.exitCode).toBe(1)
    expect(d.reason).toBe('listen-failed-no-peer')
  })

  test('other errors are fatal', () => {
    expect(
      decideListenFailure({
        errorMessage: 'permission denied',
        peerHealthy: true,
      }).exitCode
    ).toBe(1)
  })
})

describe('tryAcquireSpawnLock', () => {
  let tmp: string

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })

  test('first acquirer wins; second yields while holder is live', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-spawn-lock-'))
    const a = tryAcquireSpawnLock(tmp, process.pid)
    expect(a).not.toBeNull()
    expect(fs.existsSync(spawnLockPath(tmp))).toBe(true)

    const b = tryAcquireSpawnLock(tmp, process.pid + 99999)
    expect(b).toBeNull()

    releaseSpawnLock(a)
    const c = tryAcquireSpawnLock(tmp, process.pid)
    expect(c).not.toBeNull()
    releaseSpawnLock(c)
  })

  test('stale lock from dead pid is reclaimed', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-spawn-lock-'))
    const lockPath = spawnLockPath(tmp)
    fs.mkdirSync(tmp, { recursive: true })
    // PID 1 on macOS is launchd and is always "running" — use an absurd pid.
    const deadPid = 2_147_483_646
    fs.writeFileSync(lockPath, `${deadPid}\n`)

    const handle = tryAcquireSpawnLock(tmp, process.pid)
    expect(handle).not.toBeNull()
    releaseSpawnLock(handle)
  })
})
