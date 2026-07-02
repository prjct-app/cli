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
import { formatLikelyFileForAgent } from '../../services/file-cue'
import { collectActiveTasks } from '../../services/task-overview'
import { formatRelatedContextForAgent, setTaskStatus, startTask } from '../../services/task-service'
import { recordTaskTokenUsage } from '../../services/work-cost-service'
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
    'The active AI Agile work cycle (description, branch, when it started) plus queued work. Read this to see what is in progress before starting new work.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_task_status', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const overview = await collectActiveTasks(projectId, args.projectPath)
      const queue = await queueStorage.getActiveTasks(projectId)

      const parts: string[] = []
      if (overview.all.length === 0) {
        parts.push('No active work cycle.')
      } else if (overview.all.length === 1 && overview.current) {
        const v = overview.current
        parts.push(`## Active Work Cycle\n**${v.description}**`)
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
        parts.push(`\n## Queue (${queue.length} work items)`)
        for (const t of queue.slice(0, 10)) {
          parts.push(`- ${t.description} [${t.priority || 'medium'}]`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_task_start',
    'Start an AI Agile work cycle. Fires before/after workflow gates and memory logging through the compatibility task backend; a gate may block the start. Pass linked_spec_id only when a durable intent/spec brief is required. Use when the user begins concrete work.',
    {
      projectPath: z.string().describe('Project directory path'),
      description: z.string().describe('What the work cycle is — a short intent phrase'),
      linked_spec_id: z
        .string()
        .optional()
        .describe('Intent/spec id to link for high-stakes work (e.g. "spec_12")'),
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
          return { content: [{ type: 'text', text: outcome.blocked ?? 'Work start was blocked.' }] }
        }
        const lines = [`✓ Work cycle started: ${outcome.description}`, `Id: ${outcome.taskId}`]
        if (outcome.branch) lines.push(`Branch: ${outcome.branch}`)
        if (outcome.linearId) lines.push(`Linear: ${outcome.linearId}`)
        if (outcome.linkedSpecId) lines.push(`Linked spec: ${outcome.linkedSpecId}`)
        if (outcome.harness) {
          lines.push(
            `Harness: ${outcome.harness.level} ${outcome.harness.kind}/${outcome.harness.risk}`
          )
          if (outcome.harness.expectedEvidence.length > 0) {
            lines.push(`Evidence: ${outcome.harness.expectedEvidence.join(', ')}`)
          }
        }
        if (outcome.instructions && outcome.instructions.length > 0) {
          lines.push('', 'Agent instructions:')
          for (const i of outcome.instructions) lines.push(`- ${i}`)
        }
        if (outcome.relatedContext && outcome.relatedContext.length > 0) {
          lines.push('', 'Related second-brain context (pull full bodies with prjct_search):')
          for (const hit of outcome.relatedContext.slice(0, 4)) {
            lines.push(`- ${formatRelatedContextForAgent(hit)}`)
          }
        }
        if (outcome.likelyFiles && outcome.likelyFiles.length > 0) {
          lines.push(
            '',
            'Likely files from prjct index — read these first, do not grep-walk the repo:'
          )
          for (const file of outcome.likelyFiles) {
            lines.push(`- ${formatLikelyFileForAgent(file)}`)
          }
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_task_set_status',
    'Change the active work cycle status. Records the transition and drives the workflow state machine. "active"/"resume" promotes paused work back to focus. To report token usage use the dedicated prjct_cost_add tool — this verb only transitions state.',
    {
      projectPath: z.string().describe('Project directory path'),
      status: z
        .enum(['done', 'completed', 'paused', 'active', 'resume', 'in_progress'])
        .describe('New status'),
    },
    safeMcpCall('prjct_task_set_status', async (args: { projectPath: string; status: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const outcome = await setTaskStatus(projectId, args.projectPath, args.status)
      if (!outcome.ok) {
        const text =
          outcome.reason === 'unsupported'
            ? outcome.message
            : 'No active work cycle to update. Start one with prjct_task_start.'
        return { content: [{ type: 'text', text }] }
      }
      const warnings = outcome.verificationWarnings ?? []
      const text = [`✓ status → ${outcome.status} (task ${outcome.taskId})`]
      if (warnings.length > 0) {
        text.push('', 'Harness warnings:')
        for (const warning of warnings) text.push(`- ${warning}`)
      }
      if (outcome.contextPrompt) text.push('', outcome.contextPrompt)
      return {
        content: [{ type: 'text', text: text.join('\n') }],
      }
    })
  )

  s.tool(
    'prjct_cost_add',
    "Report a work cycle's token usage so prjct can measure cost/ROI. A narrow, typed verb — any agent (Claude, Codex, Gemini, …) passes its own counts. Pass model/runtime when known; mark isEstimated=true if the counts are not exact provider usage.",
    {
      projectPath: z.string().describe('Project directory path'),
      tokensIn: z.number().describe('Total input tokens this cycle consumed'),
      tokensOut: z.number().describe('Total output tokens this cycle produced'),
      model: z
        .string()
        .optional()
        .describe('Model id when the runtime exposes it (e.g. claude-opus-4-8)'),
      runtime: z.string().optional().describe('Runtime/host: claude | codex | gemini | …'),
      isEstimated: z
        .boolean()
        .optional()
        .describe('True when the counts are an estimate, not exact provider usage. Default false.'),
      workCycleId: z
        .string()
        .optional()
        .describe('Work cycle/task id; defaults to the active cycle when omitted'),
    },
    safeMcpCall(
      'prjct_cost_add',
      async (args: {
        projectPath: string
        tokensIn: number
        tokensOut: number
        model?: string
        runtime?: string
        isEstimated?: boolean
        workCycleId?: string
      }) => {
        const projectId = await resolveProjectId(args.projectPath)
        let taskId = args.workCycleId
        if (!taskId) {
          const { resolveActiveTask } = await import('../../services/task-service')
          const active = await resolveActiveTask(projectId, args.projectPath)
          taskId = active?.id
        }
        if (!taskId) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work cycle to attribute cost to (pass workCycleId or start a cycle).',
              },
            ],
          }
        }
        recordTaskTokenUsage(projectId, taskId, args.tokensIn, args.tokensOut, {
          model: args.model,
          runtime: args.runtime,
          isEstimated: args.isEstimated ?? false,
          source: 'mcp',
        })
        return {
          content: [
            {
              type: 'text',
              text: `Recorded ${args.tokensIn} in / ${args.tokensOut} out${args.model ? ` (${args.model})` : ''} for ${taskId}.`,
            },
          ],
        }
      }
    )
  )

  s.tool(
    'prjct_analysis',
    'The stored project analysis: architecture, stack, patterns, anti-patterns, conventions, tech-debt, and insights. Read this instead of re-deriving the architecture from source. Pass mode:"archive" for the history of superseded analyses.',
    {
      projectPath: z.string().describe('Project directory path'),
      mode: z
        .enum(['active', 'archive'])
        .optional()
        .describe('"active" (default) = current analysis; "archive" = superseded history'),
    },
    safeMcpCall(
      'prjct_analysis',
      async (args: { projectPath: string; mode?: 'active' | 'archive' }) => {
        const projectId = await resolveProjectId(args.projectPath)

        if (args.mode === 'archive') {
          const superseded = llmAnalysisStorage
            .getAllFull(projectId)
            .filter((a) => a.status === 'superseded')
          if (!superseded.length) {
            return { content: [{ type: 'text', text: 'No superseded analyses in the archive.' }] }
          }
          const lines = ['## Analysis Archive (superseded)']
          for (const a of superseded) {
            const commit = a.commitHash ? a.commitHash.slice(0, 8) : 'unknown'
            lines.push(
              `\n### ${a.analyzedAt} (commit ${commit})`,
              `Style: ${a.analysis.architecture?.style ?? 'unknown'} · patterns ${a.analysis.patterns?.length ?? 0} · anti-patterns ${a.analysis.antiPatterns?.length ?? 0} · tech-debt ${a.analysis.techDebt?.length ?? 0}`
            )
          }
          return { content: [{ type: 'text', text: lines.join('\n') }] }
        }

        // C3: read the synthesis as RELATIONAL records (no blob parse) when
        // available; fall back to the blob only for pre-C3 analyses.
        const rel = llmAnalysisStorage.getActiveRelational(projectId)
        if (rel) {
          const out: string[] = ['## Project Analysis']
          if (rel.domains.length) out.push(`\n### Architecture\nDomains: ${rel.domains.join(', ')}`)
          const langs = rel.stack.filter((s) => s.kind === 'language').map((s) => s.name)
          const fws = rel.stack.filter((s) => s.kind === 'framework').map((s) => s.name)
          if (langs.length || fws.length) {
            out.push('\n### Stack')
            if (langs.length) out.push(`Languages: ${langs.join(', ')}`)
            if (fws.length) out.push(`Frameworks: ${fws.join(', ')}`)
          }
          const byKind = (k: string) => rel.findings.filter((f) => f.kind === k)
          const section = (label: string, kind: string) => {
            const items = byKind(kind)
            if (!items.length) return
            out.push(`\n### ${label} (${items.length})`)
            for (const f of items) out.push(`- **${f.title}**${f.detail ? `: ${f.detail}` : ''}`)
          }
          section('Patterns', 'pattern')
          section('Anti-Patterns', 'anti_pattern')
          section('Tech Debt', 'tech_debt')
          section('Risk Areas', 'risk_area')
          section('Insights', 'insight')
          if (rel.conventions.length) {
            out.push(`\n### Conventions (${rel.conventions.length})`)
            for (const c of rel.conventions) out.push(`- ${c}`)
          }
          if (rel.commands.length) {
            out.push(`\n### Commands (${rel.commands.length})`)
            for (const c of rel.commands) out.push(`- **${c.name}**: \`${c.command}\``)
          }
          return { content: [{ type: 'text', text: out.join('\n') }] }
        }

        const analysis = llmAnalysisStorage.getActive(projectId)
        if (!analysis) {
          return { content: [{ type: 'text', text: 'No analysis available. Run `prjct sync`.' }] }
        }

        const parts: string[] = ['## Project Analysis']

        if (analysis.architecture?.style) {
          parts.push('\n### Architecture')
          parts.push(`Style: ${analysis.architecture.style}`)
          if (analysis.architecture.domains?.length)
            parts.push(`Domains: ${analysis.architecture.domains.join(', ')}`)
          for (const i of analysis.architecture.insights ?? []) parts.push(`- ${i}`)
        }

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

        if (analysis.techDebt?.length) {
          parts.push(`\n### Tech Debt (${analysis.techDebt.length})`)
          for (const d of analysis.techDebt) {
            parts.push(`- [${d.priority}/${d.effort}] ${d.description} (${d.area})`)
          }
        }

        const insights = analysis.projectInsights ?? []
        if (insights.length) {
          parts.push(`\n### Insights (${insights.length})`)
          for (const i of insights) parts.push(`- ${i}`)
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  // `prjct_patterns` was removed — it was a strict subset of `prjct_mem_list`
  // (recall with types=[decision, pattern, anti-pattern, gotcha]). One fewer
  // tool schema in the client's context every turn; callers pass the `types`
  // filter to `prjct_mem_list` for the same result.

  // `prjct_developer` + `prjct_signals` replace the vault-only `developer.md`
  // and `signals.md` read surfaces (WS-A: vault is off by default, so this
  // synthesis must be queryable through a tool, not Read/Glob over markdown).
  s.tool(
    'prjct_developer',
    'The synthesized developer profile — stated preferences (feedback) + friction lessons. Read this to act as the developer would without being told each time.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_developer', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const { projectMemory } = await import('../../memory/project-memory')
      const { buildDeveloperProfile } = await import('../../services/developer-profile')
      const { renderDeveloperEvolution } = await import('../../services/developer-evolution')
      const entries = projectMemory.allEntriesForIndex(projectId)
      const body = buildDeveloperProfile(entries)
      // Weekly typed snapshots: how the profile + delivery velocity have
      // evolved over time (developer_profile_snapshots).
      const evolution = renderDeveloperEvolution(projectId)
      const text =
        [body, evolution].filter(Boolean).join('\n\n') ||
        'No developer profile yet — capture `feedback` memories as preferences emerge.'
      return {
        content: [{ type: 'text', text }],
      }
    })
  )

  s.tool(
    'prjct_signals',
    'Machine signals dashboard — hot files, recurring patterns, skill-misses, friction. Transient telemetry to act on, then let expire (not durable knowledge).',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_signals', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const { projectMemory } = await import('../../memory/project-memory')
      const { buildSignalsFile, isSignalEntry } = await import('../../services/signals-digest')
      const signals = projectMemory.allEntriesForIndex(projectId).filter(isSignalEntry)
      const body = buildSignalsFile(signals, { boundary: 'llm' })
      return {
        content: [{ type: 'text', text: body ?? 'No active signals.' }],
      }
    })
  )

  // Cross-rig skill discovery ("index of paths, not summaries"): agents on
  // MCP-only rigs (Cursor, Windsurf, ...) resolve the catalog here and pass
  // EXACT SKILL.md paths to their subagents — never a generated digest.
  s.tool(
    'prjct_skills',
    'Skill index: every available agent skill (project + global roots) with name, description, and the EXACT SKILL.md path. Resolve once, pass paths to subagents — they read the originals.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_skills', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const { refreshSkillIndex, renderSkillIndex } = await import('../../services/skill-index')
      await refreshSkillIndex(projectId, args.projectPath)
      const body = renderSkillIndex(projectId)
      return {
        content: [
          { type: 'text', text: body ?? 'No skills found in project or global skill roots.' },
        ],
      }
    })
  )
}
