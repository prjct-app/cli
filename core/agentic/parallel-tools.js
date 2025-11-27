/**
 * Parallel Tools Executor
 *
 * P3.2: Multi-Tool Parallel Execution
 * Executes independent tool calls in parallel for 2-3x faster execution.
 *
 * Pattern from: Cursor, Windsurf, Claude Code
 *
 * ```
 * // Instead of:
 * const file1 = await read(path1)
 * const file2 = await read(path2)
 * const search = await grep(pattern)
 *
 * // Do:
 * const [file1, file2, search] = await parallel([
 *   { tool: 'Read', args: [path1] },
 *   { tool: 'Read', args: [path2] },
 *   { tool: 'Grep', args: [pattern] }
 * ])
 * ```
 */

const toolRegistry = require('./tool-registry')

/**
 * Tool parallelization rules
 * - parallelizable: Can run alongside other tools
 * - sequential: Must run one at a time
 * - dependencies: Other tools this depends on
 */
const TOOL_RULES = {
  // Read-only tools - fully parallelizable
  Read: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },
  Glob: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },
  Grep: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },
  GetTimestamp: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },
  GetDate: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },
  GetDateTime: {
    parallelizable: true,
    category: 'read',
    dependencies: []
  },

  // Write tools - sequential within same file
  Write: {
    parallelizable: false, // Sequential for same file
    category: 'write',
    dependencies: [],
    conflictsWith: (other) => other.tool === 'Write' && other.args[0] === this.args?.[0]
  },
  Edit: {
    parallelizable: false,
    category: 'write',
    dependencies: ['Read'] // Should read first
  },

  // Bash - sequential (can have side effects)
  Bash: {
    parallelizable: false,
    category: 'execute',
    dependencies: []
  },
  Exec: {
    parallelizable: false,
    category: 'execute',
    dependencies: []
  }
}

class ParallelTools {
  constructor() {
    this.rules = TOOL_RULES
    this.metrics = {
      totalCalls: 0,
      parallelBatches: 0,
      sequentialCalls: 0,
      timeSaved: 0
    }
  }

  /**
   * Execute multiple tool calls, parallelizing where possible
   *
   * @param {Array<{tool: string, args: any[]}>} toolCalls - Array of tool calls
   * @returns {Promise<Array>} Results in same order as input
   */
  async execute(toolCalls) {
    if (!toolCalls || toolCalls.length === 0) {
      return []
    }

    const startTime = Date.now()
    this.metrics.totalCalls += toolCalls.length

    // Group into parallelizable batches
    const batches = this._groupIntoBatches(toolCalls)

    const results = new Array(toolCalls.length)

    // Execute each batch
    for (const batch of batches) {
      if (batch.parallel) {
        // Execute all in parallel
        this.metrics.parallelBatches++
        const batchResults = await Promise.all(
          batch.calls.map(call => this._executeSingle(call))
        )

        // Map results back to original indices
        batch.calls.forEach((call, i) => {
          results[call.originalIndex] = batchResults[i]
        })
      } else {
        // Execute sequentially
        for (const call of batch.calls) {
          this.metrics.sequentialCalls++
          results[call.originalIndex] = await this._executeSingle(call)
        }
      }
    }

    // Calculate time saved (estimate)
    const totalTime = Date.now() - startTime
    const estimatedSequential = toolCalls.length * 50 // ~50ms per call estimate
    this.metrics.timeSaved += Math.max(0, estimatedSequential - totalTime)

    return results
  }

