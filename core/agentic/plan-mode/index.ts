/**
 * Plan Mode System
 *
 * P3.4: Plan Mode + Approval Flow
 * Separates planning from execution for better user confidence.
 *
 * Pattern from: Devin AI, Windsurf, Kiro
 */

export type {
  PlanParams,
  GatheredInfo,
  ProposedPlan,
  PlanStep,
  Plan,
  ApprovalPrompt,
  ApprovalContext,
  ApprovalOperation,
} from './types'

export { PLAN_STATUS, PLAN_REQUIRED_COMMANDS, DESTRUCTIVE_COMMANDS, PLANNING_TOOLS } from './constants'
export { generateApprovalPrompt } from './approval'
export { PlanMode } from './plan-mode'

import { PlanMode } from './plan-mode'

// Export singleton
const planMode = new PlanMode()
export default planMode
