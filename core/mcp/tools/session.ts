/**
 * MCP Session Tools (5 tools)
 *
 * Tracks AI agent work sessions — survives compaction and restarts.
 * Sessions auto-link to the active prjct task for full context recovery.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateUUID } from '../../schemas/schemas'
import prjctDb from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'
import { getTimestamp } from '../../utils/date-helper'
import { resolveProjectId } from '../resolve'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

interface AgentSessionRow {
  id: string
  project_id: string
  directory: string | null
  task_id: string | null
  goal: string | null
  started_at: string
  ended_at: string | null
  summary: string | null
  files_touched: string | null
  created_at: string
}

interface UserPromptRow {
  id: string
  project_id: string
  session_id: string | null
  content: string
  created_at: string
}

interface MemoryRow {
  id: string
  title: string
  content: string
  tags: string | null
  updated_at: string
}

export function registerSessionTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_session_start',
    'Start an agent session. Auto-links to active prjct task if one exists.',
    {
      projectPath: z.string().describe('Project directory path'),
      goal: z.string().optional().describe('Session goal or objective'),
    },
    async (args: { projectPath: string; goal?: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const now = getTimestamp()
      const id = generateUUID()

      // Auto-link to active prjct task
      const currentTask = await stateStorage.getCurrentTask(projectId)
      const taskId = currentTask?.id ?? null

      prjctDb.run(
        projectId,
        `INSERT INTO agent_sessions (id, project_id, directory, task_id, goal, started_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        projectId,
        args.projectPath,
        taskId,
        args.goal ?? null,
        now,
        now
      )

      const parts = [`Session started: ${id}`]
      if (currentTask) {
        parts.push(`Linked to task: ${currentTask.description}`)
        parts.push(`Task started: ${currentTask.startedAt}`)
      }
      if (args.goal) parts.push(`Goal: ${args.goal}`)

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )

  s.tool(
    'prjct_session_end',
    'End the current agent session with optional summary',
    {
      projectPath: z.string().describe('Project directory path'),
      sessionId: z.string().describe('Session ID to end'),
      summary: z.string().optional().describe('Brief session summary'),
    },
    async (args: { projectPath: string; sessionId: string; summary?: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const now = getTimestamp()

      const session = prjctDb.get<AgentSessionRow>(
        projectId,
        'SELECT * FROM agent_sessions WHERE id = ? AND project_id = ?',
        args.sessionId,
        projectId
      )
      if (!session) {
        return { content: [{ type: 'text', text: `Session ${args.sessionId} not found.` }] }
      }

      prjctDb.run(
        projectId,
        'UPDATE agent_sessions SET ended_at = ?, summary = ? WHERE id = ?',
        now,
        args.summary ?? null,
        args.sessionId
      )

      return { content: [{ type: 'text', text: 'Session ended.' }] }
    }
  )

  s.tool(
    'prjct_session_summary',
    'Save structured end-of-session summary (Goal/Accomplished/Discoveries/Next Steps/Files)',
    {
      projectPath: z.string().describe('Project directory path'),
      sessionId: z.string().describe('Session ID'),
      goal: z.string().describe('What was the goal'),
      accomplished: z.string().describe('What was accomplished'),
      discoveries: z.string().optional().describe('Key discoveries or learnings'),
      nextSteps: z.string().optional().describe('What should happen next'),
      filesTouched: z.array(z.string()).optional().describe('Files modified during session'),
    },
    async (args: {
      projectPath: string
      sessionId: string
      goal: string
      accomplished: string
      discoveries?: string
      nextSteps?: string
      filesTouched?: string[]
    }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const now = getTimestamp()

      const parts = [`## Goal\n${args.goal}`, `## Accomplished\n${args.accomplished}`]
      if (args.discoveries) parts.push(`## Discoveries\n${args.discoveries}`)
      if (args.nextSteps) parts.push(`## Next Steps\n${args.nextSteps}`)

      const summary = parts.join('\n\n')
      const filesTouched = args.filesTouched ? JSON.stringify(args.filesTouched) : null

      prjctDb.run(
        projectId,
        'UPDATE agent_sessions SET ended_at = ?, summary = ?, goal = ?, files_touched = ? WHERE id = ? AND project_id = ?',
        now,
        summary,
        args.goal,
        filesTouched,
        args.sessionId,
        projectId
      )

      return {
        content: [{ type: 'text', text: `Session summary saved (${summary.length} chars).` }],
      }
    }
  )

  s.tool(
    'prjct_prompt_save',
    'Capture user prompt text for future context',
    {
      projectPath: z.string().describe('Project directory path'),
      content: z.string().describe('User prompt text'),
      sessionId: z.string().optional().describe('Current session ID'),
    },
    async (args: { projectPath: string; content: string; sessionId?: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const id = generateUUID()

      prjctDb.run(
        projectId,
        'INSERT INTO user_prompts (id, project_id, session_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        projectId,
        args.sessionId ?? null,
        args.content,
        getTimestamp()
      )

      return { content: [{ type: 'text', text: `Prompt saved: ${id}` }] }
    }
  )

  s.tool(
    'prjct_session_context',
    'Recover context after compaction: last session + recent memories + active task state',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const parts: string[] = []

      // 1. Active task
      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (currentTask) {
        parts.push('## Active Task')
        parts.push(`**${currentTask.description}**`)
        if (currentTask.branch) parts.push(`Branch: ${currentTask.branch}`)
        parts.push(`Started: ${currentTask.startedAt}`)
      } else {
        parts.push('## No Active Task')
      }

      // 2. Last session summary
      const lastSession = prjctDb.get<AgentSessionRow>(
        projectId,
        `SELECT * FROM agent_sessions WHERE project_id = ?
         ORDER BY started_at DESC LIMIT 1`,
        projectId
      )
      if (lastSession) {
        parts.push('\n## Last Session')
        if (lastSession.goal) parts.push(`Goal: ${lastSession.goal}`)
        if (lastSession.summary) parts.push(lastSession.summary)
        if (lastSession.ended_at) {
          parts.push(`Ended: ${lastSession.ended_at}`)
        } else {
          parts.push('Status: **still open** (may have been interrupted)')
        }
        if (lastSession.files_touched) {
          try {
            const files = JSON.parse(lastSession.files_touched) as string[]
            if (files.length > 0) parts.push(`Files: ${files.join(', ')}`)
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // 3. Recent memories (last 5)
      const recentMemories = prjctDb.query<MemoryRow>(
        projectId,
        `SELECT id, title, content, tags, updated_at FROM memories
         WHERE project_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 5`,
        projectId
      )
      if (recentMemories.length > 0) {
        parts.push('\n## Recent Memories')
        for (const m of recentMemories) {
          parts.push(
            `- **${m.title}**: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
          )
        }
      }

      // 4. Recent prompts (last 3)
      const recentPrompts = prjctDb.query<UserPromptRow>(
        projectId,
        `SELECT * FROM user_prompts WHERE project_id = ?
         ORDER BY created_at DESC LIMIT 3`,
        projectId
      )
      if (recentPrompts.length > 0) {
        parts.push('\n## Recent User Prompts')
        for (const p of recentPrompts) {
          parts.push(`- ${p.content.slice(0, 200)}${p.content.length > 200 ? '...' : ''}`)
        }
      }

      if (parts.length === 0) {
        return { content: [{ type: 'text', text: 'No session context available.' }] }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )
}
