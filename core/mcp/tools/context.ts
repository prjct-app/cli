/**
 * MCP Context Intelligence Tools (3 tools)
 *
 * Exposes analysis staleness, context zone health, and audit log via MCP.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import memorySystem from '../../agentic/memory-system'
import { contextZoneStorage } from '../../storage/context-zone-storage'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import { execAsync } from '../../utils/exec'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerContextTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_analysis_staleness',
    'Is analysis current? How many commits behind? Shows analysis summary and history.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_analysis_staleness', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)

      const summary = llmAnalysisStorage.getActiveSummary(projectId)
      if (!summary) {
        return {
          content: [{ type: 'text', text: 'No analysis exists. Run `prjct sync` to analyze.' }],
        }
      }

      // Get current HEAD commit
      let currentCommit: string | null = null
      try {
        const { stdout } = await execAsync('git rev-parse HEAD', { cwd: args.projectPath })
        currentCommit = stdout.trim()
      } catch {
        // Not a git repo or git not available
      }

      const isCurrent = currentCommit
        ? llmAnalysisStorage.isCurrent(projectId, currentCommit)
        : false

      // Count commits since analysis
      let commitsBehind = 0
      if (currentCommit && summary.commitHash && !isCurrent) {
        try {
          const { stdout } = await execAsync(`git rev-list ${summary.commitHash}..HEAD --count`, {
            cwd: args.projectPath,
          })
          commitsBehind = parseInt(stdout.trim(), 10) || 0
        } catch {
          commitsBehind = -1 // Unknown
        }
      }

      const history = llmAnalysisStorage.getHistory(projectId, 5)

      const parts = ['## Analysis Staleness', `Status: ${isCurrent ? 'CURRENT' : 'STALE'}`]

      if (!isCurrent && commitsBehind > 0) {
        parts.push(`Commits behind: ${commitsBehind}`)
      } else if (!isCurrent && commitsBehind === -1) {
        parts.push('Commits behind: unknown (commit hash not found in history)')
      }

      parts.push(`\n### Active Analysis`)
      parts.push(`Architecture: ${summary.architectureStyle}`)
      parts.push(`Patterns: ${summary.patternCount}`)
      parts.push(`Anti-patterns: ${summary.antiPatternCount}`)
      parts.push(`Analyzed at: ${summary.analyzedAt}`)
      if (summary.commitHash) parts.push(`Commit: ${summary.commitHash.slice(0, 8)}`)

      if (history.length > 1) {
        parts.push(`\n### History (last ${history.length})`)
        for (const h of history) {
          parts.push(
            `- ${h.status} at ${h.analyzedAt} (${h.patternCount} patterns${h.commitHash ? `, ${h.commitHash.slice(0, 8)}` : ''})`
          )
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_zone_health',
    'Smart/warning/dumb zone distribution + compaction frequency',
    {
      projectPath: z.string().describe('Project directory path'),
      days: z.number().optional().default(7).describe('Time period in days (default 7)'),
    },
    safeMcpCall('prjct_zone_health', async (args: { projectPath: string; days: number }) => {
      const projectId = await resolveProjectId(args.projectPath)

      const summary = contextZoneStorage.getSummary(projectId, args.days)
      const transitions = contextZoneStorage.getTransitions(projectId, 10)

      const parts = [
        '## Context Zone Health',
        `Period: last ${args.days} days`,
        '',
        '### Zone Distribution',
        `Smart: ${summary.smartPercent}%`,
        `Warning: ${summary.warningPercent}%`,
        `Dumb: ${summary.dumbPercent}%`,
        `\nCompactions: ${summary.compactions}`,
      ]

      if (transitions.length > 0) {
        parts.push(`\n### Recent Transitions (${transitions.length})`)
        for (const t of transitions) {
          const action = t.action ? ` → ${t.action}` : ''
          parts.push(`- ${t.from} → ${t.to} (${t.usagePercent}%${action}) at ${t.timestamp}`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_audit_log',
    'Recent history events (decisions, preferences, task actions)',
    {
      projectPath: z.string().describe('Project directory path'),
      limit: z.number().optional().default(20).describe('Max events to return (default 20)'),
    },
    safeMcpCall('prjct_audit_log', async (args: { projectPath: string; limit: number }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const events = await memorySystem.getRecentHistory(projectId, args.limit)

      if (!events || events.length === 0) {
        return { content: [{ type: 'text', text: 'No history events found.' }] }
      }

      const parts = [`## Audit Log (${events.length} events)`, '']

      for (const event of events) {
        const type = (event as Record<string, unknown>).type || 'unknown'
        const timestamp = (event as Record<string, unknown>).timestamp || ''
        const details = Object.entries(event as Record<string, unknown>)
          .filter(([k]) => k !== 'type' && k !== 'timestamp')
          .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(', ')
        parts.push(`- [${type}] ${details}${timestamp ? ` (${timestamp})` : ''}`)
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )
}
