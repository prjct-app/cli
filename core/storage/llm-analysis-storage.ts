/**
 * LLM Analysis Storage
 *
 * CRUD for structured LLM findings in SQLite.
 * Stores full LLMAnalysis JSON in the `llm_analysis` table.
 *
 * Lifecycle:
 * - New analysis supersedes the previous active one
 * - Only the latest active analysis is used for task context
 * - Old analyses are kept for history (status = 'superseded')
 */

import type { LLMAnalysis } from '../types/llm-analysis'
import { getTimestamp } from '../utils/date-helper'
import { prjctDb } from './database'

class LLMAnalysisStorage {
  /**
   * Save a new LLM analysis, superseding any previous active one.
   */
  save(projectId: string, analysis: LLMAnalysis): void {
    const db = prjctDb.getDb(projectId)
    const now = getTimestamp()

    db.transaction(() => {
      // Supersede previous active analysis
      db.prepare(
        "UPDATE llm_analysis SET status = 'superseded', superseded_at = ? WHERE status = 'active'"
      ).run(now)

      // Insert new active analysis
      db.prepare(
        'INSERT INTO llm_analysis (commit_hash, status, analysis, analyzed_at) VALUES (?, ?, ?, ?)'
      ).run(analysis.commitHash ?? null, 'active', JSON.stringify(analysis), analysis.analyzedAt)
    })()
  }

  /**
   * Get the current active LLM analysis.
   * Returns null if no analysis exists.
   */
  getActive(projectId: string): LLMAnalysis | null {
    const row = prjctDb.get<{ analysis: string }>(
      projectId,
      "SELECT analysis FROM llm_analysis WHERE status = 'active' LIMIT 1"
    )
    if (!row) return null
    return JSON.parse(row.analysis) as LLMAnalysis
  }

  /**
   * Get a summary of the active analysis (for delta comparison).
   */
  getActiveSummary(projectId: string): {
    commitHash: string | null
    architectureStyle: string
    patternCount: number
    antiPatternCount: number
    analyzedAt: string
  } | null {
    const analysis = this.getActive(projectId)
    if (!analysis) return null

    return {
      commitHash: analysis.commitHash,
      architectureStyle: analysis.architecture.style,
      patternCount: analysis.patterns.length,
      antiPatternCount: analysis.antiPatterns.length,
      analyzedAt: analysis.analyzedAt,
    }
  }

  /**
   * Check if analysis exists and is current (matches commit hash).
   */
  isCurrent(projectId: string, commitHash: string | null): boolean {
    if (!commitHash) return false
    const row = prjctDb.get<{ commit_hash: string }>(
      projectId,
      "SELECT commit_hash FROM llm_analysis WHERE status = 'active' LIMIT 1"
    )
    return row?.commit_hash === commitHash
  }

  /**
   * Get history of all analyses (for debugging/audit).
   */
  getHistory(
    projectId: string,
    limit = 10
  ): Array<{
    id: number
    commitHash: string | null
    status: string
    analyzedAt: string
    patternCount: number
  }> {
    const rows = prjctDb.query<{
      id: number
      commit_hash: string | null
      status: string
      analyzed_at: string
      analysis: string
    }>(
      projectId,
      'SELECT id, commit_hash, status, analyzed_at, analysis FROM llm_analysis ORDER BY id DESC LIMIT ?',
      limit
    )

    return rows.map((row) => {
      const analysis = JSON.parse(row.analysis) as LLMAnalysis
      return {
        id: row.id,
        commitHash: row.commit_hash,
        status: row.status,
        analyzedAt: row.analyzed_at,
        patternCount: analysis.patterns.length,
      }
    })
  }
}

export const llmAnalysisStorage = new LLMAnalysisStorage()
export default llmAnalysisStorage
