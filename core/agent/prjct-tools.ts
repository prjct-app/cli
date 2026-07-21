/**
 * Structured prjct body tools for the owned agent.
 * Same SoT as MCP (projectMemory) — no shell out to prjct CLI.
 * Soft-fail when cwd is not a configured prjct project.
 */

import configManager from '../infrastructure/config-manager'
import { formatMemoryMd } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import type { AgentTool, AgentToolContext, AgentToolResult } from './types'

function ok(content: string): AgentToolResult {
  return { ok: true, content }
}
function fail(content: string): AgentToolResult {
  return { ok: false, content }
}

function asString(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} must be a non-empty string`)
  return v.trim()
}

async function resolveProjectId(root: string): Promise<string | null> {
  try {
    const id = await configManager.getProjectId(root)
    return id || null
  } catch {
    return null
  }
}

/** Best-effort preventive memory for a path (used by guard tool + edit/write). */
export async function fetchGuardHits(
  root: string,
  filePath: string,
  limit = 3
): Promise<string | null> {
  const projectId = await resolveProjectId(root)
  if (!projectId) return null
  try {
    const hits = projectMemory.recallForFile(projectId, filePath, limit)
    if (hits.length === 0) return null
    return formatMemoryMd(hits, { boundary: 'llm', compact: true })
  } catch {
    return null
  }
}

export const searchTool: AgentTool = {
  name: 'prjct_search',
  description:
    'Search durable project memory (decisions, gotchas, learnings). Prefer this before broad codebase exploration.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keyword / topic to search' },
      limit: { type: 'number', description: 'Max entries (default 10)' },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    try {
      const query = asString(args.query, 'query')
      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 25) : 10
      const projectId = await resolveProjectId(ctx.root)
      if (!projectId) return ok('(not a prjct project — no memory index)')
      // Dynamic import avoids loading enrichedRecall on pure FS unit tests
      const { enrichedRecall } = await import('../memory/enriched-recall')
      const entries = await enrichedRecall(ctx.root, projectId, {
        topic: query,
        limit,
        expandLinks: false,
      })
      if (entries.length === 0) return ok('No matching memories.')
      return ok(formatMemoryMd(entries, { boundary: 'llm', compact: true }))
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export const guardTool: AgentTool = {
  name: 'prjct_guard',
  description:
    'Anticipation: preventive memory for a file (gotchas/anti-patterns) before edit. Empty means clear to edit.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repo-relative file path' },
      limit: { type: 'number', description: 'Max traps (default 3)' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    try {
      const file = asString(args.path, 'path')
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 3
      const projectId = await resolveProjectId(ctx.root)
      if (!projectId) return ok('clear to edit (no prjct project)')
      const hits = projectMemory.recallForFile(projectId, file, limit)
      if (hits.length === 0) return ok(`No preventive memory for ${file} — clear to edit.`)
      return ok(formatMemoryMd(hits, { boundary: 'llm', compact: true }))
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export const rememberTool: AgentTool = {
  name: 'prjct_remember',
  description:
    'Persist a durable memory in ENGLISH (decision|learning|gotcha|fact|…). Use after resolving something non-obvious.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Memory type e.g. decision, learning, gotcha, fact',
      },
      content: { type: 'string', description: 'Memory body in English' },
      tags: {
        type: 'object',
        description: 'Optional key:value tags',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['type', 'content'],
  },
  async execute(args, ctx) {
    try {
      const type = asString(args.type, 'type')
      const content = asString(args.content, 'content')
      const tags =
        args.tags && typeof args.tags === 'object' && !Array.isArray(args.tags)
          ? (args.tags as Record<string, string>)
          : undefined
      const projectId = await resolveProjectId(ctx.root)
      if (!projectId) return fail('Not a prjct project — cannot remember')
      await projectMemory.remember(ctx.root, {
        type: type as Parameters<typeof projectMemory.remember>[1]['type'],
        content,
        tags,
        projectId,
        requireWrite: true,
      })
      return ok(`Saved ${type}: ${content.slice(0, 100)}`)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export const workTool: AgentTool = {
  name: 'prjct_work',
  description:
    'Start a tracked prjct work cycle for an intent (same gates as `prjct work`). Prefer once at the beginning if none is active. Pass a real task description, not a bare CLI verb.',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Work intent (e.g. "fix null guard in auth login")',
      },
    },
    required: ['description'],
  },
  async execute(args, ctx) {
    try {
      const description = asString(args.description, 'description')
      const projectId = await resolveProjectId(ctx.root)
      if (!projectId) return fail('Not a prjct project — cannot start work')
      const { startTask } = await import('../services/task-service')
      const outcome = await startTask(projectId, ctx.root, description, {})
      if (!outcome.ok) {
        return fail(outcome.blocked ?? 'Work start blocked')
      }
      const lines = [
        `Work started: ${outcome.taskId}`,
        outcome.description ? `Description: ${outcome.description}` : '',
        outcome.branch ? `Branch: ${outcome.branch}` : '',
        outcome.isolation?.worktreePath
          ? `Worktree: ${outcome.isolation.worktreePath} (cd there for further edits)`
          : '',
      ].filter(Boolean)
      if (outcome.risks?.length) {
        lines.push('Risks:')
        for (const r of outcome.risks.slice(0, 5)) {
          lines.push(`- [${r.file}] ${r.title}`)
        }
      }
      return ok(lines.join('\n'))
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export function prjctBodyTools(): AgentTool[] {
  return [searchTool, guardTool, rememberTool, workTool]
}

/** Prefix edit/write results with guard hits when present (anticipation). */
export async function withGuardPrefix(
  ctx: AgentToolContext,
  filePath: string,
  result: AgentToolResult
): Promise<AgentToolResult> {
  if (!result.ok) return result
  const traps = await fetchGuardHits(ctx.root, filePath, 3)
  if (!traps) return result
  return {
    ok: true,
    content: `PREVENTIVE MEMORY (review before trusting this edit):\n${traps}\n\n---\n${result.content}`,
  }
}
