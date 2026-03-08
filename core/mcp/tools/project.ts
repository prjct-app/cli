/**
 * MCP Project Tools (6 tools)
 *
 * Wraps existing storage modules for task status, velocity, analysis, patterns, and outcomes.
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

  s.tool(
    'prjct_outcomes_search',
    'Search completed task outcomes — what worked, what failed, duration, blockers',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Search query (matches task description, blockers, patterns)'),
      limit: z.number().optional().default(10).describe('Max results'),
    },
    async (args: { projectPath: string; query: string; limit: number }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcomes = await outcomeRecorder.getAll(projectId)

      if (outcomes.length === 0) {
        return { content: [{ type: 'text', text: 'No outcomes recorded yet.' }] }
      }

      const queryLower = args.query.toLowerCase()
      const keywords = queryLower.split(/\s+/)

      // Score each outcome by keyword overlap
      const scored = outcomes
        .map((o) => {
          const searchable =
            `${o.task} ${o.command} ${(o.blockers || []).join(' ')} ${o.patternDetected || ''} ${(o.tags || []).join(' ')}`.toLowerCase()
          const score = keywords.filter((kw) => searchable.includes(kw)).length
          return { outcome: o, score }
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, args.limit)

      if (scored.length === 0) {
        return { content: [{ type: 'text', text: `No outcomes matching "${args.query}".` }] }
      }

      const lines = scored.map(({ outcome: o }) => {
        const status = o.completedAsPlanned ? 'success' : 'issues'
        const parts = [`- **${o.task}** [${status}, ${o.actualDuration}]`]
        if (o.variance) parts.push(`  Variance: ${o.variance}`)
        if (o.blockers?.length) parts.push(`  Blockers: ${o.blockers.join(', ')}`)
        if (o.patternDetected) parts.push(`  Pattern: ${o.patternDetected}`)
        return parts.join('\n')
      })

      return {
        content: [
          {
            type: 'text',
            text: `## Outcomes matching "${args.query}" (${scored.length}/${outcomes.length})\n\n${lines.join('\n')}`,
          },
        ],
      }
    }
  )

  s.tool(
    'prjct_outcomes_similar',
    'Find similar past tasks and their outcomes: avg duration, success rate, common blockers',
    {
      projectPath: z.string().describe('Project directory path'),
      task: z.string().describe('Task description to find similar outcomes for'),
    },
    async (args: { projectPath: string; task: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcomes = await outcomeRecorder.getAll(projectId)

      if (outcomes.length === 0) {
        return { content: [{ type: 'text', text: 'No outcomes recorded yet.' }] }
      }

      const queryWords = new Set(
        args.task
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2)
      )

      // Score similarity by word overlap
      const similar = outcomes
        .map((o) => {
          const taskWords = new Set(
            o.task
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2)
          )
          const overlap = [...queryWords].filter((w) => taskWords.has(w)).length
          const similarity = queryWords.size > 0 ? overlap / queryWords.size : 0
          return { outcome: o, similarity }
        })
        .filter((s) => s.similarity >= 0.2)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10)

      if (similar.length === 0) {
        return { content: [{ type: 'text', text: 'No similar past tasks found.' }] }
      }

      // Aggregate stats
      const successCount = similar.filter((s) => s.outcome.completedAsPlanned).length
      const successRate = Math.round((successCount / similar.length) * 100)

      const durations = similar
        .map((s) => {
          const match = s.outcome.actualDuration.match(/(\d+)/)
          return match ? Number.parseInt(match[1]) : 0
        })
        .filter((d) => d > 0)
      const avgDuration =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0

      const allBlockers = similar.flatMap((s) => s.outcome.blockers || [])
      const blockerCounts: Record<string, number> = {}
      for (const b of allBlockers) {
        blockerCounts[b] = (blockerCounts[b] || 0) + 1
      }
      const topBlockers = Object.entries(blockerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)

      const parts = [
        `## Similar Tasks (${similar.length} matches)`,
        `\n**Success rate**: ${successRate}% (${successCount}/${similar.length})`,
      ]
      if (avgDuration > 0) parts.push(`**Avg duration**: ${avgDuration}m`)
      if (topBlockers.length > 0) {
        parts.push(`**Common blockers**: ${topBlockers.map(([b, c]) => `${b} (${c}x)`).join(', ')}`)
      }

      parts.push('\n### Past tasks')
      for (const { outcome: o, similarity } of similar) {
        const status = o.completedAsPlanned ? 'ok' : 'issues'
        parts.push(
          `- [${status}] **${o.task}** — ${o.actualDuration} (${Math.round(similarity * 100)}% similar)`
        )
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )
}
