/**
 * `prjct mcp` — list, deny, allow MCP servers per-project.
 *
 * Subcommands:
 *   list                Show every MCP prjct knows about + its state in
 *                       this project + estimated context cost.
 *   deny <serverName>   Add to .claude/settings.local.json deniedMcpServers.
 *                       Project-local — never touches your other projects.
 *   allow <serverName>  Remove from the local denylist. If you want a server
 *                       allowed everywhere, just don't deny it.
 *   status              Same as list, but only shows entries that differ
 *                       from default (currently denied in this project).
 *
 * Anti-harness contract: changes to settings.local.json need a Claude Code
 * restart to take effect (the harness caches MCP config at session start).
 * Every mutating subcommand prints exactly that next-step instruction so the
 * user never has to guess.
 */

import * as p from '@clack/prompts'
import chalk from 'chalk'
import { type McpServerInfo, mcpService } from '../services/mcp-service'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { mdOutput, mdSection } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface McpOptions {
  md?: boolean
}

export class McpCommands extends PrjctCommandsBase {
  /**
   * Single dispatch entry — parses subcommand from input string the same
   * way `prjct seed` does so we register one method instead of four.
   */
  async mcp(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: McpOptions = {}
  ): Promise<CommandResult> {
    const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const sub = parts[0] ?? null
    const arg = parts[1] ?? null

    // Default (no subcommand) → interactive multi-select in TTY, headless
    // list output everywhere else (LLM/--md/piped). Keeps `p. mcp` from
    // Claude/Cursor working as a structured query while making `prjct mcp`
    // in the user's terminal a real toggle UI.
    if (sub === null) {
      const interactive =
        !options.md && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY)
      return interactive ? this.interactive(projectPath) : this.list(projectPath, options)
    }