  /**
   * Execute a single tool call
   * @private
   */
  async _executeSingle(call) {
    const tool = toolRegistry.get(call.tool)
    if (!tool) {
      return { error: `Unknown tool: ${call.tool}` }
    }

    try {
      const result = await tool(...(call.args || []))
      return { success: true, result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Group tool calls into batches based on parallelization rules
   * @private
   */
  _groupIntoBatches(toolCalls) {
    const batches = []
    let currentBatch = { parallel: true, calls: [] }

    // Add original indices for result mapping
    const indexedCalls = toolCalls.map((call, index) => ({
      ...call,
      originalIndex: index
    }))

    for (const call of indexedCalls) {
      const rule = this.rules[call.tool] || { parallelizable: false }

      if (rule.parallelizable) {
        // Can add to current parallel batch
        if (currentBatch.parallel) {
          currentBatch.calls.push(call)
        } else {
          // Start new parallel batch
          if (currentBatch.calls.length > 0) {
            batches.push(currentBatch)
          }
          currentBatch = { parallel: true, calls: [call] }
        }
      } else {
        // Must be sequential
        // Flush current batch if exists
        if (currentBatch.calls.length > 0) {
          batches.push(currentBatch)
        }
        // Create sequential batch for this call
        batches.push({ parallel: false, calls: [call] })
        currentBatch = { parallel: true, calls: [] }
      }
    }

    // Don't forget last batch
    if (currentBatch.calls.length > 0) {
      batches.push(currentBatch)
    }

    return batches
  }

  /**
   * Check if a set of tool calls can be parallelized
   *
   * @param {Array<{tool: string, args: any[]}>} toolCalls
   * @returns {boolean}
   */
  canParallelize(toolCalls) {
    return toolCalls.every(call => {
      const rule = this.rules[call.tool]
      return rule && rule.parallelizable
    })
  }

  /**
   * Analyze tool calls and return optimization suggestions
   *
   * @param {Array<{tool: string, args: any[]}>} toolCalls
   * @returns {Object} Analysis with suggestions
   */
  analyze(toolCalls) {
    const readCalls = []
    const writeCalls = []
    const execCalls = []

    for (const call of toolCalls) {
      const rule = this.rules[call.tool] || {}
      switch (rule.category) {
        case 'read':
          readCalls.push(call)
          break
        case 'write':
          writeCalls.push(call)
          break
        case 'execute':
          execCalls.push(call)
          break
      }
    }

    const canParallelizeReads = readCalls.length > 1
    const hasSequentialWrites = writeCalls.length > 1
    const hasExecCalls = execCalls.length > 0

    return {
      total: toolCalls.length,
      reads: readCalls.length,
      writes: writeCalls.length,
      execs: execCalls.length,
      canParallelizeReads,
      hasSequentialWrites,
      hasExecCalls,
      suggestions: this._generateSuggestions({
        canParallelizeReads,
        hasSequentialWrites,
        hasExecCalls,
        readCalls,
        writeCalls
      })
    }
  }

  /**
   * Generate optimization suggestions
   * @private
   */
  _generateSuggestions({ canParallelizeReads, hasSequentialWrites, readCalls, writeCalls }) {
    const suggestions = []

    if (canParallelizeReads) {
      suggestions.push(`Parallelize ${readCalls.length} read operations`)
    }

    if (hasSequentialWrites) {
      // Check for same-file writes
      const files = writeCalls.map(c => c.args?.[0])
      const uniqueFiles = new Set(files)
      if (uniqueFiles.size < files.length) {
        suggestions.push('Multiple writes to same file - must be sequential')
      } else {
        suggestions.push(`Can parallelize ${writeCalls.length} writes to different files`)
      }
    }

    return suggestions
  }

  /**
   * Get execution metrics
   * @returns {Object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: this.metrics.totalCalls > 0
        ? Math.round((this.metrics.parallelBatches / this.metrics.totalCalls) * 100)
        : 0
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      parallelBatches: 0,
      sequentialCalls: 0,
      timeSaved: 0
    }
  }

  /**
   * Convenience method: Parallel read multiple files
   *
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Map<string, string|null>>}
   */
  async readAll(filePaths) {
    const toolCalls = filePaths.map(path => ({
      tool: 'Read',
      args: [path]
    }))

    const results = await this.execute(toolCalls)

    const map = new Map()
    filePaths.forEach((path, i) => {
      map.set(path, results[i]?.result || null)
    })

    return map
  }

  /**
   * Convenience method: Parallel grep search
   *
   * @param {Array<{pattern: string, path: string}>} searches
   * @returns {Promise<Array>}
   */
  async searchAll(searches) {
    const toolCalls = searches.map(s => ({
      tool: 'Grep',
      args: [s.pattern, s.path]
    }))

    return this.execute(toolCalls)
  }
}

module.exports = new ParallelTools()
