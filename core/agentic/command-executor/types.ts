/**
 * Command Executor Types
 */

import type loopDetector from '../loop-detector'

export interface ExecutionResult {
  success: boolean
  error?: string
  escalation?: ReturnType<typeof loopDetector.getEscalationInfo>
  isLoopDetected?: boolean
  suggestion?: string
  validation?: unknown
  isValidationError?: boolean
  template?: unknown
  context?: unknown
  state?: unknown
  prompt?: string
  agenticDelegation?: boolean
  agentsPath?: string
  agentRoutingPath?: string
  reasoning?: unknown
  thinkBlock?: unknown
  groundTruth?: unknown
  compressionMetrics?: unknown
  learnedPatterns?: unknown
  relevantMemories?: unknown
  formatResponse?: (data: unknown) => string
  formatThinkBlock?: (verbose: boolean) => string
  parallel?: {
    execute: (toolCalls: unknown[]) => Promise<unknown>
    readAll: (paths: string[]) => Promise<Map<string, string | null>>
    canParallelize: (tools: string[]) => boolean
    getMetrics: () => unknown
  }
  memory?: {
    create: (memory: unknown) => Promise<string>
    autoRemember: (type: string, value: string, ctx?: string) => Promise<void>
    search: (query: string) => Promise<unknown[]>
    findByTags: (tags: string[]) => Promise<unknown[]>
    getStats: () => Promise<unknown>
  }
  plan?: {
    active: unknown
    isPlanning: boolean
    isDestructive: boolean
    requiresApproval: boolean
    recordInfo: (info: unknown) => void
    setAnalysis: (analysis: unknown) => void
    propose: (plan: unknown) => unknown
    approve: (feedback?: string | null) => unknown
    reject: (reason?: string | null) => unknown
    getApprovalPrompt: () => unknown
    startExecution: () => unknown
    getNextStep: () => unknown
    completeStep: (result?: unknown) => unknown
    failStep: (error: string) => unknown
    abort: (reason?: string) => unknown
    getStatus: () => string
    getAllowedTools: () => string[]
  }
  attemptNumber?: number
  isLooping?: boolean
}

export interface SimpleExecutionResult {
  success: boolean
  result?: unknown
  error?: string
}

export type ExecutionToolsFn = (
  tools: {
    read: (path: string) => Promise<unknown>
    write: (path: string, content: string) => Promise<unknown>
    bash: (cmd: string) => Promise<unknown>
  },
  context: unknown
) => Promise<unknown>
