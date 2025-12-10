/**
 * Loop Detection & User Escalation
 *
 * Detects when commands are failing repeatedly and escalates to user
 * instead of continuing in infinite loops.
 *
 * OPTIMIZATION (P2.4): Loop Detection
 * - Track attempt counts per command/error type
 * - Auto-escalate after 3 failed attempts
 * - Provide specific help based on error patterns
 *
 * ANTI-HALLUCINATION: Detects contradictory/impossible outputs
 * - Patterns that indicate Claude is hallucinating (saying file exists when it doesn't)
 * - Contradictory statements in same response
 * - Completing tasks that were never started
 *
 * Source: Augment Code pattern
 * "If you notice yourself going around in circles... ask the user for help"
 */

export type {
  ErrorEntry,
  AttemptRecord,
  ErrorPattern,
  EscalationInfo,
  AttemptResult,
  AttemptInfo,
  HallucinationPattern,
  HallucinationResult,
  OutputAnalysis,
} from './types'

export { HALLUCINATION_PATTERNS, detectHallucination, getHallucinationSuggestion } from './hallucination'
export { isSimilarError, analyzeErrorPattern, generateEscalationMessage, generateSuggestion } from './error-analysis'
export { LoopDetector } from './loop-detector'

import { LoopDetector } from './loop-detector'

// Singleton instance
const loopDetector = new LoopDetector()
export default loopDetector
