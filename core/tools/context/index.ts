/**
 * `prjct context <subtool>` — CLI surface for the context tools.
 *
 * Alpha.12 cut the file-oriented subtools (`files`, `signatures`,
 * `imports`, `recent`, `summary`) from this dispatcher. Those were
 * thin wrappers around operations Claude has natively (Glob, Grep,
 * Read, git log, etc.) — classic harness. Internals stay in the
 * sibling files for use by the orchestrator and the MCP server,
 * but the CLI stops advertising them.
 *
 * Remaining subtools here are memory-bound — they need prjct's
 * SQLite state and can't be reproduced with native Claude tools.
 */

import configManager from '../../infrastructure/config-manager'
import { enrichedRecall } from '../../memory/enriched-recall'
import type { MemoryType } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'
import { projectMemory } from '../../memory/project-memory'
import { usefulnessService } from '../../services/usefulness'
import { VAULT_HOME_FILE } from '../../services/wiki/_shared'
import type { ContextToolOutput } from '../../types/context-tools'
import { getErrorMessage } from '../../types/fs'

// CLI Dispatcher

/**
 * Run a context subtool from CLI arguments.
 *
 * Usage:
 *   prjct context memory [topic]
 *   prjct context learnings [topic]
 *   prjct context wiki
 *   prjct context wiki sync [--force]
 */
export async function runContextTool(
  args: string[],
  projectId: string,
  projectPath: string
): Promise<ContextToolOutput> {
  const [toolName, ...toolArgs] = args
  void projectId // currently only used for logs elsewhere; kept for API stability

  try {
    switch (toolName) {
      case 'memory':
        return await runMemoryTool(toolArgs, projectPath, { kind: 'memory' })

      case 'learnings':
        return await runMemoryTool(toolArgs, projectPath, { kind: 'learnings' })

      case 'wiki':
        return await runWikiTool(projectPath, toolArgs)

      case 'help':
        return {
          tool: 'error',
          result: { error: getHelpText(), code: 'HELP' },
        }

      default:
        return {
          tool: 'error',
          result: {
            error: `Unknown tool: ${toolName}. Use 'prjct context help' for usage.`,
            code: 'UNKNOWN_TOOL',
          },
        }
    }
  } catch (error) {
    return {
      tool: 'error',
      result: {
        error: getErrorMessage(error),
        code: 'EXECUTION_ERROR',
      },
    }
  }
}

// Tool Runners

async function runWikiTool(projectPath: string, args: string[] = []): Promise<ContextToolOutput> {
  const projectId = await configManager.getProjectId(projectPath)
  if (!projectId) {
    return {
      tool: 'error',
      result: { error: 'No prjct project. Run `prjct init` first.', code: 'NO_PROJECT' },
    }
  }

  const subcommand = args[0]
  if (subcommand === 'sync') {
    return runWikiSyncTool(projectPath, projectId, args.slice(1))
  }

  const { generateWiki } = await import('../../services/wiki-generator')
  const { wikiRoot, filesWritten } = await generateWiki(projectPath, projectId)
  return {
    tool: 'wiki',
    result: {
      markdown: `> Wiki rebuilt at \`${wikiRoot}\` — ${filesWritten} files. Read \`${wikiRoot}/_generated/${VAULT_HOME_FILE}\` with the Read tool.`,
      entryCount: filesWritten,
    },
  }
}

async function runWikiSyncTool(
  projectPath: string,
  projectId: string,
  args: string[]
): Promise<ContextToolOutput> {
  const force = args.includes('--force')
  const { ingestCapturedNotes } = await import('../../services/wiki-ingest')
  const { regenerateWikiDeferred } = await import('../../services/wiki-generator')

  const result = await ingestCapturedNotes(projectPath, { force })

  if (result.ingested > 0) {
    await regenerateWikiDeferred(projectPath, projectId)
  }

  const lines: string[] = []
  lines.push(`> Ingested ${result.ingested} note(s) from \`.prjct/wiki/captured/\`.`)
  if (result.skipped.length > 0) {
    lines.push('', '**Skipped:**')
    for (const s of result.skipped) lines.push(`- \`${s.file}\` — ${s.reason}`)
  }
  if (result.errors.length > 0) {
    lines.push('', '**Errors:**')
    for (const e of result.errors) lines.push(`- \`${e.file}\` — ${e.error}`)
  }
  if (result.ingested === 0 && result.skipped.length === 0 && result.errors.length === 0) {
    lines.push(
      '',
      'Nothing to ingest. Drop markdown notes with frontmatter into `.prjct/wiki/captured/` and re-run.'
    )
  }

  return {
    tool: 'wiki',
    result: {
      markdown: lines.join('\n'),
      entryCount: result.ingested,
    },
  }
}

