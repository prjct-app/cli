/**
 * Semantic Compression
 *
 * Compresses raw data into semantic summaries to reduce token usage.
 * Instead of loading full files, provides insights.
 *
 * OPTIMIZATION (P2.3): Semantic Compression
 * - Summarizers for each data type
 * - 70% less tokens for same insight
 * - Metrics tracking
 *
 * Source: Cursor, Windsurf, Kiro patterns
 */

class SemanticCompression {
  constructor() {
    // Track compression metrics
    this.metrics = {
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      compressions: 0
    }
  }

  /**
   * Compress any content based on type
   * @param {string} content - Raw content
   * @param {string} type - Content type (session, shipped, metrics, queue, ideas, roadmap)
   * @returns {Object} Compressed summary
   */
  compress(content, type) {
    if (!content || content.trim() === '') {
      return { summary: 'Empty', tokens: { original: 0, compressed: 0 } }
    }

    const compressor = this._getCompressor(type)
    const result = compressor.call(this, content)

    // Track metrics
    const originalTokens = this._estimateTokens(content)
    const compressedTokens = this._estimateTokens(
      typeof result === 'string' ? result : JSON.stringify(result)
    )

    this.metrics.totalOriginalTokens += originalTokens
    this.metrics.totalCompressedTokens += compressedTokens
    this.metrics.compressions++

    return {
      ...result,
      tokens: {
        original: originalTokens,
        compressed: compressedTokens,
        reduction: Math.round((1 - compressedTokens / originalTokens) * 100)
      }
    }
  }

  /**
   * Get appropriate compressor for type
   * @private
   */
  _getCompressor(type) {
    const compressors = {
      session: this._compressSession,
      shipped: this._compressShipped,
      metrics: this._compressMetrics,
      queue: this._compressQueue,
      ideas: this._compressIdeas,
      roadmap: this._compressRoadmap,
      now: this._compressNow,
      history: this._compressHistory,
      spec: this._compressSpec,
      default: this._compressGeneric
    }
    return compressors[type] || compressors.default
  }

  /**
   * Compress session JSONL data
   * @private
   */
  _compressSession(content) {
    const lines = content.split('\n').filter(l => l.trim())
    const entries = lines.map(l => {
      try { return JSON.parse(l) }
      catch { return null }
    }).filter(Boolean)

    if (entries.length === 0) {
      return { summary: 'No session data', entries: 0 }
    }

    // Group by type
    const byType = {}
    entries.forEach(e => {
      const type = e.type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    })

    // Calculate time range
    const timestamps = entries.map(e => new Date(e.ts)).filter(d => !isNaN(d))
    const earliest = timestamps.length ? new Date(Math.min(...timestamps)) : null
    const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null

    // Calculate duration
    let duration = 'N/A'
    if (earliest && latest) {
      const diffMs = latest - earliest
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }

    return {
      summary: `${entries.length} entries over ${duration}`,
      entries: entries.length,
      byType,
      timeRange: { start: earliest?.toISOString(), end: latest?.toISOString() },
      duration
    }
  }

