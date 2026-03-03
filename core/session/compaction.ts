/**
 * Context Compaction
 *
 * Compresses conversation context while preserving semantics.
 * Useful for long sessions to prevent context overflow.
 *
 * Inspired by opencode's context management system.
 *
 * @version 1.0.0
 */

import prjctDb from '../storage/database'
import type { ContextHealthStatus } from '../types/agentic'
import type {
  CompactedContext,
  CompactionConfig,
  ConversationTurn,
  TruthSnapshot,
} from '../types/session'
import { getTimestamp } from '../utils/date-helper'

export type {
  CompactedContext,
  CompactionConfig,
  ConversationTurn,
  TruthSnapshot,
} from '../types/session'

const DEFAULT_CONFIG: Required<CompactionConfig> = {
  maxTurns: 50,
  maxTokens: 160000,
  preserveRecent: 10,
  summaryMaxLength: 2000,
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4)
}

/**
 * Extract key information from conversation
 */
function extractKeyInfo(turns: ConversationTurn[]): {
  decisions: string[]
  filesModified: string[]
  tasksCompleted: string[]
} {
  const decisions: string[] = []
  const filesModified = new Set<string>()
  const tasksCompleted: string[] = []

  for (const turn of turns) {
    const content = turn.content

    // Extract decisions (patterns like "decided to", "will use", "choosing")
    const decisionPatterns = [
      /decided to ([^.]+)/gi,
      /will use ([^.]+)/gi,
      /choosing ([^.]+)/gi,
      /going with ([^.]+)/gi,
    ]

    for (const pattern of decisionPatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        decisions.push(match[1].trim())
      }
    }

    // Extract file modifications
    const filePatterns = [
      /(?:created|modified|updated|edited|wrote to)\s+[`"]?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)[`"]?/gi,
      /File (?:created|updated).*?:\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/gi,
    ]

    for (const pattern of filePatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        filesModified.add(match[1])
      }
    }

    // Extract completed tasks
    const taskPatterns = [/✅\s*(.+)/g, /completed[:\s]+(.+)/gi, /finished[:\s]+(.+)/gi]

    for (const pattern of taskPatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        const task = match[1].trim()
        if (task.length < 100) {
          // Avoid capturing large blocks
          tasksCompleted.push(task)
        }
      }
    }
  }

  return {
    decisions: [...new Set(decisions)].slice(0, 10),
    filesModified: [...filesModified].slice(0, 20),
    tasksCompleted: [...new Set(tasksCompleted)].slice(0, 10),
  }
}

/**
 * Generate summary from conversation turns
 */
function generateSummary(turns: ConversationTurn[], maxLength: number): string {
  // Get key user requests
  const userRequests = turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.slice(0, 200))
    .slice(0, 5)

  // Get key assistant actions
  const assistantActions = turns
    .filter((t) => t.role === 'assistant')
    .map((t) => {
      // Extract first meaningful sentence
      const firstLine = t.content.split('\n')[0]
      return firstLine.slice(0, 150)
    })
    .filter((a) => a.length > 10)
    .slice(0, 5)

  const summary = [
    '## Session Summary',
    '',
    '### User Requests:',
    ...userRequests.map((r, i) => `${i + 1}. ${r.slice(0, 100)}...`),
    '',
    '### Key Actions:',
    ...assistantActions.map((a, i) => `${i + 1}. ${a}`),
  ].join('\n')

  return summary.slice(0, maxLength)
}

/**
 * Compact conversation context
 */
export function compactContext(
  turns: ConversationTurn[],
  config: CompactionConfig = {}
): CompactedContext {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const { decisions, filesModified, tasksCompleted } = extractKeyInfo(turns)
  const summary = generateSummary(turns, cfg.summaryMaxLength)

  return {
    summary,
    keyPoints: decisions.slice(0, 5),
    decisions,
    filesModified,
    tasksCompleted,
    originalTurns: turns.length,
    compactedAt: getTimestamp(),
  }
}

/**
 * Check if compaction is needed.
 * When healthStatus is provided, compaction triggers at the warning zone boundary (40%).
 */
