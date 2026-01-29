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

import { StorageManager } from './storage-manager'
import { getTimestamp } from '../utils/date-helper'
import {
  type MetricsJson,
  type DailyStats,
  type AgentUsage,
  DEFAULT_METRICS,
  estimateCostSaved,
  formatCost,
} from '../schemas/metrics'

class MetricsStorage extends StorageManager<MetricsJson> {
  constructor() {
    super('metrics.json')
  }

  protected getDefault(): MetricsJson {
    return { ...DEFAULT_METRICS }
  }

  protected getMdFilename(): string {
    return 'metrics.md'
  }

  protected getLayer(): string {
    return 'context'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `metrics.${action}d`
  }

  protected toMarkdown(data: MetricsJson): string {
    const lines = ['# Value Dashboard 📊', '']

    if (data.syncCount === 0) {
      lines.push('_No metrics yet. Run `prjct sync` to start tracking._')
      lines.push('')
      return lines.join('\n')
    }

    // Token Savings
    lines.push('## 💰 Token Savings')
    lines.push('')
    lines.push(`- **Total saved**: ${this.formatTokens(data.totalTokensSaved)} tokens`)
    lines.push(`- **Compression**: ${(data.avgCompressionRate * 100).toFixed(0)}% average reduction`)
    lines.push(`- **Estimated cost saved**: ${formatCost(estimateCostSaved(data.totalTokensSaved))}`)
    lines.push('')

    // Performance
    lines.push('## ⚡ Performance')
    lines.push('')
    lines.push(`- **Syncs completed**: ${data.syncCount.toLocaleString()}`)
    lines.push(`- **Avg sync time**: ${this.formatDuration(data.avgSyncDuration)}`)
    if (data.watchTriggers > 0) {
      lines.push(`- **Watch triggers**: ${data.watchTriggers.toLocaleString()} auto-syncs`)
    }
    lines.push('')

    // Agent Usage
    if (data.agentUsage.length > 0) {
      lines.push('## 🤖 Agent Usage')
      lines.push('')
      const sortedAgents = [...data.agentUsage].sort((a, b) => b.usageCount - a.usageCount)
      const totalUsage = sortedAgents.reduce((sum, a) => sum + a.usageCount, 0)

      sortedAgents.slice(0, 5).forEach(agent => {
        const pct = totalUsage > 0 ? ((agent.usageCount / totalUsage) * 100).toFixed(0) : 0
        lines.push(`- **${agent.agentName}**: ${pct}% (${agent.usageCount} uses)`)
      })
      lines.push('')
    }

    // Trend (last 30 days)
    if (data.dailyStats.length > 0) {
      lines.push('## 📈 30-Day Trend')
      lines.push('')
      const last30 = this.getLast30Days(data.dailyStats)
      const totalLast30 = last30.reduce((sum, d) => sum + d.tokensSaved, 0)
      lines.push(`- **Tokens saved**: ${this.formatTokens(totalLast30)}`)
      lines.push(`- **Syncs**: ${last30.reduce((sum, d) => sum + d.syncs, 0)}`)
      lines.push('')
      lines.push('```')
      lines.push(this.generateSparkline(last30))
      lines.push('```')
      lines.push('')
    }

    // Footer
    lines.push('---')
    lines.push('')
    if (data.firstSync) {
      lines.push(`_Tracking since ${new Date(data.firstSync).toLocaleDateString()}_`)
    }
    lines.push('')

    return lines.join('\n')
  }

  // =========== Domain Methods ===========

  /**
   * Record a sync event with metrics
   */
  async recordSync(
    projectId: string,
    metrics: {
      originalSize: number      // Tokens before compression
      filteredSize: number      // Tokens after compression
      duration: number          // Sync duration in ms
      isWatch?: boolean         // From watch mode?
      agents?: string[]         // Agents used
    }
  ): Promise<void> {
    const tokensSaved = Math.max(0, metrics.originalSize - metrics.filteredSize)
    const compressionRate = metrics.originalSize > 0
      ? tokensSaved / metrics.originalSize
      : 0

    const today = new Date().toISOString().split('T')[0]

    await this.update(projectId, (data) => {
      // Update totals
      const newSyncCount = data.syncCount + 1
      const newTotalTokensSaved = data.totalTokensSaved + tokensSaved
      const newTotalDuration = data.totalSyncDuration + metrics.duration

      // Running average for compression rate
      const newAvgCompression = data.syncCount === 0
        ? compressionRate
        : (data.avgCompressionRate * data.syncCount + compressionRate) / newSyncCount

      // Update daily stats
      const dailyStats = [...data.dailyStats]
      const todayIndex = dailyStats.findIndex(d => d.date === today)

      if (todayIndex >= 0) {
        const existing = dailyStats[todayIndex]
        dailyStats[todayIndex] = {
          ...existing,
          tokensSaved: existing.tokensSaved + tokensSaved,
          syncs: existing.syncs + 1,
          avgCompressionRate: (existing.avgCompressionRate * existing.syncs + compressionRate) / (existing.syncs + 1),
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
      const trimmedStats = dailyStats.filter(d => d.date >= cutoffStr)

      // Update agent usage
      const agentUsage = [...data.agentUsage]
      if (metrics.agents) {
        for (const agentName of metrics.agents) {
          const idx = agentUsage.findIndex(a => a.agentName === agentName)
          if (idx >= 0) {
            agentUsage[idx] = {
              ...agentUsage[idx],
              usageCount: agentUsage[idx].usageCount + 1,
              tokensSaved: agentUsage[idx].tokensSaved + Math.floor(tokensSaved / metrics.agents.length),
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

    const trend = prev30Tokens > 0
      ? ((last30Tokens - prev30Tokens) / prev30Tokens) * 100
      : 0

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
      .filter(d => d.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  // =========== Helper Methods ===========

  private getLast30Days(dailyStats: DailyStats[]): DailyStats[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return dailyStats.filter(d => d.date >= cutoffStr)
  }

  private getPrev30Days(dailyStats: DailyStats[]): DailyStats[] {
    const end = new Date()
    end.setDate(end.getDate() - 30)
    const start = new Date()
    start.setDate(start.getDate() - 60)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    return dailyStats.filter(d => d.date >= startStr && d.date < endStr)
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`
    }
    return tokens.toLocaleString()
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`
    }
    return `${(ms / 1000).toFixed(1)}s`
  }

  private generateSparkline(dailyStats: DailyStats[]): string {
    if (dailyStats.length === 0) return ''

    const chars = '▁▂▃▄▅▆▇█'
    const values = dailyStats.map(d => d.tokensSaved)
    const max = Math.max(...values, 1)

    return values.map(v => {
      const idx = Math.min(Math.floor((v / max) * (chars.length - 1)), chars.length - 1)
      return chars[idx]
    }).join('')
  }
}

export const metricsStorage = new MetricsStorage()
export default metricsStorage
