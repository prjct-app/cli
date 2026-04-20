/**
 * Context Tools - Smart context filtering for AI agents
 *
 * Provides terminal tools that Claude can use to explore codebases
 * efficiently WITHOUT consuming tokens for filtering.
 *
 * Tools:
 * - files: Find relevant files for a task
 * - signatures: Extract code structure without implementation
 * - imports: Build dependency graphs
 * - recent: Find hot files from git history
 * - summary: Intelligent file summarization
 *
 * @module context-tools
 * @version 1.0.0
 */

import configManager from '../../infrastructure/config-manager'
import { formatMemoryMd, type MemoryType, projectMemory } from '../../memory/project-memory'
import { metricsStorage } from '../../storage/metrics-storage'
import type { ContextToolOutput, ContextToolUsage } from '../../types/context-tools'
import { getErrorMessage } from '../../types/fs'
import { getTimestamp } from '../../utils/date-helper'
import { findRelevantFiles } from './files-tool'
import { analyzeImports } from './imports-tool'
import { getRecentFiles } from './recent-tool'
import { extractDirectorySignatures, extractSignatures } from './signatures-tool'
import { summarizeDirectory, summarizeFile } from './summary-tool'
import { combineMetrics } from './token-counter'

// =============================================================================
// CLI Dispatcher
// =============================================================================

/**
 * Run a context tool from CLI arguments
 *
 * Usage:
 *   prjct context files "add authentication"
 *   prjct context signatures core/auth/service.ts
 *   prjct context imports core/auth/service.ts --reverse
 *   prjct context recent 50
 *   prjct context recent --branch
 *   prjct context summary core/auth/service.ts
 *
 * @param args - CLI arguments (tool name + args)
 * @param projectId - Project ID for metrics tracking
 * @param projectPath - Project root path
 * @returns JSON output for Claude
 */
