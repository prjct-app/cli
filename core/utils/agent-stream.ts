/**
 * Agent Activity Stream
 *
 * Shows real-time agent activity during task execution.
 * Provides visibility into which agents are working and what they're doing.
 */

import chalk from 'chalk'

/**
 * Domain icons for visual identification
 */
const DOMAIN_ICONS: Record<string, string> = {
  database: '💾',
  backend: '🔧',
  frontend: '📦',
  testing: '🧪',
  devops: '🚀',
  uxui: '🎨',
  security: '🔒',
  docs: '📝',
  api: '🌐',
  default: '⚡',
}

/**
 * Get icon for a domain
 */
function getIcon(domain: string): string {
  return DOMAIN_ICONS[domain.toLowerCase()] || DOMAIN_ICONS.default
}

/**
 * Agent Stream - Visual activity tracker
 */
class AgentStream {
  private currentAgent: string | null = null
  private startTime: number = 0
  private quiet: boolean = false

  /**
   * Set quiet mode (no output)
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet
  }

  /**
   * Show orchestration start
   */
  orchestrate(domains: string[]): void {
    if (this.quiet) return
    console.log(chalk.cyan(`\n🎯 Orchestrating: ${domains.join(', ')} domains detected\n`))
  }

  /**
   * Start an agent activity block
   */
  startAgent(name: string, domain: string, description?: string): void {
    if (this.quiet) return

    this.currentAgent = name
    this.startTime = Date.now()

    const icon = getIcon(domain)
    console.log(chalk.cyan(`┌─ ${icon} ${name} (${domain})`))

    if (description) {
      console.log(chalk.dim(`│  ${description}`))
    }
  }

  /**
   * Show progress within current agent
   */
  progress(message: string): void {
    if (this.quiet || !this.currentAgent) return
    console.log(chalk.dim(`│  └── ${message}`))
  }

  /**
   * Show multiple progress items
   */
  progressList(items: string[]): void {
    if (this.quiet || !this.currentAgent) return
    for (const item of items) {
      console.log(chalk.dim(`│  └── ${item}`))
    }
  }

  /**
   * End current agent block
   */
  endAgent(success: boolean = true): void {
    if (this.quiet || !this.currentAgent) return

    const duration = Date.now() - this.startTime
    const durationStr = this.formatDuration(duration)

    const icon = success ? chalk.green('✓') : chalk.red('✗')
    const status = success ? 'Complete' : 'Failed'

    console.log(`└─ ${icon} ${status} ${chalk.dim(`(${durationStr})`)}\n`)
    this.currentAgent = null
  }

  /**
   * Show a simple status line (no block)
   */
  status(icon: string, message: string): void {
    if (this.quiet) return
    console.log(`${icon} ${message}`)
  }

  /**
   * Show task completion summary
   */
  complete(taskName: string, totalDuration?: number): void {
    if (this.quiet) return

    const durationStr = totalDuration ? ` ${chalk.dim(`[${this.formatDuration(totalDuration)}]`)}` : ''
    console.log(chalk.green(`✅ ${taskName}${durationStr}`))
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    const seconds = (ms / 1000).toFixed(1)
    return `${seconds}s`
  }
}

// Singleton instance
export const agentStream = new AgentStream()

export default agentStream
