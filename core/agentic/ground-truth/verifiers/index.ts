/**
 * Ground Truth Verifiers Index
 * Re-exports all command verifiers
 */

import type { Verifier } from '../types'
import { verifyDone } from './done'
import { verifyShip } from './ship'
import { verifyFeature } from './feature'
import { verifyNow } from './now'
import { verifyInit } from './init'
import { verifySync } from './sync'
import { verifyAnalyze } from './analyze'
import { verifySpec } from './spec'

/**
 * Command-specific ground truth verifiers
 */
export const verifiers: Record<string, Verifier> = {
  done: verifyDone,
  ship: verifyShip,
  feature: verifyFeature,
  now: verifyNow,
  init: verifyInit,
  sync: verifySync,
  analyze: verifyAnalyze,
  spec: verifySpec,
}

export { verifyDone } from './done'
export { verifyShip } from './ship'
export { verifyFeature } from './feature'
export { verifyNow } from './now'
export { verifyInit } from './init'
export { verifySync } from './sync'
export { verifyAnalyze } from './analyze'
export { verifySpec } from './spec'
