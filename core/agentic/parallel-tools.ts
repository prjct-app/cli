/**
 * Parallel Tools
 * Execute multiple tools in parallel for performance
 *
 * @module agentic/parallel-tools
 * @version 1.0.0
 */

import fs from 'fs/promises'

interface ToolCall {
  tool: string
  args: unknown[]
}

interface ToolResult {
  tool: string
  success: boolean
  result?: unknown
  error?: string
  duration: number
}

interface ParallelMetrics {
  totalCalls: number
  parallelCalls: number
  sequentialCalls: number
  averageDuration: number
  savedTime: number
}

class ParallelTools {
  private metrics: ParallelMetrics

  constructor() {
    this.metrics = {
      totalCalls: 0,
      parallelCalls: 0,
      sequentialCalls: 0,
      averageDuration: 0,
      savedTime: 0,
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const startTime = Date.now()

    const promises = toolCalls.map(async (call) => {
      const callStart = Date.now()
      try {
        const result = await this.executeOne(call.tool, call.args)
        return {
          tool: call.tool,
          success: true,
          result,
          duration: Date.now() - callStart,
        }
      } catch (error) {
        return {
          tool: call.tool,
          success: false,
          error: (error as Error).message,
          duration: Date.now() - callStart,
        }
      }
    })

    const results = await Promise.all(promises)

    // Update metrics
    const totalDuration = Date.now() - startTime
    const sumIndividual = results.reduce((sum, r) => sum + r.duration, 0)
    this.metrics.totalCalls += toolCalls.length
    this.metrics.parallelCalls += toolCalls.length
    this.metrics.savedTime += sumIndividual - totalDuration
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalCalls - toolCalls.length) + totalDuration) /
      this.metrics.totalCalls

    return results
  }

  /**
   * Execute a single tool
   */
  private async executeOne(tool: string, args: unknown[]): Promise<unknown> {
    switch (tool) {
      case 'Read':
        return await fs.readFile(args[0] as string, 'utf-8')

      case 'Write':
        await fs.writeFile(args[0] as string, args[1] as string, 'utf-8')
        return true

      case 'GetTimestamp':
        return new Date().toISOString()

      case 'GetDate':
        return new Date().toISOString().split('T')[0]

      default:
        throw new Error(`Unknown tool: ${tool}`)
    }
  }

  /**
   * Read multiple files in parallel
   */
  async readAll(paths: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>()

    const promises = paths.map(async (path) => {
      try {
        const content = await fs.readFile(path, 'utf-8')
        return { path, content }
      } catch {
        return { path, content: null }
      }
    })

    const readResults = await Promise.all(promises)

    readResults.forEach(({ path, content }) => {
      results.set(path, content)
    })

    return results
  }

  /**
   * Check if tools can be parallelized
   */
  canParallelize(tools: string[]): boolean {
    // Read operations can always be parallelized
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'GetTimestamp', 'GetDate']
    return tools.every((tool) => readOnlyTools.includes(tool))
  }

  /**
   * Get parallelization metrics
   */
  getMetrics(): ParallelMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCalls: 0,
      parallelCalls: 0,
      sequentialCalls: 0,
      averageDuration: 0,
      savedTime: 0,
    }
  }
}

const parallelTools = new ParallelTools()
export default parallelTools
export { ParallelTools }