    switch (sub) {
      case 'list':
        return this.list(projectPath, options)
      case 'status':
        return this.status(projectPath, options)
      case 'deny':
        return this.deny(arg, projectPath, options)
      case 'allow':
        return this.allow(arg, projectPath, options)
      default:
        out.fail(`Unknown mcp subcommand: ${sub}. Use: list, status, deny <name>, allow <name>.`)
        return { success: false, error: 'Unknown mcp subcommand' }
    }
  }

  /**
   * Interactive multi-select — the primary UX. Shows every MCP prjct knows
   * about with its tool-cost estimate, lets the user toggle which ones stay
   * enabled in this project, then writes a single diff to
   * `.claude/settings.local.json` and prints the restart hint.
   */
  private async interactive(projectPath: string): Promise<CommandResult> {
    try {
      const servers = await mcpService.list(projectPath)
      if (servers.length === 0) {
        out.info('No MCP servers detected for this project.')
        return { success: true, servers: [] }
      }

      const sumTools = (list: McpServerInfo[]) => list.reduce((n, s) => n + s.estimatedTools, 0)
      const beforeActive = servers.filter((s) => !s.denied)
      const beforeTools = sumTools(beforeActive)
      const totalTools = sumTools(servers)

      const projectName = projectPath.split('/').pop() ?? 'this project'
      p.intro(chalk.cyan.bold(`MCP servers — ${projectName}`))
      p.note(
        [
          `${beforeActive.length}/${servers.length} active · ~${beforeTools} of ~${totalTools} tools loaded`,
          chalk.dim('Space toggles · Enter applies · Esc cancels'),
        ].join('\n'),
        'Context cost'
      )

      const sourceLabel: Record<McpServerInfo['source'], string> = {
        cloud: 'cloud',
        project: 'project',
        global: 'global',
      }

      const sorted = [...servers].sort((a, b) => {
        if (a.source !== b.source) {
          const order: McpServerInfo['source'][] = ['cloud', 'project', 'global']
          return order.indexOf(a.source) - order.indexOf(b.source)
        }
        return b.estimatedTools - a.estimatedTools
      })

      const selected = await p.multiselect({
        message: 'Keep enabled in this project:',
        options: sorted.map((s) => ({
          value: s.name,
          label: this.optionLabel(s, sourceLabel[s.source]),
          hint: s.description,
        })),
        initialValues: sorted.filter((s) => !s.denied).map((s) => s.name),
        required: false,
      })

      if (p.isCancel(selected)) {
        p.cancel('No changes.')
        return { success: true, cancelled: true }
      }

      const enabledNames = selected as string[]
      const result = await mcpService.setEnabled(
        projectPath,
        enabledNames,
        servers.map((s) => s.name)
      )

      const afterTools = sumTools(servers.filter((s) => enabledNames.includes(s.name)))
      const delta = afterTools - beforeTools

      if (result.nowDenied.length === 0 && result.nowAllowed.length === 0) {
        p.outro(chalk.dim('No changes.'))
        return { success: true, unchanged: true }
      }

      const diffLines: string[] = []
      if (result.nowDenied.length > 0) {
        diffLines.push(
          chalk.red(`✗ denied (${result.nowDenied.length}): ${result.nowDenied.join(', ')}`)
        )
      }
      if (result.nowAllowed.length > 0) {
        diffLines.push(
          chalk.green(`✓ allowed (${result.nowAllowed.length}): ${result.nowAllowed.join(', ')}`)
        )
      }
      const sign = delta > 0 ? '+' : ''
      diffLines.push('')
      diffLines.push(
        `Tools loaded: ${beforeTools} → ${afterTools} (${chalk.bold(`${sign}${delta}`)})`
      )
      p.note(
        diffLines.join('\n'),
        `Wrote ${this.relativeSettingsPath(result.settingsPath, projectPath)}`
      )

      p.outro(chalk.yellow('Restart Claude Code to apply (MCP config is cached at session start).'))
      return { success: true, ...result, beforeTools, afterTools }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  private optionLabel(s: McpServerInfo, source: string): string {
    const cost = s.estimatedTools > 0 ? chalk.dim(` ~${s.estimatedTools} tools`) : ''
    return `${chalk.dim(`[${source}]`)} ${s.displayName}${cost}`
  }

  private relativeSettingsPath(abs: string, projectPath: string): string {
    return abs.startsWith(projectPath) ? abs.slice(projectPath.length + 1) : abs
  }

  private async list(projectPath: string, options: McpOptions): Promise<CommandResult> {
    try {
      const servers = await mcpService.list(projectPath)
      if (options.md) {
        console.log(this.formatMd(servers, false))
      } else {
        this.formatTerminal(servers, false)
      }
      return { success: true, servers }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  private async status(projectPath: string, options: McpOptions): Promise<CommandResult> {
    try {
      const all = await mcpService.list(projectPath)
      const denied = all.filter((s) => s.denied)
      if (options.md) {
        console.log(this.formatMd(denied, true))
      } else {
        this.formatTerminal(denied, true)
      }
      return { success: true, denied }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  private async deny(
    serverName: string | null,
    projectPath: string,
    options: McpOptions
  ): Promise<CommandResult> {
    if (!serverName) {
      out.fail('Usage: prjct mcp deny <serverName>')
      return { success: false, error: 'Missing serverName' }
    }

    try {
      const result = await mcpService.deny(projectPath, serverName)
      const verb = result.alreadyDenied ? 'already denied' : 'denied'
      const msg = `${serverName} ${verb} in this project`
      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Done', msg),
            mdSection('What to do next', this.restartHint(result.settingsPath))
          )
        )
      } else {
        out.done(msg)
        console.log(this.restartHint(result.settingsPath))
      }
      return { success: true, ...result }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  private async allow(
    serverName: string | null,
    projectPath: string,
    options: McpOptions
  ): Promise<CommandResult> {
    if (!serverName) {
      out.fail('Usage: prjct mcp allow <serverName>')
      return { success: false, error: 'Missing serverName' }
    }

    try {
      const result = await mcpService.allow(projectPath, serverName)
      const msg = result.wasDenied
        ? `${serverName} re-allowed in this project`
        : `${serverName} was not denied — nothing to change`
      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Done', msg),
            result.wasDenied
              ? mdSection('What to do next', this.restartHint(result.settingsPath))
              : null
          )
        )
      } else {
        out.done(msg)
        if (result.wasDenied) console.log(this.restartHint(result.settingsPath))
      }
      return { success: true, ...result }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  // ---------------------------------------------------------------------

  private formatTerminal(servers: McpServerInfo[], statusOnly: boolean): void {
    if (servers.length === 0) {
      if (statusOnly) {
        out.info('No MCP servers denied in this project.')
      } else {
        out.info('No MCP servers detected.')
      }
      return
    }

    const totalDenied = servers.filter((s) => s.denied).reduce((n, s) => n + s.estimatedTools, 0)
    const totalAllowed = servers.filter((s) => !s.denied).reduce((n, s) => n + s.estimatedTools, 0)

    if (!statusOnly) {
      console.log(`\nMCP servers — this project (${process.cwd().split('/').pop()})\n`)
    }

    for (const s of servers) {
      const flag = s.denied ? '✗ DENIED' : '✓ active'
      const cost = s.estimatedTools > 0 ? ` ~${s.estimatedTools} tools` : ''
      console.log(`  ${flag.padEnd(10)} [${s.source}] ${s.displayName}${cost}`)
      console.log(`             ${s.description}`)
      console.log(`             name: ${s.name}`)
    }

    if (!statusOnly) {
      console.log('')
      console.log(`Estimated tools loaded:  ${totalAllowed}  (denied: ${totalDenied})`)
      console.log('')
      console.log('Toggle in this project (does NOT affect other projects):')
      console.log('  prjct mcp deny <name>     # silence here, keep elsewhere')
      console.log('  prjct mcp allow <name>    # re-enable here')
      console.log('')
      console.log('Cloud MCPs come from your claude.ai connected apps. To see one')
      console.log('here, it must already be connected in claude.ai. To disable it')
      console.log('globally, disconnect it in claude.ai settings.')
    }
  }

  private formatMd(servers: McpServerInfo[], statusOnly: boolean): string {
    if (servers.length === 0) {
      const heading = statusOnly ? '# MCP status — this project' : '# MCP servers — this project'
      return `${heading}\n\nNothing to show.\n`
    }

    const lines: string[] = []
    lines.push(statusOnly ? '# MCP denylist — this project' : '# MCP servers — this project')
    lines.push('')

    const grouped = {
      cloud: servers.filter((s) => s.source === 'cloud'),
      project: servers.filter((s) => s.source === 'project'),
      global: servers.filter((s) => s.source === 'global'),
    }
    const sourceLabels: Record<string, string> = {
      cloud: 'Cloud (claude.ai connected apps)',
      project: 'Project (.mcp.json)',
      global: 'Global (~/.claude.json)',
    }

    for (const [src, group] of Object.entries(grouped)) {
      if (group.length === 0) continue
      lines.push(`## ${sourceLabels[src]}`)
      lines.push('')
      lines.push('| Status | Name | Tools | Description |')
      lines.push('|---|---|---|---|')
      for (const s of group) {
        const flag = s.denied ? '✗ denied' : '✓ active'
        const cost = s.estimatedTools > 0 ? `~${s.estimatedTools}` : '—'
        lines.push(`| ${flag} | \`${s.name}\` | ${cost} | ${s.description} |`)
      }
      lines.push('')
    }

    if (!statusOnly) {
      const denied = servers.filter((s) => s.denied).reduce((n, s) => n + s.estimatedTools, 0)
      const allowed = servers.filter((s) => !s.denied).reduce((n, s) => n + s.estimatedTools, 0)
      lines.push(`**Estimated tools loaded:** ${allowed} (denied: ${denied})`)
      lines.push('')
      lines.push('## Toggle in this project (project-local, no global side effects)')
      lines.push('')
      lines.push('- `prjct mcp deny <name>` — silence here, keep elsewhere')
      lines.push('- `prjct mcp allow <name>` — re-enable here')
      lines.push('')
      lines.push(
        'Cloud MCPs come from your claude.ai connected apps. To disable one ' +
          'globally, disconnect it in claude.ai settings.'
      )
    }

    return lines.join('\n')
  }

  private restartHint(settingsPath: string): string {
    return [
      `Wrote: ${settingsPath}`,
      '',
      'Restart Claude Code for this to take effect:',
      '  1. Exit this Claude Code session (Ctrl+C or close the window)',
      '  2. Re-run `claude` in the same directory',
      '',
      'The harness caches MCP config at session start — denylist edits are',
      'only read on a fresh session.',
    ].join('\n')
  }
}
