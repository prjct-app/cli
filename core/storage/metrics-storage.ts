/**
 * Metrics Storage
 *
 * Schema v2: sync metrics live in typed tables —
 *   - `metrics_daily`       one row per day (date PK): tokens saved, syncs,
 *                           weighted compression rate, total duration
 *   - `metrics_agent_usage` per-agent counters
 *
 * Totals are SQL aggregates over `metrics_daily` (lifetime numbers preserved
 * by migration 52's synthetic pre-history row), so writers and readers can
 * never drift the way the legacy `kv_store['metrics']` blob did — that blob
 * kept running totals nothing else could see, while `prjct product` SUMmed
 * the never-written typed table and reported 0 forever.
 *
 * Tracks: token savings (compression), sync performance, agent usage, daily
 * trends for visualization.
 */

import { type AgentUsage, type DailyStats, estimateCostSaved } from '../schemas/metrics'
import { prjctDb } from './database'

interface DailyRow {
  date: string
  tokens_saved: number
  syncs: number
  avg_compression_rate: number
  total_duration: number
}

const rowToDaily = (r: DailyRow): DailyStats => ({
  date: r.date,
  tokensSaved: r.tokens_saved,
  syncs: r.syncs,
  avgCompressionRate: r.avg_compression_rate,
  totalDuration: r.total_duration,
})

const dayCutoff = (daysAgo: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

class MetricsStorage {
  // =========== Domain Methods ===========

  /**
   * Record a sync event: upsert today's `metrics_daily` row (weighted-average
   * merge for the compression rate) and bump per-agent counters.
   */
  async recordSync(
    projectId: string,
    metrics: {
      originalSize: number // Tokens before compression
      filteredSize: number // Tokens after compression
      duration: number // Sync duration in ms
      isWatch?: boolean // Accepted for API compat; not stored — zero readers
      agents?: string[] // Agents used
    }
  ): Promise<void> {
    const tokensSaved = Math.max(0, metrics.originalSize - metrics.filteredSize)
    const compressionRate = metrics.originalSize > 0 ? tokensSaved / metrics.originalSize : 0
    const today = new Date().toISOString().split('T')[0]

    prjctDb.run(
      projectId,
      `INSERT INTO metrics_daily (date, tokens_saved, syncs, avg_compression_rate, total_duration)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         tokens_saved = metrics_daily.tokens_saved + excluded.tokens_saved,
         avg_compression_rate =
           (metrics_daily.avg_compression_rate * metrics_daily.syncs + excluded.avg_compression_rate)
             / (metrics_daily.syncs + 1),
         syncs = metrics_daily.syncs + 1,
         total_duration = metrics_daily.total_duration + excluded.total_duration`,
      today,
      tokensSaved,
      compressionRate,
      metrics.duration
    )

    if (metrics.agents?.length) {
      const perAgent = Math.floor(tokensSaved / metrics.agents.length)
      for (const agentName of metrics.agents) {
        prjctDb.run(
          projectId,
          `INSERT INTO metrics_agent_usage (agent_name, usage_count, tokens_saved)
           VALUES (?, 1, ?)
           ON CONFLICT(agent_name) DO UPDATE SET
             usage_count = metrics_agent_usage.usage_count + 1,
             tokens_saved = metrics_agent_usage.tokens_saved + excluded.tokens_saved`,
          agentName,
          perAgent
        )
      }
    }
  }

  /**
   * Metrics summary for the dashboard — pure SQL aggregates.
   */
  async getSummary(projectId: string): Promise<{
    totalTokensSaved: number
    estimatedCostSaved: number
    compressionRate: number
    syncCount: number
    avgSyncDuration: number
    topAgents: AgentUsage[]
    last30DaysTokens: number
    trend: number // Percentage change vs previous 30 days
  }> {
    const totals = prjctDb.get<{
      tokens: number
      syncs: number
      duration: number
      weighted_rate: number
    }>(
      projectId,
      `SELECT COALESCE(SUM(tokens_saved), 0) AS tokens,
              COALESCE(SUM(syncs), 0) AS syncs,
              COALESCE(SUM(total_duration), 0) AS duration,
              COALESCE(SUM(avg_compression_rate * syncs), 0) AS weighted_rate
       FROM metrics_daily`
    )
    const syncCount = totals?.syncs ?? 0
    const totalTokensSaved = totals?.tokens ?? 0

    const rangeTokens = (from: string, to?: string): number =>
      prjctDb.get<{ t: number }>(
        projectId,
        to
          ? 'SELECT COALESCE(SUM(tokens_saved), 0) AS t FROM metrics_daily WHERE date >= ? AND date < ?'
          : 'SELECT COALESCE(SUM(tokens_saved), 0) AS t FROM metrics_daily WHERE date >= ?',
        ...(to ? [from, to] : [from])
      )?.t ?? 0

    const last30Tokens = rangeTokens(dayCutoff(30))
    const prev30Tokens = rangeTokens(dayCutoff(60), dayCutoff(30))
    const trend = prev30Tokens > 0 ? ((last30Tokens - prev30Tokens) / prev30Tokens) * 100 : 0

    const topAgents = prjctDb
      .query<{ agent_name: string; usage_count: number; tokens_saved: number }>(
        projectId,
        'SELECT * FROM metrics_agent_usage ORDER BY usage_count DESC LIMIT 5'
      )
      .map((a) => ({
        agentName: a.agent_name,
        usageCount: a.usage_count,
        tokensSaved: a.tokens_saved,
      }))

    return {
      totalTokensSaved,
      estimatedCostSaved: estimateCostSaved(totalTokensSaved),
      compressionRate: syncCount > 0 ? (totals?.weighted_rate ?? 0) / syncCount : 0,
      syncCount,
      avgSyncDuration: syncCount > 0 ? (totals?.duration ?? 0) / syncCount : 0,
      topAgents,
      last30DaysTokens: last30Tokens,
      trend,
    }
  }

  /**
   * Daily stats for a period, oldest → newest.
   */
  async getDailyStats(projectId: string, days: number = 30): Promise<DailyStats[]> {
    return prjctDb
      .query<DailyRow>(
        projectId,
        'SELECT * FROM metrics_daily WHERE date >= ? ORDER BY date ASC',
        dayCutoff(days)
      )
      .map(rowToDaily)
  }

  /**
   * First tracked day (was the blob's `firstSync`) — MIN(date) over the typed
   * rows; empty string when nothing has been tracked yet.
   */
  async getFirstSyncDate(projectId: string): Promise<string> {
    return (
      prjctDb.get<{ d: string | null }>(projectId, 'SELECT MIN(date) AS d FROM metrics_daily')?.d ??
      ''
    )
  }
}

export const metricsStorage = new MetricsStorage()