export function needsCompaction(
  turns: ConversationTurn[],
  config: CompactionConfig = {},
  healthStatus?: ContextHealthStatus
): boolean {
  // Zone-aware: compact when outside smart zone
  if (healthStatus && healthStatus.zone !== 'smart') {
    return true
  }

  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Check turn count
  if (turns.length > cfg.maxTurns) {
    return true
  }

  // Check token count
  const totalTokens = turns.reduce((sum, t) => sum + estimateTokens(t.content), 0)
  if (totalTokens > cfg.maxTokens) {
    return true
  }

  return false
}

/**
 * Save compacted context to SQLite
 */
export function saveCompactedContext(projectId: string, context: CompactedContext): void {
  const existing = prjctDb.getDoc<CompactedContext[]>(projectId, 'compacted-contexts') ?? []
  existing.push(context)
  prjctDb.setDoc(projectId, 'compacted-contexts', existing)
}

/**
 * Load recent compacted contexts
 */
export function loadCompactedContexts(projectId: string, limit = 5): CompactedContext[] {
  const contexts = prjctDb.getDoc<CompactedContext[]>(projectId, 'compacted-contexts') ?? []
  return contexts.slice(-limit)
}

/**
 * Format compacted context for prompt injection
 */
export function formatCompactedForPrompt(context: CompactedContext): string {
  const lines = ['<compacted-context>', context.summary, '']

  if (context.filesModified.length > 0) {
    lines.push('### Files Modified:')
    lines.push(context.filesModified.map((f) => `- ${f}`).join('\n'))
    lines.push('')
  }

  if (context.tasksCompleted.length > 0) {
    lines.push('### Tasks Completed:')
    lines.push(context.tasksCompleted.map((t) => `- ${t}`).join('\n'))
    lines.push('')
  }

  if (context.decisions.length > 0) {
    lines.push('### Decisions Made:')
    lines.push(context.decisions.map((d) => `- ${d}`).join('\n'))
    lines.push('')
  }

  lines.push(`*Compacted from ${context.originalTurns} turns at ${context.compactedAt}*`)
  lines.push('</compacted-context>')

  return lines.join('\n')
}

// =============================================================================
// Truth Snapshots
// =============================================================================

/** File reference pattern: path.ts:42 or path.ts:10-20 */
const FILE_REF_PATTERN = /([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,6})(?::(\d+(?:-\d+)?))?/g

/** Test result patterns */
const TEST_PASS_PATTERN = /(?:✅|PASS)\s+(.+?)(?:\s*[-–]\s*(.+))?$/gm
const TEST_FAIL_PATTERN = /(?:❌|FAIL)\s+(.+?)(?:\s*[-–]\s*(.+))?$/gm
const TEST_SKIP_PATTERN = /(?:⏭️|SKIP)\s+(.+?)(?:\s*[-–]\s*(.+))?$/gm

/** Code flow pattern: A → B → C */
const CODE_FLOW_PATTERN = /([a-zA-Z0-9_./]+(?:\s*→\s*[a-zA-Z0-9_./]+)+)/g

/**
 * Extract file references from conversation turns.
 * Parses file.ts:42 patterns and file modification mentions.
 */
function extractFileReferences(
  turns: ConversationTurn[],
  filesModified: string[]
): TruthSnapshot['fileReferences'] {
  const refs = new Map<string, TruthSnapshot['fileReferences'][0]>()

  // Files from extractKeyInfo (modified)
  for (const f of filesModified) {
    refs.set(f, { path: f, role: 'modified' })
  }

  // Parse file:line references from content
  for (const turn of turns) {
    for (const match of turn.content.matchAll(FILE_REF_PATTERN)) {
      const filePath = match[1]
      const lineRange = match[2]

      // Skip very short or non-file-looking matches
      if (!filePath.includes('.') || filePath.length < 3) continue

      if (!refs.has(filePath)) {
        const isTest = filePath.includes('test') || filePath.includes('spec')
        refs.set(filePath, {
          path: filePath,
          lineRange,
          role: isTest ? 'test' : 'read',
        })
      } else if (lineRange && !refs.get(filePath)!.lineRange) {
        refs.get(filePath)!.lineRange = lineRange
      }
    }
  }

  return [...refs.values()].slice(0, 30)
}

/**
 * Extract code flows from conversation turns.
 * Parses → chains and import patterns.
 */
