/**
 * Owned agent runtime (print / one-shot).
 * Enable with `prjct llm enable` + brain profile, then `prjct agent "…"`.
 */

export { buildSystemPrompt, runAgent } from './loop'
export { PathDeniedError, resolveSafePath } from './paths'
export {
  fetchGuardHits,
  guardTool,
  prjctBodyTools,
  rememberTool,
  searchTool,
  workTool,
} from './prjct-tools'
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
export {
  type OwnedAgentWorkContext,
  prepareOwnedAgentWorkContext,
  weakModelAppend,
} from './work-context'
