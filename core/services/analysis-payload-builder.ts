/**
 * Analysis Payload Builder
 *
 * Builds a compact payload for the LLM to analyze during hybrid sync.
 * Selects the most important files using BM25, includes git context,
 * existing patterns, and task history.
 *
 * Design goal: minimize tokens while maximizing signal.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { queryFiles } from '../domain/bm25'
import { analysisStorage } from '../storage/analysis-storage'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import { stateStorage } from '../storage/state-storage'
import type { AnalysisPayload } from '../types/llm-analysis'
import type { GitData, ProjectStats } from '../types/project-sync'
import log from '../utils/logger'

/** Max characters per code sample to keep payload compact */
const MAX_SAMPLE_CHARS = 3000
/** Max number of code samples to include */
const MAX_SAMPLES = 15
/** Max recent commits to include */
const MAX_COMMITS = 15
/** Max task history entries */
const MAX_TASKS = 10

/**
 * Build the analysis payload for LLM consumption.
 * Gathers project data, selects important files, and assembles a compact payload.
 */
export async function buildAnalysisPayload(
  projectId: string,
  projectPath: string,
  git: GitData,
  stats: ProjectStats
): Promise<AnalysisPayload> {
  // Gather data in parallel
  const [codeSamples, existingPatterns, taskHistory, previousAnalysis] = await Promise.all([
    selectCodeSamples(projectId, projectPath, stats),
    getExistingPatterns(projectId),
    getTaskHistory(projectId),
    getPreviousAnalysisSummary(projectId),
  ])

  return {
    project: {
      name: stats.name,
      ecosystem: stats.ecosystem,
      languages: stats.languages,
      frameworks: stats.frameworks,
      fileCount: stats.fileCount,
      projectType: stats.projectType,
    },
    git: {
      branch: git.branch,
      recentCommits: git.recentCommits.slice(0, MAX_COMMITS).map((c) => ({
        message: c.message,
        date: c.date,
      })),
      hasChanges: git.hasChanges,
      weeklyCommits: git.weeklyCommits,
    },
    codeSamples,
    existingPatterns,
    taskHistory,
    previousAnalysis: previousAnalysis ?? undefined,
  }
}

/**
 * Select the most important code samples using BM25 scoring.
 * Queries for architecture-relevant terms to find key files.
 */
async function selectCodeSamples(
  projectId: string,
  projectPath: string,
  stats: ProjectStats
): Promise<AnalysisPayload['codeSamples']> {
  const samples: AnalysisPayload['codeSamples'] = []

  // Build query terms from project context
  const queryTerms = [
    ...stats.frameworks.map((f) => f.toLowerCase()),
    'config',
    'router',
    'middleware',
    'service',
    'model',
    'schema',
    'database',
    'api',
    'auth',
  ].join(' ')

  const topFiles = queryFiles(projectId, queryTerms, MAX_SAMPLES * 2)

  for (const file of topFiles) {
    if (samples.length >= MAX_SAMPLES) break

    try {
      const fullPath = path.join(projectPath, file.path)
      const content = await fs.readFile(fullPath, 'utf-8')

      // Skip very large or binary files
      if (content.length > MAX_SAMPLE_CHARS * 3) {
        samples.push({
          path: file.path,
          content: `${content.slice(0, MAX_SAMPLE_CHARS)}\n// ... truncated`,
          reason: `BM25 score: ${file.score.toFixed(2)} (truncated, ${content.length} chars)`,
        })
      } else {
        samples.push({
          path: file.path,
          content: content.slice(0, MAX_SAMPLE_CHARS),
          reason: `BM25 score: ${file.score.toFixed(2)}`,
        })
      }
    } catch {
      // File unreadable — skip
    }
  }

  // Always include entry points if not already selected
  const entryPoints = ['package.json', 'tsconfig.json', 'src/index.ts', 'src/main.ts', 'app.ts']
  for (const entry of entryPoints) {
    if (samples.length >= MAX_SAMPLES) break
    if (samples.some((s) => s.path === entry)) continue

    try {
      const fullPath = path.join(projectPath, entry)
      const content = await fs.readFile(fullPath, 'utf-8')
      samples.push({
        path: entry,
        content: content.slice(0, MAX_SAMPLE_CHARS),
        reason: 'entry point',
      })
    } catch {
      // File doesn't exist — skip
    }
  }

  return samples
}

/**
 * Get existing heuristic-detected patterns from the analysis storage.
 */
async function getExistingPatterns(
  projectId: string
): Promise<AnalysisPayload['existingPatterns']> {
  try {
    const analysis = await analysisStorage.getActive(projectId)
    if (!analysis) {
      return { patterns: [], antiPatterns: [] }
    }

    return {
      patterns: (analysis.patterns ?? []).map((p) => ({
        name: p.name,
        description: p.description,
      })),
      antiPatterns: (analysis.antiPatterns ?? []).map((a) => ({
        issue: a.issue,
        file: a.file,
        suggestion: a.suggestion,
      })),
    }
  } catch {
    return { patterns: [], antiPatterns: [] }
  }
}

/**
 * Get recent task history for context.
 */
async function getTaskHistory(projectId: string): Promise<AnalysisPayload['taskHistory']> {
  try {
    const history = await stateStorage.getTaskHistory(projectId)
    return history.slice(0, MAX_TASKS).map((t) => ({
      description: t.title,
      status: t.classification,
      branch: t.branchName,
    }))
  } catch {
    return []
  }
}

/**
 * Get a summary of the previous LLM analysis for delta comparison.
 */
function getPreviousAnalysisSummary(
  projectId: string
): Promise<AnalysisPayload['previousAnalysis'] | null> {
  try {
    const summary = llmAnalysisStorage.getActiveSummary(projectId)
    return Promise.resolve(summary)
  } catch (error) {
    log.debug('Failed to get previous LLM analysis summary', { error })
    return Promise.resolve(null)
  }
}

export default { buildAnalysisPayload }
