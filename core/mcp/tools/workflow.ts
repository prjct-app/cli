/**
 * MCP Workflow Tools (3 tools)
 *
 * Wraps custom-workflow-storage and workflow-rule-storage.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { customWorkflowStorage } from '../../storage/custom-workflow-storage'
import { workflowRuleStorage } from '../../storage/workflow-rule-storage'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerWorkflowTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_workflow_rules',
    'Get workflow rules for a command (gates, hooks, steps, instructions)',
    {
      projectPath: z.string().describe('Project directory path'),
      command: z.string().describe('Command name (task, done, ship, sync, etc.)'),
    },
    safeMcpCall('prjct_workflow_rules', async (args: { projectPath: string; command: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const rules = workflowRuleStorage.getRulesForCommand(projectId, args.command)

      if (rules.length === 0) {
        return {
          content: [{ type: 'text', text: `No workflow rules for \`${args.command}\`.` }],
        }
      }

      const grouped: Record<string, typeof rules> = {}
      for (const rule of rules) {
        const key = `${rule.type}:${rule.position}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(rule)
      }

      const parts: string[] = [`## Workflow Rules for \`${args.command}\``]
      for (const [key, groupRules] of Object.entries(grouped)) {
        parts.push(`\n### ${key}`)
        for (const r of groupRules) {
          const status = r.enabled ? '' : ' (disabled)'
          parts.push(`- ${r.action}${r.description ? ` — ${r.description}` : ''}${status}`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_workflow_list',
    'List all workflows for this project (built-in + custom)',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_workflow_list', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const workflows = customWorkflowStorage.getAllWorkflows(projectId)

      if (workflows.length === 0) {
        return { content: [{ type: 'text', text: 'No workflows configured.' }] }
      }

      const lines = workflows.map((w) => {
        const badge = w.isBuiltin ? '(built-in)' : '(custom)'
        const status = w.enabled ? '' : ' [disabled]'
        return `- **${w.name}** ${badge}${status}${w.description ? `: ${w.description}` : ''}`
      })

      return {
        content: [
          { type: 'text', text: `## Workflows (${workflows.length})\n\n${lines.join('\n')}` },
        ],
      }
    })
  )

  s.tool(
    'prjct_workflow_status',
    'Current workflow execution state + active rules',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_workflow_status', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      // Workspace-aware: surface THIS worktree's task (main → currentTask,
      // child worktree → its activeTasks[] slot), not just the main slot.
      const { resolveActiveTask } = await import('../../services/task-service')
      const currentTask = await resolveActiveTask(projectId, args.projectPath)
      const allRules = workflowRuleStorage.getAllRules(projectId)

      const parts: string[] = ['## Workflow Status']

      if (currentTask) {
        parts.push(`\nActive task: **${currentTask.description}**`)
        parts.push(`Started: ${currentTask.startedAt}`)
      } else {
        parts.push('\nNo active task.')
      }

      const enabledRules = allRules.filter((r) => r.enabled)
      if (enabledRules.length > 0) {
        parts.push(`\n### Active Rules (${enabledRules.length})`)
        for (const r of enabledRules) {
          parts.push(`- [${r.type}] ${r.command}:${r.position} → ${r.action}`)
        }
      } else {
        parts.push('\nNo active workflow rules.')
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )
}
