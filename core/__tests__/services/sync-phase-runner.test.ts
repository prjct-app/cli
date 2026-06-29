import { afterEach, describe, expect, test } from 'bun:test'
import {
  runSyncPhase,
  SyncPhaseTimeoutError,
  withPhaseTimeout,
} from '../../services/sync/phase-runner'

const originalTimeout = process.env.PRJCT_SYNC_PHASE_TIMEOUT_MS

afterEach(() => {
  if (originalTimeout === undefined) delete process.env.PRJCT_SYNC_PHASE_TIMEOUT_MS
  else process.env.PRJCT_SYNC_PHASE_TIMEOUT_MS = originalTimeout
})

describe('sync phase runner', () => {
  test('runSyncPhase returns the wrapped result', async () => {
    await expect(runSyncPhase('unit', async () => 42)).resolves.toBe(42)
  })

  test('runSyncPhase rethrows the wrapped error', async () => {
    await expect(
      runSyncPhase('unit', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
  })

  test('withPhaseTimeout rejects with phase name and clears quickly', async () => {
    process.env.PRJCT_SYNC_PHASE_TIMEOUT_MS = '5'

    await expect(withPhaseTimeout(new Promise(() => undefined), 'slow-phase')).rejects.toThrow(
      "sync phase 'slow-phase' timed out"
    )
    await expect(withPhaseTimeout(new Promise(() => undefined), 'slow-phase')).rejects.toThrow(
      'PRJCT_SYNC_PHASE_TIMEOUT_MS'
    )
  })

  test('withPhaseTimeout exposes typed timeout metadata', async () => {
    process.env.PRJCT_SYNC_PHASE_TIMEOUT_MS = '5'

    try {
      await withPhaseTimeout(new Promise(() => undefined), 'slow-phase')
      throw new Error('expected timeout')
    } catch (error) {
      expect(error).toBeInstanceOf(SyncPhaseTimeoutError)
      expect((error as SyncPhaseTimeoutError).phase).toBe('slow-phase')
      expect((error as SyncPhaseTimeoutError).timeoutMs).toBe(5)
    }
  })
})