export async function runContextTool(
  args: string[],
  projectId: string,
  projectPath: string
): Promise<ContextToolOutput> {
  const startTime = Date.now()
  const [toolName, ...toolArgs] = args

  try {
    let result: ContextToolOutput

    switch (toolName) {
      case 'files':
        result = await runFilesTool(toolArgs, projectPath)
        break

      case 'signatures':
        result = await runSignaturesTool(toolArgs, projectPath)
        break

      case 'imports':
        result = await runImportsTool(toolArgs, projectPath)
        break

      case 'recent':
        result = await runRecentTool(toolArgs, projectPath)
        break

      case 'summary':
        result = await runSummaryTool(toolArgs, projectPath)
        break

      case 'memory':
        result = await runMemoryTool(toolArgs, projectPath, { kind: 'memory' })
        break

      case 'learnings':
        result = await runMemoryTool(toolArgs, projectPath, { kind: 'learnings' })
        break

      case 'wiki':
        result = await runWikiTool(projectPath)
        break

      case 'help':
        return {
          tool: 'error',
          result: {
            error: getHelpText(),
            code: 'HELP',
          },
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

    // Record usage metrics
    const duration = Date.now() - startTime
    const tokensSaved = getTokensSaved(result)
    const compressionRate = getCompressionRate(result)

    await recordToolUsage(projectId, {
      tool: toolName as ContextToolUsage['tool'],
      timestamp: getTimestamp(),
      inputArgs: toolArgs.join(' '),
      tokensSaved,
      compressionRate,
      duration,
    })

    return result
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

// =============================================================================
// Tool Runners
// =============================================================================

async function runFilesTool(args: string[], projectPath: string): Promise<ContextToolOutput> {
  // Parse options
  const options: { maxFiles?: number; minScore?: number; includeTests?: boolean } = {}
  const taskParts: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1]) {
      options.maxFiles = parseInt(args[++i], 10)
    } else if (args[i] === '--min-score' && args[i + 1]) {
      options.minScore = parseFloat(args[++i])
    } else if (args[i] === '--include-tests') {
      options.includeTests = true
    } else {
      taskParts.push(args[i])
    }
  }

  const taskDescription = taskParts.join(' ')
  if (!taskDescription) {
    return {
      tool: 'error',
      result: {
        error: 'Usage: prjct context files "<task description>"',
        code: 'MISSING_ARG',
      },
    }
  }

  const result = await findRelevantFiles(taskDescription, projectPath, options)
  return { tool: 'files', result }
}

async function runWikiTool(projectPath: string): Promise<ContextToolOutput> {
  const configManager = (await import('../../infrastructure/config-manager')).default
  const projectId = await configManager.getProjectId(projectPath)
  if (!projectId) {
    return {
      tool: 'error',
      result: { error: 'No prjct project. Run `prjct init` first.', code: 'NO_PROJECT' },
    }
  }
  const { generateWiki } = await import('../../services/wiki-generator')
  const { wikiRoot, filesWritten } = await generateWiki(projectPath, projectId)
  return {
    tool: 'wiki',
    result: {
      markdown: `> Wiki rebuilt at \`${wikiRoot}\` — ${filesWritten} files. Read \`${wikiRoot}/index.md\` with the Read tool.`,
      entryCount: filesWritten,
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
      result: {
        error: 'No prjct project. Run `prjct init` first.',
        code: 'NO_PROJECT',
      },
    }
  }

  const topic =
    args
      .filter((a) => !a.startsWith('-'))
      .join(' ')
      .trim() || undefined

  // `learnings` is a typed slice of memory focused on what the project
  // has *learned* the hard way. Everything else comes through `memory`.
  const LEARNINGS_TYPES: MemoryType[] = ['learning', 'anti-pattern', 'gotcha']
  const types = opts.kind === 'learnings' ? LEARNINGS_TYPES : undefined

  const entries = projectMemory.recall(projectId, { topic, types, limit: 30 })
  return {
    tool: opts.kind,
    result: {
      markdown: formatMemoryMd(entries),
      entryCount: entries.length,
      topic,
    },
  }
}

async function runSignaturesTool(args: string[], projectPath: string): Promise<ContextToolOutput> {
  const filePath = args[0]
  if (!filePath) {
    return {
      tool: 'error',
      result: {
        error: 'Usage: prjct context signatures <file_or_directory>',
        code: 'MISSING_ARG',
      },
    }
  }

  // Check if it's a directory
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath)

  try {
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      // Return multiple results
      const results = await extractDirectorySignatures(filePath, projectPath, {
        recursive: args.includes('--recursive') || args.includes('-r'),
      })
      // Combine into single output with cost savings
      const combinedMetrics = combineMetrics(results.map((r) => r.metrics))
      const combined = {
        file: filePath,
        language: 'multiple',
        signatures: results.flatMap((r) => r.signatures.map((s) => ({ ...s, file: r.file }))),
        fallback: false,
        metrics: combinedMetrics,
      }
      return { tool: 'signatures', result: combined }
    }
  } catch {
    // Not a directory, try as file
  }

  const result = await extractSignatures(filePath, projectPath)
  return { tool: 'signatures', result }
}

async function runImportsTool(args: string[], projectPath: string): Promise<ContextToolOutput> {
  const filePath = args[0]
  if (!filePath) {
    return {
      tool: 'error',
      result: {
        error: 'Usage: prjct context imports <file> [--reverse] [--depth N]',
        code: 'MISSING_ARG',
      },
    }
  }

  // Parse options
  const options: { reverse?: boolean; depth?: number } = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--reverse' || args[i] === '-r') {
      options.reverse = true
    } else if ((args[i] === '--depth' || args[i] === '-d') && args[i + 1]) {
      options.depth = parseInt(args[++i], 10)
    }
  }

  const result = await analyzeImports(filePath, projectPath, options)
  return { tool: 'imports', result }
}

async function runRecentTool(args: string[], projectPath: string): Promise<ContextToolOutput> {
  const options: { commits?: number; branch?: boolean; maxFiles?: number } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--branch' || args[i] === '-b') {
      options.branch = true
    } else if (args[i] === '--max' && args[i + 1]) {
      options.maxFiles = parseInt(args[++i], 10)
    } else if (/^\d+$/.test(args[i])) {
      options.commits = parseInt(args[i], 10)
    }
  }

  const result = await getRecentFiles(projectPath, options)
  return { tool: 'recent', result }
}

