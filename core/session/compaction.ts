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

import fs from 'fs/promises'
import path from 'path'
import { getTimestamp } from '../utils/date-helper'
import pathManager from '../infrastructure/path-manager'
import type { ConversationTurn, CompactedContext, CompactionConfig } from '../types'

export type { ConversationTurn, CompactedContext, CompactionConfig } from '../types'

const DEFAULT_CONFIG: Required<CompactionConfig> = {
  maxTurns: 50,
  maxTokens: 100000,
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
    const taskPatterns = [
      /✅\s*(.+)/g,
      /completed[:\s]+(.+)/gi,
      /finished[:\s]+(.+)/gi,
    ]

    for (const pattern of taskPatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        const task = match[1].trim()
        if (task.length < 100) { // Avoid capturing large blocks
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
    .filter(t => t.role === 'user')
    .map(t => t.content.slice(0, 200))
    .slice(0, 5)

  // Get key assistant actions
  const assistantActions = turns
    .filter(t => t.role === 'assistant')
    .map(t => {
      // Extract first meaningful sentence
      const firstLine = t.content.split('\n')[0]
      return firstLine.slice(0, 150)
    })
    .filter(a => a.length > 10)
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
 * Check if compaction is needed
 */
export function needsCompaction(
  turns: ConversationTurn[],
  config: CompactionConfig = {}
): boolean {
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
 * Save compacted context to file
 */
export async function saveCompactedContext(
  projectId: string,
  context: CompactedContext
): Promise<string> {
  const dirPath = path.join(pathManager.getGlobalProjectPath(projectId), 'memory')
  const filePath = path.join(dirPath, 'compacted.jsonl')

  await fs.mkdir(dirPath, { recursive: true })

  const line = JSON.stringify(context) + '\n'
  await fs.appendFile(filePath, line, 'utf-8')

  return filePath
}

/**
 * Load recent compacted contexts
 */
export async function loadCompactedContexts(
  projectId: string,
  limit = 5
): Promise<CompactedContext[]> {
  const filePath = path.join(
    pathManager.getGlobalProjectPath(projectId), 'memory', 'compacted.jsonl'
  )

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const contexts = lines.map(line => JSON.parse(line) as CompactedContext)

    // Return most recent
    return contexts.slice(-limit)
  } catch {
    return []
  }
}

/**
 * Format compacted context for prompt injection
 */
export function formatCompactedForPrompt(context: CompactedContext): string {
  const lines = [
    '<compacted-context>',
    context.summary,
    '',
  ]

  if (context.filesModified.length > 0) {
    lines.push('### Files Modified:')
    lines.push(context.filesModified.map(f => `- ${f}`).join('\n'))
    lines.push('')
  }

  if (context.tasksCompleted.length > 0) {
    lines.push('### Tasks Completed:')
    lines.push(context.tasksCompleted.map(t => `- ${t}`).join('\n'))
    lines.push('')
  }

  if (context.decisions.length > 0) {
    lines.push('### Decisions Made:')
    lines.push(context.decisions.map(d => `- ${d}`).join('\n'))
    lines.push('')
  }

  lines.push(`*Compacted from ${context.originalTurns} turns at ${context.compactedAt}*`)
  lines.push('</compacted-context>')

  return lines.join('\n')
}