function extractCodeFlows(turns: ConversationTurn[]): TruthSnapshot['codeFlows'] {
  const flows: TruthSnapshot['codeFlows'] = []

  for (const turn of turns) {
    for (const match of turn.content.matchAll(CODE_FLOW_PATTERN)) {
      const chain = match[1]
      const files = chain.split(/\s*→\s*/).filter((f) => f.includes('.'))
      if (files.length >= 2) {
        flows.push({ description: chain.trim(), files })
      }
    }
  }

  return [...new Map(flows.map((f) => [f.description, f])).values()].slice(0, 10)
}

/**
 * Extract test results from conversation turns.
 */
function extractTestResults(turns: ConversationTurn[]): TruthSnapshot['testResults'] {
  const results: TruthSnapshot['testResults'] = []

  for (const turn of turns) {
    for (const match of turn.content.matchAll(TEST_PASS_PATTERN)) {
      results.push({ file: match[1].trim(), status: 'pass', summary: match[2]?.trim() || 'passed' })
    }
    for (const match of turn.content.matchAll(TEST_FAIL_PATTERN)) {
      results.push({ file: match[1].trim(), status: 'fail', summary: match[2]?.trim() || 'failed' })
    }
    for (const match of turn.content.matchAll(TEST_SKIP_PATTERN)) {
      results.push({
        file: match[1].trim(),
        status: 'skip',
        summary: match[2]?.trim() || 'skipped',
      })
    }
  }

  return results.slice(0, 20)
}

/**
 * Compact conversation to a truth snapshot.
 * Extends standard compaction with structured file references, code flows, and test results.
 */
export function compactToTruthSnapshot(
  turns: ConversationTurn[],
  config: CompactionConfig = {},
  gitState?: { branch: string; uncommittedFiles: string[]; taskDescription: string | null }
): TruthSnapshot {
  const base = compactContext(turns, config)

  const fileReferences = extractFileReferences(turns, base.filesModified)
  const codeFlows = extractCodeFlows(turns)
  const testResults = extractTestResults(turns)

  return {
    ...base,
    fileReferences,
    codeFlows,
    testResults,
    currentState: gitState ?? {
      branch: 'unknown',
      uncommittedFiles: [],
      taskDescription: null,
    },
    format: 'truth_snapshot',
    version: 1,
  }
}

/**
 * Format a truth snapshot for prompt injection.
 * Produces structured markdown with <truth-snapshot> tags.
 */
export function formatTruthSnapshotForPrompt(snapshot: TruthSnapshot): string {
  const lines = ['<truth-snapshot>']

  // Current state
  if (snapshot.currentState) {
    lines.push('### Current State')
    lines.push(`Branch: \`${snapshot.currentState.branch}\``)
    if (snapshot.currentState.taskDescription) {
      lines.push(`Task: ${snapshot.currentState.taskDescription}`)
    }
    if (snapshot.currentState.uncommittedFiles.length > 0) {
      lines.push(`Uncommitted: ${snapshot.currentState.uncommittedFiles.join(', ')}`)
    }
    lines.push('')
  }

  // Summary
  lines.push(snapshot.summary)
  lines.push('')

  // File references
  if (snapshot.fileReferences.length > 0) {
    lines.push('### Files')
    for (const ref of snapshot.fileReferences) {
      const line = ref.lineRange ? `:${ref.lineRange}` : ''
      lines.push(`- [${ref.role}] \`${ref.path}${line}\``)
    }
    lines.push('')
  }

  // Code flows
  if (snapshot.codeFlows.length > 0) {
    lines.push('### Code Flows')
    for (const flow of snapshot.codeFlows) {
      lines.push(`- ${flow.description}`)
    }
    lines.push('')
  }

  // Decisions
  if (snapshot.decisions.length > 0) {
    lines.push('### Decisions')
    for (const d of snapshot.decisions) {
      lines.push(`- ${d}`)
    }
    lines.push('')
  }

  // Test results
  if (snapshot.testResults.length > 0) {
    lines.push('### Test Results')
    for (const t of snapshot.testResults) {
      const icon = t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⏭️'
      lines.push(`- ${icon} ${t.file}: ${t.summary}`)
    }
    lines.push('')
  }

  lines.push(`*Truth snapshot from ${snapshot.originalTurns} turns at ${snapshot.compactedAt}*`)
  lines.push('</truth-snapshot>')

  return lines.join('\n')
}
