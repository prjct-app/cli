/**
 * MCP Project Tools (4 tools)
 *
 * Wraps existing storage modules for task status, velocity, analysis, and patterns.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import memorySystem from '../../agentic/memory-system'
import { calculateVelocity, formatVelocityContext } from '../../domain/velocity'
import { DEFAULT_VELOCITY_CONFIG } from '../../schemas/velocity'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import { queueStorage } from '../../storage/queue-storage'
import { stateStorage } from '../../storage/state-storage'
import outcomeRecorder from '../../workflows/outcome-recorder'
import { resolveProjectId } from '../resolve'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerProjectTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_task_status',
    'Current task, duration, subtasks, and queue',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const current = await stateStorage.getCurrentTask(projectId)
      const queue = await queueStorage.getActiveTasks(projectId)

      const parts: string[] = []
      if (current) {
        parts.push(`## Active Task\n**${current.description}**`)
        if (current.branch) parts.push(`Branch: ${current.branch}`)
        parts.push(`Started: ${current.startedAt}`)
      } else {
        parts.push('No active task.')
      }

      if (queue.length > 0) {
        parts.push(`\n## Queue (${queue.length} tasks)`)
        for (const t of queue.slice(0, 10)) {
          parts.push(`- ${t.description} [${t.priority || 'medium'}]`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )

  s.tool(
    'prjct_velocity',
    'Sprint velocity, estimation accuracy, and trend',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcomes = await outcomeRecorder.getAll(projectId)

      if (outcomes.length === 0) {
        return { content: [{ type: 'text', text: 'No outcome data yet.' }] }
      }

      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)
      if (metrics.sprints.length === 0) {
        return { content: [{ type: 'text', text: 'Not enough data for velocity.' }] }
      }

      const text = formatVelocityContext(metrics)
      return { content: [{ type: 'text', text }] }
    }
  )

  s.tool(
    'prjct_analysis',
    'LLM analysis: stack, patterns, anti-patterns, conventions',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const analysis = llmAnalysisStorage.getActive(projectId)

      if (!analysis) {
        return { content: [{ type: 'text', text: 'No analysis available. Run `prjct sync`.' }] }
      }

      const parts: string[] = ['## Project Analysis']

      if (analysis.stack) {
        parts.push('\n### Stack')
        if (analysis.stack.languages?.length)
          parts.push(`Languages: ${analysis.stack.languages.join(', ')}`)
        if (analysis.stack.frameworks?.length)
          parts.push(`Frameworks: ${analysis.stack.frameworks.join(', ')}`)
        if (analysis.stack.packageManager)
          parts.push(`Package Manager: ${analysis.stack.packageManager}`)
      }

      if (analysis.patterns?.length) {
        parts.push(`\n### Patterns (${analysis.patterns.length})`)
        for (const p of analysis.patterns) {
          parts.push(`- **${p.name}**: ${p.description}`)
        }
      }

      if (analysis.antiPatterns?.length) {
        parts.push(`\n### Anti-Patterns (${analysis.antiPatterns.length})`)
        for (const a of analysis.antiPatterns) {
          parts.push(`- **${a.issue}**: ${a.suggestion}`)
        }
      }

      if (analysis.conventions?.length) {
        parts.push(`\n### Conventions (${analysis.conventions.length})`)
        for (const c of analysis.conventions) {
          parts.push(`- [${c.category}] ${c.rule}`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )

  s.tool(
    'prjct_patterns',
    'Learned decisions: commit style, branch naming, preferences',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const summary = await memorySystem.getPatternsSummary(projectId)

      if (!summary) {
        return { content: [{ type: 'text', text: 'No patterns learned yet.' }] }
      }

      const parts: string[] = ['## Learned Patterns']

      if (summary.decisions && Object.keys(summary.decisions).length > 0) {
        parts.push('\n### Decisions')
        for (const [key, val] of Object.entries(summary.decisions)) {
          const d = val as { value: string; confidence: string; count: number }
          parts.push(`- **${key}**: ${d.value} (${d.confidence}, ${d.count}x)`)
        }
      }

      if (summary.preferences && Object.keys(summary.preferences).length > 0) {
        parts.push('\n### Preferences')
        for (const [key, val] of Object.entries(summary.preferences)) {
          const p = val as { value: unknown; confidence: string }
          parts.push(`- **${key}**: ${p.value} (${p.confidence})`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )
}
