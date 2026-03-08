/**
 * MCP Pattern Tools (6 tools)
 *
 * Exposes PatternStore decision/preference methods via MCP.
 * Records and retrieves technical decisions with confidence tracking.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import memorySystem from '../../agentic/memory-system'
import { stateStorage } from '../../storage/state-storage'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerPatternTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_decision_record',
    'Record a technical decision with confidence tracking. Repeated observations increase confidence.',
    {
      projectPath: z.string().describe('Project directory path'),
      key: z.string().describe('Decision key (e.g. commit_style, branch_naming, test_framework)'),
      value: z.string().describe('Decision value (e.g. "conventional commits", "feature/*")'),
      context: z.string().optional().default('').describe('Context for this decision'),
    },
    safeMcpCall(
      'prjct_decision_record',
      async (args: { projectPath: string; key: string; value: string; context: string }) => {
        const projectId = await resolveProjectId(args.projectPath)
        await memorySystem.learnDecision(projectId, args.key, args.value, args.context)
        return {
          content: [{ type: 'text', text: `Decision recorded: ${args.key} = "${args.value}"` }],
        }
      }
    )
  )

  s.tool(
    'prjct_decision_get',
    'Retrieve a learned decision (checks session cache → pattern store). Returns null for low-confidence decisions.',
    {
      projectPath: z.string().describe('Project directory path'),
      key: z.string().describe('Decision key to look up'),
    },
    safeMcpCall('prjct_decision_get', async (args: { projectPath: string; key: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const value = await memorySystem.getSmartDecision(projectId, args.key)
      if (value === null) {
        return { content: [{ type: 'text', text: `No decision found for "${args.key}".` }] }
      }
      return {
        content: [{ type: 'text', text: `${args.key} = "${value}"` }],
      }
    })
  )

  s.tool(
    'prjct_preference_set',
    'Set a user preference with confidence tracking',
    {
      projectPath: z.string().describe('Project directory path'),
      key: z.string().describe('Preference key (e.g. verbosity, test_runner, editor)'),
      value: z.string().describe('Preference value'),
    },
    safeMcpCall(
      'prjct_preference_set',
      async (args: { projectPath: string; key: string; value: string }) => {
        const projectId = await resolveProjectId(args.projectPath)
        await memorySystem.setPreference(projectId, args.key, args.value, {
          userConfirmed: true,
        })
        return {
          content: [{ type: 'text', text: `Preference set: ${args.key} = "${args.value}"` }],
        }
      }
    )
  )

  s.tool(
    'prjct_preference_get',
    'Get a user preference value',
    {
      projectPath: z.string().describe('Project directory path'),
      key: z.string().describe('Preference key to look up'),
    },
    safeMcpCall('prjct_preference_get', async (args: { projectPath: string; key: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const value = await memorySystem.getPreference(projectId, args.key)
      if (value === null) {
        return { content: [{ type: 'text', text: `No preference found for "${args.key}".` }] }
      }
      return {
        content: [{ type: 'text', text: `${args.key} = "${value}"` }],
      }
    })
  )

  // =========================================================================
  // Sprint 15: confirm + archive_stale
  // =========================================================================

  s.tool(
    'prjct_confirm',
    'Confirm a decision/preference/workflow → boosts confidence to high',
    {
      projectPath: z.string().describe('Project directory path'),
      type: z.enum(['decision', 'preference', 'workflow']).describe('Type to confirm'),
      key: z.string().describe('Key of the decision/preference/workflow to confirm'),
    },
    safeMcpCall(
      'prjct_confirm',
      async (args: {
        projectPath: string
        type: 'decision' | 'preference' | 'workflow'
        key: string
      }) => {
        const projectId = await resolveProjectId(args.projectPath)

        let confirmed: boolean
        switch (args.type) {
          case 'decision':
            confirmed = await memorySystem.confirmDecision(projectId, args.key)
            break
          case 'preference':
            confirmed = await memorySystem.confirmPreference(projectId, args.key)
            break
          case 'workflow':
            confirmed = await memorySystem.confirmWorkflow(projectId, args.key)
            break
        }

        if (!confirmed) {
          return { content: [{ type: 'text', text: `${args.type} "${args.key}" not found.` }] }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Confirmed ${args.type} "${args.key}" → confidence set to high.`,
            },
          ],
        }
      }
    )
  )

  s.tool(
    'prjct_archive_stale',
    'Archive stale decisions (>90 days) + paused tasks (>30 days)',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_archive_stale', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)

      const archivedDecisions = await memorySystem.archiveStaleDecisions(projectId)
      const archivedTasks = await stateStorage.archiveStalePausedTasks(projectId)

      const parts = ['## Archive Results']
      parts.push(`Stale decisions archived: ${archivedDecisions}`)
      parts.push(`Stale paused tasks archived: ${archivedTasks.length}`)

      if (archivedTasks.length > 0) {
        parts.push('\n### Archived Tasks')
        for (const t of archivedTasks) {
          parts.push(`- ${t.description} (paused at ${t.pausedAt})`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )
}
