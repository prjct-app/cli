/**
 * Semantic Compression
 * Compresses context while preserving meaning
 *
 * @module agentic/semantic-compression
 * @version 1.0.0
 */

interface CompressionResult {
  summary: string
  originalLength: number
  compressedLength: number
  ratio: number
  key: string
}

interface CompressionMetrics {
  totalOriginal: number
  totalCompressed: number
  overallRatio: number
  compressions: number
}

class SemanticCompression {
  private metrics: CompressionMetrics

  constructor() {
    this.metrics = {
      totalOriginal: 0,
      totalCompressed: 0,
      overallRatio: 1,
      compressions: 0,
    }
  }

  /**
   * Compress content while preserving semantic meaning
   */
  compress(content: string, key: string): CompressionResult {
    if (!content || !content.trim()) {
      return {
        summary: 'Empty',
        originalLength: 0,
        compressedLength: 0,
        ratio: 1,
        key,
      }
    }

    const originalLength = content.length
    let summary: string

    // Apply key-specific compression strategies
    switch (key) {
      case 'now':
        summary = this.compressNow(content)
        break
      case 'next':
        summary = this.compressNext(content)
        break
      case 'shipped':
        summary = this.compressShipped(content)
        break
      case 'analysis':
        summary = this.compressAnalysis(content)
        break
      case 'roadmap':
        summary = this.compressRoadmap(content)
        break
      case 'codePatterns':
        summary = this.compressCodePatterns(content)
        break
      default:
        summary = this.compressGeneric(content)
    }

    const compressedLength = summary.length
    const ratio = originalLength > 0 ? compressedLength / originalLength : 1

    // Update metrics
    this.metrics.totalOriginal += originalLength
    this.metrics.totalCompressed += compressedLength
    this.metrics.compressions++
    this.metrics.overallRatio =
      this.metrics.totalOriginal > 0 ? this.metrics.totalCompressed / this.metrics.totalOriginal : 1

    return {
      summary,
      originalLength,
      compressedLength,
      ratio,
      key,
    }
  }

  /**
   * Compress now.md content
   */
  private compressNow(content: string): string {
    // Extract task description
    const taskMatch = content.match(/task:\s*["']?([^"'\n]+)["']?/i) || content.match(/#+\s*(.+)/m)
    const task = taskMatch ? taskMatch[1].trim() : 'Unknown task'

    // Extract started time
    const startedMatch = content.match(/started:\s*(.+)/i)
    const started = startedMatch ? startedMatch[1].trim() : ''

    // Extract agent if present
    const agentMatch = content.match(/agent:\s*(.+)/i)
    const agent = agentMatch ? agentMatch[1].trim() : ''

    let summary = `Task: ${task}`
    if (started) summary += ` | Started: ${started}`
    if (agent) summary += ` | Agent: ${agent}`

    return summary
  }

  /**
   * Compress next.md content
   */
  private compressNext(content: string): string {
    // Count tasks
    const pending = (content.match(/- \[ \]/g) || []).length
    const completed = (content.match(/- \[x\]/gi) || []).length
    const total = pending + completed

    // Get first few pending tasks
    const taskLines = content.match(/- \[ \] .+/g) || []
    const topTasks = taskLines.slice(0, 3).map((t) => t.replace('- [ ] ', '').trim())

    let summary = `Queue: ${pending} pending, ${completed} done (${total} total)`
    if (topTasks.length > 0) {
      summary += ` | Next: ${topTasks.join(', ')}`
    }

    return summary
  }

  /**
   * Compress shipped.md content
   */
  private compressShipped(content: string): string {
    // Count shipped items
    const shipped = (content.match(/^##\s+/gm) || []).length
    const lines = content.split('\n')

    // Get most recent ship
    let recentShip = ''
    for (const line of lines) {
      if (line.startsWith('## ')) {
        recentShip = line.replace('## ', '').trim()
        break
      }
    }

    let summary = `Shipped: ${shipped} items`
    if (recentShip) summary += ` | Recent: ${recentShip.substring(0, 50)}`

    return summary
  }

  /**
   * Compress analysis content
   */
  private compressAnalysis(content: string): string {
    // Extract stack
    const stackMatch =
      content.match(/stack[:\s]+([^\n]+)/i) ||
      content.match(/technology[:\s]+([^\n]+)/i) ||
      content.match(/framework[:\s]+([^\n]+)/i)
    const stack = stackMatch ? stackMatch[1].trim() : 'Unknown'

    // Extract file count if present
    const filesMatch = content.match(/(\d+)\s*files/i)
    const files = filesMatch ? filesMatch[1] : ''

    // Extract language
    const langMatch = content.match(/language[:\s]+([^\n]+)/i) || content.match(/primary[:\s]+([^\n]+)/i)
    const language = langMatch ? langMatch[1].trim() : ''

    let summary = `Stack: ${stack}`
    if (language) summary += ` | Language: ${language}`
    if (files) summary += ` | Files: ${files}`

    return summary
  }

  /**
   * Compress roadmap content
   */
  private compressRoadmap(content: string): string {
    // Count features
    const features = (content.match(/^##\s+/gm) || []).length

    // Get feature names
    const featureNames: string[] = []
    const matches = content.match(/^##\s+(.+)/gm) || []
    matches.slice(0, 3).forEach((m) => {
      featureNames.push(m.replace(/^##\s+/, '').trim())
    })

    let summary = `Roadmap: ${features} features`
    if (featureNames.length > 0) {
      summary += ` | Top: ${featureNames.join(', ')}`
    }

    return summary
  }

  /**
   * Compress code patterns content
   */
  private compressCodePatterns(content: string): string {
    // Extract conventions section
    const conventionsMatch = content.match(/## Conventions[\s\S]*?(?=##|$)/i)
    let conventions = ''
    if (conventionsMatch) {
      const lines = conventionsMatch[0]
        .split('\n')
        .filter((l) => l.includes(':') || l.startsWith('-'))
        .slice(0, 3)
      conventions = lines.join(' | ')
    }

    // Check for anti-patterns
    const hasAntiPatterns = content.toLowerCase().includes('anti-pattern')

    let summary = 'Code patterns loaded'
    if (conventions) summary += ` | ${conventions.substring(0, 100)}`
    if (hasAntiPatterns) summary += ' | Has anti-patterns'

    return summary
  }

  /**
   * Generic compression
   */
  private compressGeneric(content: string): string {
    // Take first meaningful lines
    const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    const preview = lines.slice(0, 2).join(' | ')

    if (preview.length > 150) {
      return preview.substring(0, 150) + '...'
    }

    return preview || 'Content available'
  }

  /**
   * Get compression metrics
   */
  getMetrics(): CompressionMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOriginal: 0,
      totalCompressed: 0,
      overallRatio: 1,
      compressions: 0,
    }
  }
}

const semanticCompression = new SemanticCompression()
export default semanticCompression
export { SemanticCompression }