async function runMemoryTool(
  args: string[],
  projectPath: string,
  opts: { kind: 'memory' | 'learnings' }
): Promise<ContextToolOutput> {
  const projectId = await configManager.getProjectId(projectPath)
  if (!projectId) {
    return {
      tool: 'error',
      result: { error: 'No prjct project. Run `prjct init` first.', code: 'NO_PROJECT' },
    }
  }

  const topic =
    args
      .filter((a) => !a.startsWith('-'))
      .join(' ')
      .trim() || undefined

  // Resolve-by-ID: `prjct context memory mem_3209` (or `--id mem_3209`)
  // returns that exact entry. Makes every `mem_NNNN` reference (topical
  // injection, `relates=`/`resolves=` cross-refs) resolvable instead of a
  // dangling opaque pointer "nobody — including an LLM — can read".
  const idArg = (() => {
    const flag = args.find((a) => a.startsWith('--id'))
    if (flag) {
      const v = flag.includes('=') ? flag.split('=')[1] : args[args.indexOf(flag) + 1]
      if (v) return v
    }
    return topic && /^mem[_-]?\d+$/i.test(topic) ? topic : undefined
  })()

  if (idArg) {
    const entry = projectMemory.getById(projectId, idArg)
    // Deliberate by-id pull = a usefulness signal; reinforce it.
    if (entry) usefulnessService.recordFetch(projectId, entry.id)
    // Resolving one entry by id is exactly when its relationships matter
    // most ("show me mem_3209" → also show what it resolves / supersedes).
    const linked = entry ? projectMemory.expandWithLinks(projectId, [entry], 5) : []
    const resolved = entry ? [entry, ...linked] : []
    return {
      tool: opts.kind,
      result: {
        markdown: entry
          ? formatMemoryMd(resolved)
          : `> No memory entry with id \`${idArg}\` (it may have aged out or never existed).`,
        entryCount: resolved.length,
        topic: idArg,
      },
    }
  }

  // `learnings` is a typed slice of memory focused on what the project
  // has *learned* the hard way. Everything else comes through `memory`.
  const LEARNINGS_TYPES: MemoryType[] = ['learning', 'anti-pattern', 'gotcha']
  const types = opts.kind === 'learnings' ? LEARNINGS_TYPES : undefined

  // The full pipeline (FTS-first, recall backfill, semantic blend,
  // usefulness rerank, link expansion, surface attribution) lives in
  // enrichedRecall — shared with the MCP memory tools so every agent
  // surface retrieves identically.
  // Compact scan list, not full bodies: a topic search is "what's been said
  // about X?", answered by cues the agent can pull in full by id on demand
  // (`prjct context memory mem_N`). Full-body dump of 30 hits was the single
  // heaviest agent-facing surface (~7.7k tok) and undercut 3.8.0's own
  // "pull more" directive. Lower cap reinforces it — a scan, not an archive.
  const entries = await enrichedRecall(projectPath, projectId, { topic, types, limit: 12 })

  return {
    tool: opts.kind,
    result: {
      markdown: formatMemoryMd(entries, { compact: true }),
      entryCount: entries.length,
      topic,
    },
  }
}

// Help Text

function getHelpText(): string {
  return `
prjct context — memory-bound context subtools

USAGE:
  prjct context <subtool> [args]

SUBTOOLS:

  memory [topic]
    Recall project memory entries (facts, decisions, learnings, …).
    Optional topic filters by keyword over content + tag values.

  learnings [topic]
    Shortcut for the learnings slice (learning / anti-pattern / gotcha).

  wiki [sync] [--force]
    Without a subcommand: rebuild \`.prjct/wiki/_generated/\`.
    With \`sync\`: ingest user notes from \`.prjct/wiki/captured/\`
    into project memory, then rebuild. Pass \`--force\` to accept
    secret-like content.

NOTE: File-oriented subtools (files, signatures, imports, recent,
summary) were removed in alpha.12 — Claude has Glob/Grep/Read/git
natively and re-implementing them in prjct was harness. The
underlying functions still exist for the orchestrator + MCP surface.
`.trim()
}
