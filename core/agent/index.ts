/**
 * Owned agent runtime (print / one-shot).
 * Enable with `prjct llm enable` + brain profile, then `prjct agent "…"`.
 */

export { buildSystemPrompt, runAgent } from './loop'
export { PathDeniedError, resolveSafePath } from './paths'
export {
  bashTool,
  defaultTools,
  editTool,
  getToolMap,
  readTool,
  writeTool,
} from './tools'
export type {
  AgentRunOptions,
  AgentRunResult,
  AgentStepEvent,
  AgentTool,
  AgentToolContext,
  AgentToolResult,
} from './types'
export { toolsToChatDefs } from './types'