  /**
   * Compress shipped.md content
   * @private
   */
  _compressShipped(content) {
    const lines = content.split('\n')

    // Count shipped items
    const shipped = lines.filter(l => l.match(/^[-*]\s+/)).length

    // Extract dates
    const dateMatches = content.match(/\d{4}-\d{2}-\d{2}/g) || []
    const uniqueDates = [...new Set(dateMatches)].sort()

    // Detect recent activity
    const today = new Date().toISOString().split('T')[0]
    const hasToday = uniqueDates.includes(today)

    // Calculate velocity (ships per week)
    let velocity = 0
    if (uniqueDates.length > 0) {
      const firstDate = new Date(uniqueDates[0])
      const lastDate = new Date(uniqueDates[uniqueDates.length - 1])
      const weeks = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7))
      velocity = Math.round(shipped / weeks * 10) / 10
    }

    return {
      summary: `${shipped} shipped | ${velocity}/week`,
      shipped,
      dates: uniqueDates.length,
      velocity,
      recentActivity: hasToday,
      dateRange: {
        first: uniqueDates[0] || null,
        last: uniqueDates[uniqueDates.length - 1] || null
      }
    }
  }

  /**
   * Compress metrics.md content
   * @private
   */
  _compressMetrics(content) {
    // Extract key metrics using patterns
    const patterns = {
      totalTasks: /total[:\s]+(\d+)/i,
      completed: /completed[:\s]+(\d+)/i,
      velocity: /velocity[:\s]+([\d.]+)/i,
      streak: /streak[:\s]+(\d+)/i,
      avgTime: /average[:\s]+([\d.]+\s*[hm])/i
    }

    const metrics = {}
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = content.match(pattern)
      if (match) {
        metrics[key] = match[1]
      }
    }

    // Determine momentum
    let momentum = 'medium'
    if (metrics.streak && parseInt(metrics.streak) > 5) momentum = 'high'
    else if (metrics.streak && parseInt(metrics.streak) < 2) momentum = 'low'

    return {
      summary: `${metrics.completed || '?'} done | Momentum: ${momentum}`,
      metrics,
      momentum
    }
  }

  /**
   * Compress queue (next.md) content
   * @private
   */
  _compressQueue(content) {
    const lines = content.split('\n')

    // Count tasks by status
    const pending = (content.match(/- \[ \]/g) || []).length
    const done = (content.match(/- \[x\]/gi) || []).length
    const total = pending + done

    // Extract priorities
    const urgent = lines.filter(l =>
      l.toLowerCase().includes('urgent') ||
      l.toLowerCase().includes('critical') ||
      l.includes('🔥') ||
      l.includes('🚨')
    ).length

    // Get top 3 items
    const taskLines = lines.filter(l => l.match(/^[-*]\s+\[[ x]\]/))
    const top3 = taskLines.slice(0, 3).map(l =>
      l.replace(/^[-*]\s+\[[ x]\]\s*/, '').trim().substring(0, 40)
    )

    return {
      summary: `${pending} pending | ${urgent} urgent`,
      total,
      pending,
      done,
      urgent,
      top3,
      percentComplete: total > 0 ? Math.round(done / total * 100) : 0
    }
  }

  /**
   * Compress ideas.md content
   * @private
   */
  _compressIdeas(content) {
    // Count ideas by section
    const sections = content.split(/^##\s+/m).filter(Boolean)
    const ideaCount = (content.match(/^###\s+/gm) || []).length

    // Detect priorities
    const highPriority = (content.match(/🔥|HIGH|CRITICAL|URGENT/gi) || []).length
    const hasRecent = content.includes(new Date().toISOString().split('T')[0])

    // Extract categories
    const categories = sections.map(s => s.split('\n')[0].trim()).filter(Boolean)

    return {
      summary: `${ideaCount} ideas | ${highPriority} high priority`,
      ideaCount,
      highPriority,
      categories: categories.slice(0, 5),
      hasRecentIdeas: hasRecent
    }
  }

  /**
   * Compress roadmap.md content
   * @private
   */
  _compressRoadmap(content) {
    // Extract phases
    const phases = content.match(/^##\s+Phase\s+\d+/gim) || []

    // Detect status markers
    const completed = (content.match(/✅|COMPLETED?|DONE/gi) || []).length
    const inProgress = (content.match(/🔄|IN.?PROGRESS|CURRENT/gi) || []).length
    const planned = (content.match(/📋|PLANNED|TODO/gi) || []).length

    // Extract current phase
    let currentPhase = 'Unknown'
    const currentMatch = content.match(/##\s+(Phase\s+\d+[^#\n]*)/i)
    if (currentMatch) {
      currentPhase = currentMatch[1].trim()
    }

    // Calculate progress
    const total = completed + inProgress + planned
    const progress = total > 0 ? Math.round(completed / total * 100) : 0

    return {
      summary: `${phases.length} phases | ${progress}% complete`,
      phases: phases.length,
      status: { completed, inProgress, planned },
      currentPhase,
      progress
    }
  }

  /**
   * Compress now.md content
   * @private
   */
  _compressNow(content) {
    if (!content || content.trim() === '') {
      return { summary: 'No active task', hasTask: false }
    }

    // Extract task name
    let taskName = ''
    const boldMatch = content.match(/\*\*([^*]+)\*\*/)
    const headerMatch = content.match(/^#\s+(.+)$/m)

    if (boldMatch) taskName = boldMatch[1]
    else if (headerMatch) taskName = headerMatch[1]
    else taskName = content.split('\n')[0].substring(0, 50)

    // Extract start time
    const timeMatch = content.match(/Started:\s*(\d{4}-\d{2}-\d{2}T[\d:]+)/i)
    let duration = ''
    if (timeMatch) {
      const start = new Date(timeMatch[1])
      const now = new Date()
      const diffMs = now - start
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }

    // Extract agent if present
    const agentMatch = content.match(/Agent:\s*(\w+)/i)

    return {
      summary: `🎯 ${taskName.substring(0, 30)}${duration ? ` (${duration})` : ''}`,
      hasTask: true,
      taskName,
      duration,
      agent: agentMatch ? agentMatch[1] : null
    }
  }

  /**
   * Compress JSONL history content
   * @private
   */
  _compressHistory(content) {
    const lines = content.split('\n').filter(l => l.trim())
    const entries = lines.map(l => {
      try { return JSON.parse(l) }
      catch { return null }
    }).filter(Boolean)

    if (entries.length === 0) {
      return { summary: 'No history', entries: 0 }
    }

    // Get last 5 entries summary
    const recent = entries.slice(-5).map(e => ({
      type: e.type,
      ts: e.ts
    }))

    // Count by type
    const byType = {}
    entries.forEach(e => {
      const type = e.type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    })

    return {
      summary: `${entries.length} events`,
      entries: entries.length,
      recent,
      byType,
      lastEntry: entries[entries.length - 1]?.ts || null
    }
  }

  /**
   * Compress spec file content
   * @private
   */
  _compressSpec(content) {
    if (!content || content.trim() === '') {
      return { summary: 'No spec content', hasSpec: false }
    }

    const lines = content.split('\n')

    // Extract spec name from header
    const headerMatch = content.match(/^#\s+(.+)$/m)
    const specName = headerMatch ? headerMatch[1] : 'Unnamed Spec'

    // Count sections
    const sections = (content.match(/^##\s+/gm) || []).length

    // Extract requirements count
    const requirements = lines.filter(l =>
      l.match(/^[-*]\s+/) && !l.match(/\[[ x]\]/)
    ).length

    // Extract tasks count (checkboxes)
    const tasks = (content.match(/- \[ \]/g) || []).length
    const completedTasks = (content.match(/- \[x\]/gi) || []).length
    const totalTasks = tasks + completedTasks

    // Detect status markers
    const hasApproval = content.toLowerCase().includes('approved')
    const hasDraft = content.toLowerCase().includes('draft')
    const hasBlocked = content.toLowerCase().includes('blocked')

    // Determine status
    let status = 'draft'
    if (hasApproval) status = 'approved'
    else if (hasBlocked) status = 'blocked'
    else if (hasDraft) status = 'draft'

    // Extract design decisions count
    const decisions = (content.match(/^###\s+/gm) || []).length

    // Calculate progress
    const progress = totalTasks > 0
      ? Math.round(completedTasks / totalTasks * 100)
      : 0

    return {
      summary: `📋 ${specName} | ${sections} sections | ${totalTasks} tasks (${progress}%)`,
      hasSpec: true,
      specName,
      sections,
      requirements,
      tasks: totalTasks,
      completedTasks,
      decisions,
      status,
      progress
    }
  }

  /**
   * Generic compression for unknown types
   * @private
   */
  _compressGeneric(content) {
    const lines = content.split('\n')
    const nonEmpty = lines.filter(l => l.trim()).length

    return {
      summary: `${nonEmpty} lines`,
      lines: lines.length,
      nonEmpty,
      preview: content.substring(0, 100).replace(/\n/g, ' ')
    }
  }

  /**
   * Estimate token count (rough approximation)
   * ~4 characters per token for English text
   * @private
   */
  _estimateTokens(text) {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  /**
   * Get compression metrics
   * @returns {Object}
   */
  getMetrics() {
    const reduction = this.metrics.totalOriginalTokens > 0
      ? Math.round((1 - this.metrics.totalCompressedTokens / this.metrics.totalOriginalTokens) * 100)
      : 0

    return {
      ...this.metrics,
      reductionPercent: reduction,
      averageReduction: this.metrics.compressions > 0
        ? Math.round(reduction / this.metrics.compressions)
        : 0
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      compressions: 0
    }
  }

  /**
   * Compress multiple contents at once
   * @param {Object} contents - Map of type -> content
   * @returns {Object} Map of type -> compressed
   */
  compressAll(contents) {
    const result = {}
    for (const [type, content] of Object.entries(contents)) {
      result[type] = this.compress(content, type)
    }
    return result
  }

  /**
   * Format compressed data for context
   * @param {Object} compressed - Result from compress()
   * @returns {string}
   */
  format(compressed) {
    if (!compressed) return ''

    if (typeof compressed.summary === 'string') {
      return compressed.summary
    }

    return JSON.stringify(compressed, null, 2)
  }
}

module.exports = new SemanticCompression()
