/**
 * Metrics Storage
 *
 * Manages value dashboard metrics via storage/metrics.json
 * Generates context/metrics.md for Claude
 *
 * Tracks:
 * - Token savings (compression)
 * - Sync performance
 * - Agent usage
 * - Daily trends for visualization
 */

import {
  type AgentUsage,
  type DailyStats,
  DEFAULT_METRICS,
  estimateCostSaved,
  type MetricsJson,
  MetricsJsonSchema,
} from '../schemas/metrics'
import { getTimestamp } from '../utils/date-helper'
import { StorageManager } from './storage-manager'

class MetricsStorage extends StorageManager<MetricsJson> {
  constructor() {
    super('metrics.json', MetricsJsonSchema)
  }

  protected getDefault(): MetricsJson {
    return { ...DEFAULT_METRICS }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `metrics.${action}d`
  }

  // =========== Domain Methods ===========

  /**
   * Record a sync event with metrics
   */
  async recordSync(
    projectId: string,
    metrics: {
      originalSize: number // Tokens before compression
      filteredSize: number // Tokens after compression
      duration: number // Sync duration in ms
      isWatch?: boolean // From watch mode?
      agents?: string[] // Agents used
    }
  ): Promise<void> {
    const tokensSaved = Math.max(0, metrics.originalSize - metrics.filteredSize)
    const compressionRate = metrics.originalSize > 0 ? tokensSaved / metrics.originalSize : 0

    const today = new Date().toISOString().split('T')[0]

    await this.update(projectId, (data) => {
      // Update totals
      const newSyncCount = data.syncCount + 1
      const newTotalTokensSaved = data.totalTokensSaved + tokensSaved
      const newTotalDuration = data.totalSyncDuration + metrics.duration

      // Running average for compression rate
      const newAvgCompression =
        data.syncCount === 0
          ? compressionRate
          : (data.avgCompressionRate * data.syncCount + compressionRate) / newSyncCount

      // Update daily stats
      const dailyStats = [...data.dailyStats]
      const todayIndex = dailyStats.findIndex((d) => d.date === today)

      if (todayIndex >= 0) {
        const existing = dailyStats[todayIndex]
        dailyStats[todayIndex] = {
          ...existing,
          tokensSaved: existing.tokensSaved + tokensSaved,
          syncs: existing.syncs + 1,
          avgCompressionRate:
            (existing.avgCompressionRate * existing.syncs + compressionRate) / (existing.syncs + 1),
          totalDuration: existing.totalDuration + metrics.duration,
        }
      } else {
        dailyStats.push({
          date: today,
          tokensSaved,
          syncs: 1,
          avgCompressionRate: compressionRate,
          totalDuration: metrics.duration,
        })
      }

      // Keep only last 90 days
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      const cutoffStr = cutoff.toISOString().split('T')[0]
      const trimmedStats = dailyStats.filter((d) => d.date >= cutoffStr)

      // Update agent usage
      const agentUsage = [...data.agentUsage]
      if (metrics.agents) {
        for (const agentName of metrics.agents) {
          const idx = agentUsage.findIndex((a) => a.agentName === agentName)
          if (idx >= 0) {
            agentUsage[idx] = {
              ...agentUsage[idx],
              usageCount: agentUsage[idx].usageCount + 1,
              tokensSaved:
                agentUsage[idx].tokensSaved + Math.floor(tokensSaved / metrics.agents.length),
            }
          } else {
            agentUsage.push({
              agentName,
              usageCount: 1,
              tokensSaved: Math.floor(tokensSaved / metrics.agents.length),
            })
          }
        }
      }

      return {
        totalTokensSaved: newTotalTokensSaved,
        avgCompressionRate: newAvgCompression,
        syncCount: newSyncCount,
        watchTriggers: data.watchTriggers + (metrics.isWatch ? 1 : 0),
        avgSyncDuration: newTotalDuration / newSyncCount,
        totalSyncDuration: newTotalDuration,
        agentUsage,
        dailyStats: trimmedStats,
        firstSync: data.firstSync || getTimestamp(),
        lastUpdated: getTimestamp(),
      }
    })
  }

  /**
   * Get metrics summary for dashboard
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
    const data = await this.read(projectId)

    const last30 = this.getLast30Days(data.dailyStats)
    const prev30 = this.getPrev30Days(data.dailyStats)

    const last30Tokens = last30.reduce((sum, d) => sum + d.tokensSaved, 0)
    const prev30Tokens = prev30.reduce((sum, d) => sum + d.tokensSaved, 0)

    const trend = prev30Tokens > 0 ? ((last30Tokens - prev30Tokens) / prev30Tokens) * 100 : 0

    return {
      totalTokensSaved: data.totalTokensSaved,
      estimatedCostSaved: estimateCostSaved(data.totalTokensSaved),
      compressionRate: data.avgCompressionRate,
      syncCount: data.syncCount,
      avgSyncDuration: data.avgSyncDuration,
      topAgents: [...data.agentUsage].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
      last30DaysTokens: last30Tokens,
      trend,
    }
  }

  /**
   * Get daily stats for a period
   */
  async getDailyStats(projectId: string, days: number = 30): Promise<DailyStats[]> {
    const data = await this.read(projectId)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    return data.dailyStats
      .filter((d) => d.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private getLast30Days(dailyStats: DailyStats[]): DailyStats[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return dailyStats.filter((d) => d.date >= cutoffStr)
  }

  private getPrev30Days(dailyStats: DailyStats[]): DailyStats[] {
    const end = new Date()
    end.setDate(end.getDate() - 30)
    const start = new Date()
    start.setDate(start.getDate() - 60)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    return dailyStats.filter((d) => d.date >= startStr && d.date < endStr)
  }
}

export const metricsStorage = new MetricsStorage()
export default metricsStorage