async function runSummaryTool(args: string[], projectPath: string): Promise<ContextToolOutput> {
  const targetPath = args[0]
  if (!targetPath) {
    return {
      tool: 'error',
      result: {
        error: 'Usage: prjct context summary <file_or_directory> [--recursive]',
        code: 'MISSING_ARG',
      },
    }
  }

  // Check if it's a directory
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(projectPath, targetPath)

  try {
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      const results = await summarizeDirectory(targetPath, projectPath, {
        recursive: args.includes('--recursive') || args.includes('-r'),
      })
      // Combine into aggregate output
      const combined = {
        file: targetPath,
        purpose: `Directory with ${results.length} files`,
        publicAPI: results.flatMap((r) => r.publicAPI.map((api) => ({ ...api, file: r.file }))),
        dependencies: [...new Set(results.flatMap((r) => r.dependencies))],
        metrics: combineMetrics(results.map((r) => r.metrics)),
      }
      return { tool: 'summary', result: combined }
    }
  } catch {
    // Not a directory, try as file
  }

  const result = await summarizeFile(targetPath, projectPath)
  return { tool: 'summary', result }
}

// =============================================================================
// Metrics Helpers
// =============================================================================

function getTokensSaved(result: ContextToolOutput): number {
  if (result.tool === 'error') return 0

  switch (result.tool) {
    case 'signatures':
    case 'summary':
      return result.result.metrics.tokens.saved
    case 'files':
      // Estimate tokens saved by returning fewer files
      return result.result.metrics.filesScanned * 50 - result.result.metrics.filesReturned * 50
    case 'imports':
      // Estimate based on not needing to read full files
      return result.result.metrics.totalImports * 20
    case 'recent':
      // Estimate based on focused file list
      return result.result.metrics.totalFilesChanged * 30
    default:
      return 0
  }
}

function getCompressionRate(result: ContextToolOutput): number {
  if (result.tool === 'error') return 0

  switch (result.tool) {
    case 'signatures':
    case 'summary':
      return result.result.metrics.compression
    case 'files': {
      const scanned = result.result.metrics.filesScanned
      const returned = result.result.metrics.filesReturned
      return scanned > 0 ? (scanned - returned) / scanned : 0
    }
    default:
      return 0
  }
}

async function recordToolUsage(projectId: string, usage: ContextToolUsage): Promise<void> {
  try {
    // Record to metrics storage
    await metricsStorage.recordSync(projectId, {
      originalSize: usage.tokensSaved + 100, // Estimate original
      filteredSize: 100, // Estimate filtered
      duration: usage.duration,
      isWatch: false,
      agents: [`context-${usage.tool}`],
    })
  } catch {
    // Metrics recording failure is non-fatal
  }
}

// =============================================================================
// Help Text
// =============================================================================

function getHelpText(): string {
  return `
Context Tools - Smart context filtering for AI agents

USAGE:
  prjct context <tool> [args] [options]

TOOLS:

  files <task>
    Find files relevant to a task description.
    Options:
      --max N           Maximum files to return (default: 30)
      --min-score N     Minimum relevance score 0-1 (default: 0.1)
      --include-tests   Include test files

    Example:
      prjct context files "add user authentication"

  signatures <path>
    Extract code structure without implementation (~90% compression).
    Path can be a file or directory.
    Options:
      --recursive, -r   Process directories recursively

    Example:
      prjct context signatures core/auth/service.ts
      prjct context signatures core/auth/ --recursive

  imports <file>
    Analyze import/dependency relationships.
    Options:
      --reverse, -r     Show files that import this file
      --depth N, -d N   Build dependency tree to depth N

    Example:
      prjct context imports core/auth/service.ts --reverse
      prjct context imports core/auth/service.ts --depth 2

  recent [commits]
    Find recently modified "hot" files.
    Options:
      --branch, -b      Only files changed in current branch vs main
      --max N           Maximum files to return (default: 50)

    Example:
      prjct context recent
      prjct context recent 50
      prjct context recent --branch

  summary <path>
    Generate intelligent file summary (public API + docs).
    Options:
      --recursive, -r   Process directories recursively

    Example:
      prjct context summary core/auth/service.ts
      prjct context summary core/services/ --recursive

OUTPUT:
  All tools output JSON for easy parsing by AI agents.
  Each output includes metrics showing token savings.
`.trim()
}
