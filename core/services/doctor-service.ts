/**
 * DoctorService - System health checks and diagnostics
 *
 * Checks:
 * - Required tools (git, node)
 * - Optional tools (bun, gh, claude, gemini)
 * - Project configuration
 * - Generated file staleness
 * - Provides actionable recommendations
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import out from '../utils/output'
import { VERSION } from '../utils/version'

// ============================================================================
// TYPES
// ============================================================================

interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'error'
  version?: string
  message?: string
  optional?: boolean
}

interface DoctorResult {
  success: boolean
  tools: CheckResult[]
  project: CheckResult[]
  recommendations: string[]
  hasErrors: boolean
  hasWarnings: boolean
}

// ============================================================================
// DOCTOR SERVICE
// ============================================================================

class DoctorService {
  private projectPath: string = ''
  private projectId: string | null = null
  private globalPath: string = ''

  /**
   * Run all health checks
   */
  async check(projectPath: string = process.cwd()): Promise<DoctorResult> {
    this.projectPath = projectPath
    this.projectId = await configManager.getProjectId(projectPath)
    if (this.projectId) {
      this.globalPath = pathManager.getGlobalProjectPath(this.projectId)
    }

    const tools = await this.checkTools()
    const project = await this.checkProject()
    const recommendations = this.generateRecommendations(tools, project)

    const hasErrors = [...tools, ...project].some((c) => c.status === 'error' && !c.optional)
    const hasWarnings = [...tools, ...project].some(
      (c) => c.status === 'warn' || (c.status === 'error' && c.optional)
    )

    return {
      success: !hasErrors,
      tools,
      project,
      recommendations,
      hasErrors,
      hasWarnings,
    }
  }

  /**
   * Run checks and print formatted output
   */
  async run(projectPath: string = process.cwd()): Promise<number> {
    const result = await this.check(projectPath)

    this.printHeader()
    this.printSection('System Tools', result.tools)
    this.printSection('Project Status', result.project)

    if (result.recommendations.length > 0) {
      this.printRecommendations(result.recommendations)
    }

    this.printSummary(result)

    return result.hasErrors ? 1 : 0
  }

  // ==========================================================================
  // TOOL CHECKS
  // ==========================================================================

  private async checkTools(): Promise<CheckResult[]> {
    const checks: CheckResult[] = []

    // Git (required)
    checks.push(this.checkCommand('git', 'git --version', /git version ([\d.]+)/, false))

    // Node (required)
    checks.push(this.checkCommand('node', 'node --version', /v([\d.]+)/, false))

    // Bun (optional)
    checks.push(this.checkCommand('bun', 'bun --version', /([\d.]+)/, true))

    // GitHub CLI (optional)
    checks.push(
      this.checkCommand('gh', 'gh --version', /gh version ([\d.]+)/, true, 'needed for PR commands')
    )

    // Claude Code (optional)
    checks.push(
      this.checkCommand(
        'claude',
        'claude --version',
        /claude ([\d.]+)/,
        true,
        'Anthropic Claude Code CLI'
      )
    )

    // Gemini CLI (optional)
    checks.push(
      this.checkCommand('gemini', 'gemini --version', /gemini ([\d.]+)/, true, 'Google Gemini CLI')
    )

    return checks
  }

  private checkCommand(
    name: string,
    command: string,
    versionRegex: RegExp,
    optional: boolean,
    description?: string
  ): CheckResult {
    try {
      const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
      const match = output.match(versionRegex)
      const version = match ? match[1] : 'unknown'

      return {
        name,
        status: 'ok',
        version,
        optional,
      }
    } catch {
      return {
        name,
        status: 'error',
        message: description ? `not found (${description})` : 'not found',
        optional,
      }
    }
  }

  // ==========================================================================
  // PROJECT CHECKS
  // ==========================================================================

  private async checkProject(): Promise<CheckResult[]> {
    const checks: CheckResult[] = []

    // prjct config
    checks.push(await this.checkPrjctConfig())

    // CLAUDE.md
    checks.push(await this.checkClaudeMd())

    // Git repo
    checks.push(await this.checkGitRepo())

    // State file
    checks.push(await this.checkStateFile())

    return checks
  }

  private async checkPrjctConfig(): Promise<CheckResult> {
    const configPath = path.join(this.projectPath, '.prjct', 'prjct.config.json')

    try {
      await fs.access(configPath)
      return {
        name: 'prjct config',
        status: 'ok',
        message: 'initialized',
      }
    } catch {
      return {
        name: 'prjct config',
        status: 'error',
        message: 'not initialized - run "prjct init"',
      }
    }
  }

  private async checkClaudeMd(): Promise<CheckResult> {
    if (!this.globalPath) {
      return {
        name: 'CLAUDE.md',
        status: 'warn',
        message: 'project not initialized',
      }
    }

    const claudePath = path.join(this.globalPath, 'context', 'CLAUDE.md')

    try {
      const stat = await fs.stat(claudePath)
      const ageMs = Date.now() - stat.mtimeMs
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60))
      const ageDays = Math.floor(ageHours / 24)

      let ageStr: string
      if (ageDays > 0) {
        ageStr = `${ageDays} day${ageDays > 1 ? 's' : ''} ago`
      } else if (ageHours > 0) {
        ageStr = `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`
      } else {
        ageStr = 'recently'
      }

      // Warn if older than 24 hours
      if (ageHours > 24) {
        return {
          name: 'CLAUDE.md',
          status: 'warn',
          message: `stale (last sync: ${ageStr})`,
        }
      }

      return {
        name: 'CLAUDE.md',
        status: 'ok',
        message: `synced ${ageStr}`,
      }
    } catch {
      return {
        name: 'CLAUDE.md',
        status: 'error',
        message: 'not found - run "prjct sync"',
      }
    }
  }

  private async checkGitRepo(): Promise<CheckResult> {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })
      const hasChanges = status.trim().length > 0

      if (hasChanges) {
        const lines = status.trim().split('\n').filter(Boolean)
        return {
          name: 'git repo',
          status: 'ok',
          message: `${lines.length} uncommitted change${lines.length > 1 ? 's' : ''}`,
        }
      }

      return {
        name: 'git repo',
        status: 'ok',
        message: 'clean',
      }
    } catch {
      return {
        name: 'git repo',
        status: 'warn',
        message: 'not a git repository',
      }
    }
  }

  private async checkStateFile(): Promise<CheckResult> {
    if (!this.globalPath) {
      return {
        name: 'task state',
        status: 'warn',
        message: 'project not initialized',
      }
    }

    const statePath = path.join(this.globalPath, 'storage', 'state.json')

    try {
      const content = await fs.readFile(statePath, 'utf-8')
      const state = JSON.parse(content)

      if (state.currentTask) {
        return {
          name: 'task state',
          status: 'ok',
          message: `active: ${state.currentTask.description?.slice(0, 30)}...`,
        }
      }

      return {
        name: 'task state',
        status: 'ok',
        message: 'no active task',
      }
    } catch {
      return {
        name: 'task state',
        status: 'ok',
        message: 'no state file (normal for new projects)',
        optional: true,
      }
    }
  }

  // ==========================================================================
  // RECOMMENDATIONS
  // ==========================================================================

  private generateRecommendations(tools: CheckResult[], project: CheckResult[]): string[] {
    const recommendations: string[] = []

    // Check for missing optional tools
    const missingGh = tools.find((t) => t.name === 'gh' && t.status === 'error')
    if (missingGh) {
      recommendations.push('Install GitHub CLI (gh) for PR commands: https://cli.github.com')
    }

    // Check for stale CLAUDE.md
    const claudeCheck = project.find((p) => p.name === 'CLAUDE.md')
    if (claudeCheck?.status === 'warn' && claudeCheck.message?.includes('stale')) {
      recommendations.push('Run "prjct sync" to update context')
    }

    // Check for missing init
    const configCheck = project.find((p) => p.name === 'prjct config')
    if (configCheck?.status === 'error') {
      recommendations.push('Run "prjct init" to initialize this project')
    }

    // Check for missing CLAUDE.md
    const claudeMissing = project.find((p) => p.name === 'CLAUDE.md' && p.status === 'error')
    if (claudeMissing && !configCheck?.status?.includes('error')) {
      recommendations.push('Run "prjct sync" to generate context files')
    }

    return recommendations
  }

  // ==========================================================================
  // OUTPUT
  // ==========================================================================

  private printHeader(): void {
    out.section(`prjct doctor v${VERSION}`)
  }

  private printSection(title: string, checks: CheckResult[]): void {
    out.section(title)

    const items = checks.map((check) => {
      const icon = this.getStatusIcon(check.status, check.optional)
      const name = check.name.padEnd(14)
      const detail = check.version || check.message || ''
      const optionalTag = check.optional && check.status === 'error' ? chalk.dim(' (optional)') : ''
      return `${icon} ${name} ${chalk.dim(detail)}${optionalTag}`
    })

    for (const item of items) {
      console.log(`  ${item}`)
    }
  }

  private printRecommendations(recommendations: string[]): void {
    out.section('Recommendations')
    out.list(recommendations, { bullet: chalk.yellow('•') })
  }

  private printSummary(result: DoctorResult): void {
    console.log('')
    console.log(chalk.dim('─'.repeat(40)))

    if (result.hasErrors) {
      out.fail('Some required checks failed')
    } else if (result.hasWarnings) {
      out.warn('All required checks passed (some warnings)')
    } else {
      out.done('All checks passed')
    }

    console.log('')
  }

  private getStatusIcon(status: 'ok' | 'warn' | 'error', optional?: boolean): string {
    switch (status) {
      case 'ok':
        return chalk.green('✓')
      case 'warn':
        return chalk.yellow('⚠')
      case 'error':
        return optional ? chalk.dim('○') : chalk.red('✗')
    }
  }
}

export const doctorService = new DoctorService()
export { DoctorService, type DoctorResult, type CheckResult }
