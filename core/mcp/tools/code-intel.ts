/**
 * MCP Code Intelligence Tools (4 tools)
 *
 * Exposes import graph, co-change analysis, change propagation,
 * and combined related-context via MCP.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { affectedDomains, propagateChanges } from '../../domain/change-propagator'
import {
  scoreFromSeeds as cochangeScore,
  indexCoChanges,
  loadMatrix,
} from '../../domain/git-cochange'
import { scoreFromSeeds as importScore, indexImports, loadGraph } from '../../domain/import-graph'
import { optionalProjectPath, resolveProjectId, resolveProjectPath } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerCodeIntelTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_impact_analysis',
    'Given changed files, find affected files via import graph + affected domains',
    {
      projectPath: optionalProjectPath,
      changedFiles: z
        .array(z.string())
        .describe('List of changed file paths (relative to project root)'),
    },
    safeMcpCall(
      'prjct_impact_analysis',
      async (args: { projectPath: string; changedFiles: string[] }) => {
        const projectId = await resolveProjectId(args.projectPath)

        const diff = {
          added: [] as string[],
          modified: args.changedFiles,
          deleted: [] as string[],
          unchanged: [] as string[],
        }

        const propagated = propagateChanges(diff, projectId)
        const domains = affectedDomains(propagated.allAffected)

        const parts: string[] = ['## Impact Analysis']

        parts.push(`\n### Directly Changed (${propagated.directlyChanged.length})`)
        for (const f of propagated.directlyChanged) {
          parts.push(`- ${f}`)
        }

        if (propagated.affectedByImports.length > 0) {
          parts.push(`\n### Affected via Imports (${propagated.affectedByImports.length})`)
          for (const f of propagated.affectedByImports) {
            parts.push(`- ${f}`)
          }
        }

        parts.push(`\n### Affected Domains`)
        parts.push(domains.size > 0 ? Array.from(domains).join(', ') : 'none detected')

        parts.push(`\nTotal affected: ${propagated.allAffected.length} files`)

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_import_graph',
    'Import graph stats + file neighbors (imports/importers). Pass a file for its neighbors, omit for graph stats.',
    {
      projectPath: optionalProjectPath,
      file: z.string().optional().describe('File path to get neighbors for (omit for graph stats)'),
      rebuild: z.boolean().optional().default(false).describe('Force rebuild the import graph'),
    },
    safeMcpCall(
      'prjct_import_graph',
      async (args: { projectPath: string; file?: string; rebuild: boolean }) => {
        const projectId = await resolveProjectId(args.projectPath)

        let graph = args.rebuild ? null : loadGraph(projectId)
        if (!graph) {
          graph = await indexImports(resolveProjectPath(args.projectPath), projectId)
        }

        if (args.file) {
          const imports = graph.forward[args.file] || []
          const importers = graph.reverse[args.file] || []

          const parts = [
            `## Import Neighbors: ${args.file}`,
            `\n### Imports (${imports.length})`,
            ...imports.map((f) => `- ${f}`),
            `\n### Imported By (${importers.length})`,
            ...importers.map((f) => `- ${f}`),
          ]

          return { content: [{ type: 'text', text: parts.join('\n') }] }
        }

        const parts = [
          '## Import Graph Stats',
          `Files: ${graph.fileCount}`,
          `Edges: ${graph.edgeCount}`,
          `Built: ${graph.builtAt}`,
        ]

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_cochange',
    'Files that historically change together (Jaccard similarity from git history)',
    {
      projectPath: optionalProjectPath,
      seedFiles: z.array(z.string()).describe('Seed files to find co-change partners for'),
      rebuild: z.boolean().optional().default(false).describe('Force rebuild the co-change matrix'),
      maxResults: z.number().optional().default(10).describe('Max results (default 10)'),
    },
    safeMcpCall(
      'prjct_cochange',
      async (args: {
        projectPath: string
        seedFiles: string[]
        rebuild: boolean
        maxResults: number
      }) => {
        const projectId = await resolveProjectId(args.projectPath)

        let index = args.rebuild ? null : loadMatrix(projectId)
        if (!index) {
          index = await indexCoChanges(resolveProjectPath(args.projectPath), projectId)
        }

        const scores = cochangeScore(args.seedFiles, index).slice(0, args.maxResults)

        if (scores.length === 0) {
          return { content: [{ type: 'text', text: 'No co-change partners found.' }] }
        }

        const parts = [
          `## Co-Change Partners`,
          `Seeds: ${args.seedFiles.join(', ')}`,
          `Commits analyzed: ${index.commitsAnalyzed}`,
          '',
        ]

        for (const s of scores) {
          parts.push(`- ${s.path} (similarity: ${Math.round(s.score * 100)}%)`)
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_related_context',
    'Combined: import neighbors + co-change partners for seed files',
    {
      projectPath: optionalProjectPath,
      seedFiles: z.array(z.string()).describe('Seed files to find related context for'),
      maxResults: z.number().optional().default(15).describe('Max results (default 15)'),
    },
    safeMcpCall(
      'prjct_related_context',
      async (args: { projectPath: string; seedFiles: string[]; maxResults: number }) => {
        const projectId = await resolveProjectId(args.projectPath)

        // Gather import graph scores
        const graph = loadGraph(projectId)
        const importScores = graph ? importScore(args.seedFiles, graph) : []

        // Gather co-change scores
        const cochangeIndex = loadMatrix(projectId)
        const cochangeScores = cochangeIndex ? cochangeScore(args.seedFiles, cochangeIndex) : []

        // Merge scores: combine import + cochange, take max
        const merged = new Map<string, { importScore: number; cochangeScore: number }>()

        for (const s of importScores) {
          merged.set(s.path, { importScore: s.score, cochangeScore: 0 })
        }
        for (const s of cochangeScores) {
          const existing = merged.get(s.path)
          if (existing) {
            existing.cochangeScore = s.score
          } else {
            merged.set(s.path, { importScore: 0, cochangeScore: s.score })
          }
        }

        // Sort by combined score (weighted average)
        const results = Array.from(merged.entries())
          .map(([path, scores]) => ({
            path,
            combined: scores.importScore * 0.6 + scores.cochangeScore * 0.4,
            importScore: scores.importScore,
            cochangeScore: scores.cochangeScore,
          }))
          .sort((a, b) => b.combined - a.combined)
          .slice(0, args.maxResults)

        if (results.length === 0) {
          return {
            content: [
              { type: 'text', text: 'No related files found. Run `prjct sync` to build indexes.' },
            ],
          }
        }

        const parts = [`## Related Context`, `Seeds: ${args.seedFiles.join(', ')}`, '']

        for (const r of results) {
          const sources: string[] = []
          if (r.importScore > 0) sources.push(`import: ${r.importScore.toFixed(2)}`)
          if (r.cochangeScore > 0) sources.push(`cochange: ${Math.round(r.cochangeScore * 100)}%`)
          parts.push(`- ${r.path} (${sources.join(', ')})`)
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )
}
