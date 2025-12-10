/**
 * Ground Truth Verification
 * Verifies actual state before critical operations
 *
 * OPTIMIZATION (P1.3): Anti-Hallucination Pattern
 * - Reads actual files before assuming state
 * - Compares expected vs actual state
 * - Provides specific warnings for mismatches
 * - Logs verification results for debugging
 *
 * Source: Devin, Cursor, Augment Code patterns
 */

import type { Context, VerificationResult } from './types'
import { verifiers } from './verifiers'
import { formatWarnings } from './utils'

export type { Context, VerificationResult, Verifier } from './types'
export { verifiers } from './verifiers'
export { formatDuration, escapeRegex, formatWarnings } from './utils'

/**
 * Verify ground truth before command execution
 */
async function verify(commandName: string, context: Context, state: unknown): Promise<VerificationResult> {
  const verifier = verifiers[commandName]

  if (!verifier) {
    // No specific verification needed
    return {
      verified: true,
      actual: {},
      warnings: [],
      recommendations: [],
    }
  }

  try {
    return await verifier(context, state)
  } catch (error) {
    return {
      verified: false,
      actual: {},
      warnings: [`Verification error: ${(error as Error).message}`],
      recommendations: ['Check file permissions and project configuration'],
    }
  }
}

/**
 * Prepare command by verifying ground truth
 * Returns enhanced context with verification results
 */
async function prepareCommand(commandName: string, context: Context, state: unknown) {
  const verification = await verify(commandName, context, state)

  return {
    ...context,
    groundTruth: {
      ...verification,
      verifiedAt: new Date().toISOString(),
      command: commandName,
    },
  }
}

/**
 * Check if command requires ground truth verification
 */
function requiresVerification(commandName: string): boolean {
  // ANTI-HALLUCINATION: Expanded verification for more commands
  return ['done', 'ship', 'feature', 'spec', 'now', 'init', 'sync', 'analyze'].includes(commandName)
}

export { verify, prepareCommand, requiresVerification }
export default { verify, prepareCommand, requiresVerification, formatWarnings, verifiers }
