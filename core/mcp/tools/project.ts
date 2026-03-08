/**
 * MCP Project Tools (9 tools)
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
import { safeMcpCall } from './error-handler'

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
    safeMcpCall('prjct_task_status', async (args: { projectPath: string }) => {
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
    })
  )

  s.tool(
    'prjct_velocity',
    'Sprint velocity, estimation accuracy, and trend',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_velocity', async (args: { projectPath: string }) => {
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
    })
  )

  s.tool(
    'prjct_analysis',
    'LLM analysis: stack, patterns, anti-patterns, conventions',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_analysis', async (args: { projectPath: string }) => {
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
    })
  )

  s.tool(
    'prjct_patterns',
    'Learned decisions, preferences, and workflows with confidence tracking',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_patterns', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const summary = await memorySystem.getPatternsSummaryDetailed(projectId)

      if (!summary) {
        return { content: [{ type: 'text', text: 'No patterns learned yet.' }] }
      }

      const parts: string[] = ['## Learned Patterns']

      if (Object.keys(summary.decisions).length > 0) {
        parts.push('\n### Decisions')
        for (const [key, d] of Object.entries(summary.decisions)) {
          parts.push(`- **${key}**: ${d.value} (${d.confidence}, ${d.count}x)`)
        }
      }

      if (Object.keys(summary.preferences).length > 0) {
        parts.push('\n### Preferences')
        for (const [key, p] of Object.entries(summary.preferences)) {
          parts.push(`- **${key}**: ${p.value} (${p.confidence})`)
        }
      }

      if (Object.keys(summary.workflows).length > 0) {
        parts.push('\n### Workflows')
        for (const [key, w] of Object.entries(summary.workflows)) {
          parts.push(`- **${key}**: ${w.confidence}, ${w.count}x`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_outcomes_search',
    'Search completed task outcomes — what worked, what failed, duration, blockers',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Search query (matches task description, blockers, patterns)'),
      limit: z.number().optional().default(10).describe('Max results'),
      offset: z.number().optional().default(0).describe('Offset for pagination (default 0)'),
    },
    safeMcpCall(
      'prjct_outcomes_search',
      async (args: { projectPath: string; query: string; limit: number; offset: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const outcomes = await outcomeRecorder.getAll(projectId)

        if (outcomes.length === 0) {
          return { content: [{ type: 'text', text: 'No outcomes recorded yet.' }] }
        }

        const queryLower = args.query.toLowerCase()
        const keywords = queryLower.split(/\s+/)

        const scored = outcomes
          .map((o) => {
            const searchable =
              `${o.task} ${o.command} ${(o.blockers || []).join(' ')} ${o.patternDetected || ''} ${(o.tags || []).join(' ')}`.toLowerCase()
            const score = keywords.filter((kw) => searchable.includes(kw)).length
            return { outcome: o, score }
          })
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(args.offset, args.offset + args.limit)

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
  )

  s.tool(
    'prjct_outcomes_similar',
    'Find similar past tasks and their outcomes: avg duration, success rate, common blockers',
    {
      projectPath: z.string().describe('Project directory path'),
      task: z.string().describe('Task description to find similar outcomes for'),
    },
    safeMcpCall('prjct_outcomes_similar', async (args: { projectPath: string; task: string }) => {
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

      const successCount = similar.filter((s) => s.outcome.completedAsPlanned).length
      const successRate = Math.round((successCount / similar.length) * 100)

      const durations = similar
        .map((s) => {
          const match = s.outcome.actualDuration.match(/(\d+)/)
          return match ? Number.parseInt(match[1], 10) : 0
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
    })
  )

  // =========================================================================
  // Sprint 16: outcomes_recent + estimate_accuracy + velocity_detail
  // =========================================================================

  s.tool(
    'prjct_outcomes_recent',
    'Last N outcomes with optional command/agent filter',
    {
      projectPath: z.string().describe('Project directory path'),
      count: z.number().optional().default(10).describe('Number of recent outcomes (default 10)'),
      command: z.string().optional().describe('Filter by command (e.g. "done", "ship")'),
      agent: z.string().optional().describe('Filter by agent used'),
    },
    safeMcpCall(
      'prjct_outcomes_recent',
      async (args: { projectPath: string; count: number; command?: string; agent?: string }) => {
        const projectId = await resolveProjectId(args.projectPath)

        let outcomes: Awaited<ReturnType<typeof outcomeRecorder.getAll>>
        if (args.command) {
          outcomes = await outcomeRecorder.getByCommand(projectId, args.command)
          outcomes = outcomes.slice(-args.count)
        } else if (args.agent) {
          outcomes = await outcomeRecorder.getByAgent(projectId, args.agent)
          outcomes = outcomes.slice(-args.count)
        } else {
          outcomes = await outcomeRecorder.getRecent(projectId, args.count)
        }

        if (outcomes.length === 0) {
          return { content: [{ type: 'text', text: 'No outcomes found.' }] }
        }

        const parts = [`## Recent Outcomes (${outcomes.length})`]
        const filterInfo = args.command
          ? ` [command: ${args.command}]`
          : args.agent
            ? ` [agent: ${args.agent}]`
            : ''
        if (filterInfo) parts[0] += filterInfo

        parts.push('')

        for (const o of outcomes) {
          const status = o.completedAsPlanned ? 'ok' : 'issues'
          const line = [`- [${status}] **${o.task}** — ${o.actualDuration}`]
          if (o.command) line.push(`  Command: ${o.command}`)
          if (o.variance) line.push(`  Variance: ${o.variance}`)
          if (o.blockers?.length) line.push(`  Blockers: ${o.blockers.join(', ')}`)
          parts.push(line.join('\n'))
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_estimate_accuracy',
    'Overall estimation accuracy % + per-category over/under patterns',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_estimate_accuracy', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcomes = await outcomeRecorder.getAll(projectId)

      if (outcomes.length === 0) {
        return { content: [{ type: 'text', text: 'No outcome data yet.' }] }
      }

      const accuracy = await outcomeRecorder.getEstimateAccuracy(projectId)
      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)

      const parts = [
        '## Estimation Accuracy',
        `Overall: ${accuracy}%`,
        `Total outcomes: ${outcomes.length}`,
      ]

      if (metrics.overEstimated.length > 0) {
        parts.push('\n### Over-Estimated (finish faster than expected)')
        for (const p of metrics.overEstimated) {
          parts.push(`- **${p.category}**: ${p.avgVariance}% faster (${p.taskCount} tasks)`)
        }
      }

      if (metrics.underEstimated.length > 0) {
        parts.push('\n### Under-Estimated (take longer than expected)')
        for (const p of metrics.underEstimated) {
          parts.push(`- **${p.category}**: ${p.avgVariance}% longer (${p.taskCount} tasks)`)
        }
      }

      if (metrics.overEstimated.length === 0 && metrics.underEstimated.length === 0) {
        parts.push('\nNo significant estimation patterns detected.')
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_velocity_detail',
    'Sprint-by-sprint breakdown + completion projection',
    {
      projectPath: z.string().describe('Project directory path'),
      remainingPoints: z
        .number()
        .optional()
        .describe('Remaining story points for completion projection'),
    },
    safeMcpCall(
      'prjct_velocity_detail',
      async (args: { projectPath: string; remainingPoints?: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const outcomes = await outcomeRecorder.getAll(projectId)

        if (outcomes.length === 0) {
          return { content: [{ type: 'text', text: 'No outcome data yet.' }] }
        }

        const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)

        if (metrics.sprints.length === 0) {
          return { content: [{ type: 'text', text: 'Not enough data for velocity.' }] }
        }

        const parts = [
          '## Velocity Detail',
          `Average: ${metrics.averageVelocity} pts/sprint`,
          `Trend: ${metrics.velocityTrend}`,
          `Estimation accuracy: ${metrics.estimationAccuracy}%`,
          `\n### Sprints (${metrics.sprints.length})`,
        ]

        for (const s of metrics.sprints) {
          parts.push(
            `- Sprint ${s.sprintNumber}: ${s.pointsCompleted} pts, ${s.tasksCompleted} tasks, accuracy ${s.estimationAccuracy}%${s.avgVariance ? `, variance ${s.avgVariance > 0 ? '+' : ''}${s.avgVariance}%` : ''}`
          )
        }

        if (args.remainingPoints && metrics.averageVelocity > 0) {
          const { projectCompletion: projectCompletionFn } = await import('../../domain/velocity')
          const projection = projectCompletionFn(
            args.remainingPoints,
            metrics.averageVelocity,
            DEFAULT_VELOCITY_CONFIG
          )

          parts.push('\n### Completion Projection')
          parts.push(`Remaining: ${projection.totalPoints} points`)
          parts.push(`Sprints needed: ${projection.sprints}`)
          if (projection.estimatedDate) {
            parts.push(`Estimated completion: ${projection.estimatedDate.slice(0, 10)}`)
          }
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )
}
