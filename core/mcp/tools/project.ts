/**
 * MCP Project Tools.
 *
 * Outcome-backed tools (velocity, outcomes_search/similar/recent,
 * estimate_accuracy, velocity_detail) were removed alongside the
 * outcome-* subsystem — it had zero writers, so every one of them
 * returned "No outcome data yet" in practice. When a real outcome
 * feed lands (e.g. driven by the Stop hook capturing durations),
 * add the relevant tools back here.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { collectActiveTasks } from '../../services/task-overview'
import { setTaskStatus, startTask } from '../../services/task-service'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import { queueStorage } from '../../storage/queue-storage'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerProjectTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_task_status',
    'The active task (description, branch, when it started) plus the queued tasks. Read this to see what is in progress before starting new work.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_task_status', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const overview = await collectActiveTasks(projectId, args.projectPath)
      const queue = await queueStorage.getActiveTasks(projectId)

      const parts: string[] = []
      if (overview.all.length === 0) {
        parts.push('No active task.')
      } else if (overview.all.length === 1 && overview.current) {
        const v = overview.current
        parts.push(`## Active Task\n**${v.description}**`)
        parts.push(`Workspace: ${v.label}`)
        if (v.branch) parts.push(`Branch: ${v.branch}`)
        parts.push(`Started: ${v.startedAt}`)
      } else {
        parts.push(`## Active Tasks (${overview.all.length})`)
        for (const v of overview.all) {
          const here = v.isCurrent ? ' [this worktree]' : ''
          parts.push(`-${here} ${v.label}: ${v.description} — started ${v.startedAt}`)
        }
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
    'prjct_task_start',
    'Start a task. Fires the same before/after workflow gates and memory logging as `prjct task` — a gate may block the start. Pass linked_spec_id to wire the task to a spec for the ship gate. Use when the user begins concrete work.',
    {
      projectPath: z.string().describe('Project directory path'),
      description: z.string().describe('What the task is — a short imperative phrase'),
      linked_spec_id: z
        .string()
        .optional()
        .describe('Spec id to link for the SDD ship gate (e.g. "spec_12")'),
      skip_hooks: z
        .boolean()
        .optional()
        .describe('Skip before/after workflow rules. Default false.'),
    },
    safeMcpCall(
      'prjct_task_start',
      async (args: {
        projectPath: string
        description: string
        linked_spec_id?: string
        skip_hooks?: boolean
      }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const outcome = await startTask(projectId, args.projectPath, args.description, {
          spec: args.linked_spec_id,
          skipHooks: args.skip_hooks,
        })
        if (!outcome.ok) {
          return {
            content: [{ type: 'text', text: outcome.blocked ?? 'Task start was blocked.' }],
          }
        }
        const lines = [`✓ Task started: ${outcome.description}`, `Id: ${outcome.taskId}`]
        if (outcome.branch) lines.push(`Branch: ${outcome.branch}`)
        if (outcome.linearId) lines.push(`Linear: ${outcome.linearId}`)
        if (outcome.linkedSpecId) lines.push(`Linked spec: ${outcome.linkedSpecId}`)
        if (outcome.instructions && outcome.instructions.length > 0) {
          lines.push('', 'Agent instructions:')
          for (const i of outcome.instructions) lines.push(`- ${i}`)
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_task_set_status',
    'Change the active task\'s status (e.g. "done", "paused", "active"). Records the transition and drives the workflow state machine, exactly like `prjct status <value>`. "active"/"resume" promotes a paused task back to focus.',
    {
      projectPath: z.string().describe('Project directory path'),
      status: z
        .string()
        .describe('New status: done | completed | paused | active | resume | in_progress'),
    },
    safeMcpCall('prjct_task_set_status', async (args: { projectPath: string; status: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcome = await setTaskStatus(projectId, args.projectPath, args.status)
      if (!outcome.ok) {
        const text =
          outcome.reason === 'unsupported'
            ? outcome.message
            : 'No active task to update. Start one with prjct_task_start.'
        return { content: [{ type: 'text', text }] }
      }
      return {
        content: [{ type: 'text', text: `✓ status → ${outcome.status} (task ${outcome.taskId})` }],
      }
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

  // `prjct_patterns` was removed — it was a strict subset of `prjct_mem_list`
  // (recall with types=[decision, pattern, anti-pattern, gotcha]). One fewer
  // tool schema in the client's context every turn; callers pass the `types`
  // filter to `prjct_mem_list` for the same result.
}
