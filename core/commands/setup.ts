/**
 * Setup Commands: start, setup, login, installStatusLine, showAsciiArt
 */

import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import chalk from 'chalk'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import authConfig from '../sync/auth-config'
import { syncClient } from '../sync/sync-client'
import syncManager from '../sync/sync-manager'
import type { MdOption } from '../types/cli'
import type { CommandResult, SetupOptions } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { execAsync } from '../utils/exec'
import { fileExists, readJson, writeJson } from '../utils/file-helper'
import { failFromError } from '../utils/md-aware'
import out from '../utils/output'
import { VERSION } from '../utils/version'
import { PrjctCommandsBase } from './base'
import { setupMcpServers as configureDefaultMcpServers } from './setup/mcp'

export class SetupCommands extends PrjctCommandsBase {
  /**
   * Manage cloud authentication (login, logout, status)
   */
  async auth(action: string | null = null, options: MdOption = {}): Promise<CommandResult> {
    const subcommand = action?.split(' ')[0] || 'status'
    const args = action?.split(' ').slice(1) || []

    switch (subcommand) {
      case 'login': {
        const apiKey = args[0]
        if (!apiKey) {
          if (!options.md) out.fail('Usage: prjct login [--url <url>]')
          return {
            success: false,
            message: options.md ? '## Error\nUsage: `prjct login [--url <url>]`' : '',
          }
        }

        // Parse --url flag from remaining args
        let apiUrl: string | undefined
        const urlIdx = args.indexOf('--url')
        if (urlIdx !== -1 && args[urlIdx + 1]) {
          apiUrl = args[urlIdx + 1]
        }

        // Save auth with API key (userId and email will be populated on first sync)
        await authConfig.write({
          apiKey,
          ...(apiUrl ? { apiUrl } : {}),
        })

        // Test connection
        const connected = await syncClient.testConnection()

        if (connected) {
          if (!options.md) {
            out.done('Connected! API key saved')
            out.info(chalk.dim(`Key: ${apiKey.substring(0, 12)}...`))
          }
          return {
            success: true,
            message: options.md
              ? `## Auth\n- **Status**: Connected\n- **Key**: \`${apiKey.substring(0, 12)}...\`\n- **API**: ${apiUrl || 'default'}`
              : '',
          }
        } else {
          if (!options.md) {
            out.warn('API key saved, but server is unreachable')
            out.info(chalk.dim(`Key: ${apiKey.substring(0, 12)}...`))
            out.info(chalk.dim('The key will be used when the server becomes available'))
          }
          return {
            success: true,
            message: options.md
              ? `## Auth\n- **Status**: Key saved (server unreachable)\n- **Key**: \`${apiKey.substring(0, 12)}...\``
              : '',
          }
        }
      }

      case 'logout': {
        await authConfig.clearAuth()
        if (!options.md) out.done('Logged out. Auth credentials cleared')
        return {
          success: true,
          message: options.md ? '## Auth\n- **Status**: Logged out' : '',
        }
      }

      default: {
        const status = await authConfig.getStatus()
        if (options.md) {
          return {
            success: true,
            message: status.authenticated
              ? `## Auth Status\n- **Authenticated**: Yes\n- **Email**: ${status.email || 'N/A'}\n- **Key**: \`${status.apiKeyPrefix}\`\n- **Last auth**: ${status.lastAuth || 'N/A'}`
              : '## Auth Status\n- **Authenticated**: No\n- Run `prjct login` to connect',
          }
        }
        if (status.authenticated) {
          out.box(
            'Auth Status',
            `Email:  ${status.email || 'N/A'}\nKey:    ${status.apiKeyPrefix}\nSince:  ${status.lastAuth || 'N/A'}`
          )
        } else {
          out.info('Not authenticated')
          out.info(`Run ${chalk.cyan('prjct login')} to connect`)
        }
        return { success: true, message: '' }
      }
    }
  }

  /**
   * Browser-based login: opens browser, user authenticates with OTP, CLI gets API key automatically.
   * Usage: prjct login [--url <webUrl>]
   */
  async login(options: { md?: boolean; url?: string } = {}): Promise<CommandResult> {
    // Check if already authenticated
    const status = await authConfig.getStatus()
    if (status.authenticated) {
      if (!options.md) {
        out.box('Already Authenticated', `Email:  ${status.email}\nKey:    ${status.apiKeyPrefix}`)
        out.info(`Run ${chalk.cyan('prjct logout')} first to re-authenticate`)
      }
      return {
        success: true,
        message: options.md
          ? `## Already Authenticated\n- **Email**: ${status.email}\n- **Key**: \`${status.apiKeyPrefix}\`\n\nRun \`prjct logout\` first to re-authenticate.`
          : '',
      }
    }

    const webUrl = options.url || process.env.PRJCT_WEB_URL || 'http://localhost:3000'

    return new Promise<CommandResult>((resolve) => {
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://127.0.0.1`)

        if (url.pathname === '/callback') {
          const apiKey = url.searchParams.get('key')
          const email = url.searchParams.get('email')
          const userId = url.searchParams.get('user_id')

          if (apiKey) {
            // Save auth
            await authConfig.saveAuth(apiKey, userId || '', email || '')

            // Also save the web URL as the API URL
            const apiUrl = `${webUrl}/api`
            await authConfig.write({ apiUrl })

            // Send success HTML to browser
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(this.buildSuccessPage(email || '', apiKey.substring(0, 12)))
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(this.buildErrorPage('No API key received'))
          }

          // Close server and resolve
          server.close()

          if (apiKey) {
            if (!options.md) {
              out.step(3, 3, 'Connected')
              out.stop()
              out.box(
                'Authentication Complete',
                `Email:  ${email}\nKey:    ${apiKey.substring(0, 12)}...\nStatus: Connected`
              )
            }

            // Auto-sync if inside a prjct project
            await this.autoSync()

            resolve({
              success: true,
              message: options.md
                ? `## Authenticated\n- **Email**: ${email}\n- **Key**: \`${apiKey.substring(0, 12)}...\``
                : '',
            })
          } else {
            if (!options.md) out.fail('Authentication failed: no API key received')
            resolve({
              success: false,
              message: options.md ? '## Error\nAuthentication failed: no API key received' : '',
            })
          }
          return
        }

        // Any other path — 404
        res.writeHead(404)
        res.end('Not found')
      })

      // Listen on random port
      server.listen(0, '127.0.0.1', async () => {
        const addr = server.address()
        if (!addr || typeof addr === 'string') {
          server.close()
          if (!options.md) out.fail('Failed to start callback server')
          resolve({
            success: false,
            message: options.md ? '## Error\nFailed to start callback server' : '',
          })
          return
        }

        const port = addr.port
        const loginUrl = `${webUrl}/login?redirect=${encodeURIComponent(`/api/auth/cli-login?port=${port}`)}`

        out.step(1, 3, 'Opening browser...')
        out.stop()
        out.info(chalk.dim(loginUrl))

        // Open browser
        const platform = process.platform
        const openCmd =
          platform === 'darwin'
            ? `open "${loginUrl}"`
            : platform === 'win32'
              ? `start "${loginUrl}"`
              : `xdg-open "${loginUrl}"`

        try {
          await execAsync(openCmd)
        } catch {
          out.warn('Could not open browser automatically')
          out.info(`Visit: ${loginUrl}`)
        }

        out.step(2, 3, 'Waiting for authentication...')
      })

      // Timeout after 5 minutes
      setTimeout(
        () => {
          server.close()
          out.stop()
          if (!options.md) {
            out.fail('Authentication timed out')
            out.info(`Run ${chalk.cyan('prjct login')} to try again`)
          }
          resolve({
            success: false,
            message: options.md
              ? '## Error\nAuthentication timed out. Run `prjct login` to try again.'
              : '',
          })
        },
        5 * 60 * 1000
      )
    })
  }

  /**
   * Logout — clear auth credentials
   */
  async logout(): Promise<CommandResult> {
    const status = await authConfig.getStatus()
    if (!status.authenticated) {
      out.info('Already logged out')
      return { success: true, message: '' }
    }

    await authConfig.clearAuth()
    out.done('Logged out')
    return { success: true, message: '' }
  }

  /**
   * Auto-sync pending events if inside a prjct project
   */
  private async autoSync(): Promise<void> {
    try {
      const config = await configManager.readConfig(process.cwd()).catch(() => null)
      const projectId = config?.projectId
      if (!projectId) return

      // Local-first gate: only sync projects the user explicitly linked
      // (and hasn't paused). An unlinked project stays entirely local even
      // right after login.
      if (!config.cloud?.enabled || config.cloud.paused) return

      out.spin('Syncing project...')
      const result = await syncManager.sync(projectId, { include: config.cloud.include ?? {} })
      out.stop()

      if (result.success && !result.skipped) {
        const pushed = result.pushed?.count || 0
        const pulled = result.pulled?.count || 0
        if (pushed > 0 || pulled > 0) {
          out.done(`Synced (${pushed} pushed, ${pulled} pulled)`)
        } else {
          out.done('Synced — everything up to date')
        }
      }
    } catch {
      out.stop()
      // Not inside a project or sync failed — silently skip
    }
  }

  /**
   * Build branded dark success page for browser callback
   */
  private buildSuccessPage(email: string, keyPrefix: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>prjct CLI Connected</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',sans-serif;
background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:2.5rem}
.logo{font-size:.875rem;letter-spacing:.05em;color:#888;margin-bottom:2rem;font-family:ui-monospace,monospace}
.logo span{color:#22d3ee}
.icon{width:64px;height:64px;border-radius:50%;background:rgba(34,211,238,.12);
display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
.icon svg{width:32px;height:32px;color:#22d3ee}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}
.details{background:#141414;border:1px solid #262626;border-radius:8px;padding:1rem 1.25rem;
margin:1.25rem 0;text-align:left;font-size:.875rem;line-height:1.75}
.details .label{color:#888}
.details .value{color:#e5e5e5}
.hint{color:#666;font-size:.8125rem;margin-top:1rem}
</style></head>
<body><div class="card">
<div class="logo"><span>prjct</span>/cli</div>
<div class="icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
<h1>CLI Connected</h1>
<div class="details">
<span class="label">Account:</span> <span class="value">${email}</span><br>
<span class="label">Key:</span> <span class="value">${keyPrefix}...</span>
</div>
<p class="hint">Return to your terminal to continue.</p>
</div></body></html>`
  }

  /**
   * Build branded dark error page for browser callback
   */
  private buildErrorPage(error: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>prjct CLI — Error</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',sans-serif;
background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:2.5rem}
.logo{font-size:.875rem;letter-spacing:.05em;color:#888;margin-bottom:2rem;font-family:ui-monospace,monospace}
.logo span{color:#22d3ee}
.icon{width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,.12);
display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
.icon svg{width:32px;height:32px;color:#ef4444}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}
.msg{background:#141414;border:1px solid #262626;border-radius:8px;padding:1rem 1.25rem;
margin:1.25rem 0;font-size:.875rem;color:#f87171}
.hint{color:#666;font-size:.8125rem;margin-top:1rem}
</style></head>
<body><div class="card">
<div class="logo"><span>prjct</span>/cli</div>
<div class="icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>
<h1>Authentication Failed</h1>
<div class="msg">${error}</div>
<p class="hint">Return to your terminal and try again.</p>
</div></body></html>`
  }

  /**
   * First-time setup - Install commands to editors
   */
  async start(): Promise<CommandResult> {
    const status = await commandInstaller.checkInstallation()
    const aiProvider = require('../infrastructure/ai-provider')
    const codexDetection = await aiProvider.detectCodex()
    const hasCliProvider = status.providerDetected
    const activeProvider = hasCliProvider ? await aiProvider.getActiveProvider() : null
    const primaryName = hasCliProvider ? activeProvider.displayName : 'OpenAI Codex'

    console.log(`🚀 Setting up prjct for ${primaryName}...\n`)

    if (!hasCliProvider && !codexDetection.installed) {
      return {
        success: false,
        message: `❌ No supported AI provider detected.\n\nPlease install one first:\n  - Claude Code: https://docs.anthropic.com/claude-code\n  - Gemini CLI: https://geminicli.com/docs\n  - OpenAI Codex: https://github.com/openai/codex`,
      }
    }

    if (hasCliProvider) {
      console.log('📦 Installing /p:* commands...')
      const result = await commandInstaller.installCommands()

      if (!result.success) {
        return {
          success: false,
          message: `❌ Installation failed: ${result.error}`,
        }
      }

      console.log(
        `\n✅ Installed ${result.installed?.length ?? 0} commands to:\n   ${pathManager.getDisplayPath(result.path || '')}`
      )

      if ((result.errors?.length ?? 0) > 0) {
        console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
        for (const e of result.errors ?? []) {
          console.log(`   - ${e.file}: ${e.error}`)
        }
      }
    }

    if (codexDetection.installed) {
      try {
        const { installCodexSkill, verifyCodexPRouterReady } = await import(
          '../infrastructure/codex-skill'
        )
        await installCodexSkill()
        const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
        if (codexRouter.verified) {
          console.log('✅ Installed Codex skill: ~/.codex/skills/prjct/SKILL.md')
          console.log('✅ Codex p. router ready')
        } else {
          console.log(
            `⚠️  Codex skill setup incomplete: ${codexRouter.message || 'router verification failed'}`
          )
          console.log('   Run `prjct setup` to retry Codex configuration.')
        }
      } catch (error) {
        console.log(`⚠️  Codex skill setup failed (non-blocking): ${getErrorMessage(error)}`)
      }
    }

    await this.setupMcpServers()

    console.log('\n🎉 Setup complete!')
    console.log('\nNext steps:')
    console.log(`  1. Open ${primaryName}`)
    console.log('  2. Navigate to your project')
    console.log('  3. Run: prjct init')

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Reconfigure editor installations
   */
  async setup(options: SetupOptions = {}): Promise<CommandResult> {
    console.log('🔧 Reconfiguring prjct...\n')

    if (options.force) {
      console.log('🗑️  Removing existing installation...')
      await commandInstaller.uninstallCommands()
    }

    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.installCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Setup failed: ${result.error}`,
      }
    }

    console.log(`\n✅ Installed ${result.installed?.length ?? 0} commands`)

    if ((result.errors?.length ?? 0) > 0) {
      console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
      for (const e of result.errors ?? []) {
        console.log(`   - ${e.file}: ${e.error}`)
      }
    }

    console.log('\n📝 Installing global configuration...')
    const configResult = await commandInstaller.installGlobalConfig()
    const displayPath = configResult.path
      ? pathManager.getDisplayPath(configResult.path)
      : 'global config'

    if (configResult.success) {
      if (configResult.action === 'created') {
        console.log(`✅ Created ${displayPath}`)
      } else if (configResult.action === 'updated') {
        console.log(`✅ Updated ${displayPath}`)
      } else if (configResult.action === 'appended') {
        console.log(`✅ Added prjct config to ${displayPath}`)
      }
    } else {
      console.log(`⚠️  ${configResult.error}`)
    }

    const aiProvider = require('../infrastructure/ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()
    const codexDetection = await aiProvider.detectCodex()

    // Status line is currently Claude-only
    if (activeProvider.name === 'claude') {
      console.log('\n⚡ Installing status line...')
      const statusLineResult = await this.installStatusLine()
      if (statusLineResult.success) {
        console.log('✅ Status line configured')
      } else {
        console.log(`⚠️  ${statusLineResult.error}`)
      }
    }

    if (codexDetection.installed) {
      try {
        const { installCodexSkill, verifyCodexPRouterReady } = await import(
          '../infrastructure/codex-skill'
        )
        await installCodexSkill()
        const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
        if (codexRouter.verified) {
          console.log('✅ Codex skill installed')
          console.log('✅ Codex p. router ready')
        } else {
          console.log(
            `⚠️  Codex skill setup incomplete: ${codexRouter.message || 'router verification failed'}`
          )
          console.log('   Run `prjct setup` again to retry Codex configuration.')
        }
      } catch (error) {
        console.log(`⚠️  Codex skill setup failed (non-blocking): ${getErrorMessage(error)}`)
      }
    }

    await this.setupMcpServers()

    console.log('\n🎉 Setup complete!\n')

    this.showAsciiArt()

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Configure MCP servers required by prjct.
   * - Context7: auto-installs and verifies (required for framework API lookups)
   * - prjct: auto-installs the local project memory/workflow MCP
   * - Linear/Jira: optional; configured manually through their setup commands
   */
  private async setupMcpServers(): Promise<void> {
    await configureDefaultMcpServers()
  }

  /**
   * Install status line script and configure settings.json
   */
  async installStatusLine(): Promise<{ success: boolean; error?: string }> {
    try {
      // Note: This method is currently Claude-specific
      const claudeDir = pathManager.getClaudeDir()
      const settingsPath = pathManager.getClaudeSettingsPath()
      const statusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

      // Version is embedded at install time
      const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
# Shows version update notifications and current task

# Current CLI version (embedded at install time)
CLI_VERSION="${VERSION}"

# Read JSON context from stdin (provided by Claude Code)
read -r json

# Extract cwd from JSON
CWD=$(echo "$json" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

# Check if this is a prjct project
CONFIG="$CWD/.prjct/prjct.config.json"
if [[ -f "$CONFIG" ]]; then
  # Extract projectId
  PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"projectId"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

  if [[ -n "$PROJECT_ID" ]]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"

    # Check version mismatch
    if [[ -f "$PROJECT_JSON" ]]; then
      PROJECT_VERSION=$(grep -o '"cliVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_JSON" | sed 's/.*"cliVersion"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      # If no cliVersion or different version, show update notice
      if [[ -z "$PROJECT_VERSION" ]] || [[ "$PROJECT_VERSION" != "$CLI_VERSION" ]]; then
        echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
        exit 0
      fi
    else
      # No project.json means project needs sync
      echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
      exit 0
    fi

    # Show current task if exists
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [[ -f "$STATE" ]]; then
      TASK=$(grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
      STATUS=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      if [[ -n "$TASK" ]] && [[ "$STATUS" == "active" ]]; then
        # Truncate task to 40 chars
        TASK_SHORT="\${TASK:0:40}"
        [[ \${#TASK} -gt 40 ]] && TASK_SHORT="$TASK_SHORT..."
        echo "🎯 $TASK_SHORT"
        exit 0
      fi
    fi
  fi
fi

# Default: show prjct branding
echo "⚡ prjct"
`
      await fs.writeFile(statusLinePath, scriptContent, { mode: 0o755 })

      let settings: Record<string, unknown> = {}
      if (await fileExists(settingsPath)) {
        try {
          settings = (await readJson<Record<string, unknown>>(settingsPath)) ?? {}
        } catch (_error) {
          // Invalid JSON, start fresh
        }
      }

      settings.statusLine = {
        type: 'command',
        command: statusLinePath,
      }

      await writeJson(settingsPath, settings)

      return { success: true }
    } catch (error) {
      return failFromError(error)
    }
  }

  /**
   * Show beautiful ASCII art with quick start
   */
  showAsciiArt(): void {
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('   ██████╗ ██████╗      ██╗ ██████╗████████╗'))
    console.log(chalk.bold.cyan('   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝'))
    console.log(chalk.bold.cyan('   ██████╔╝██████╔╝     ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██╔═══╝ ██╔══██╗██   ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║'))
    console.log(chalk.bold.cyan('   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝'))
    console.log('')
    console.log(
      `   ${chalk.bold.cyan('prjct')}${chalk.magenta('/')}${chalk.green('cli')}  ${chalk.dim.white(`v${VERSION} installed`)}`
    )
    console.log('')
    console.log(`   ${chalk.yellow('⚡')} Ship faster with zero friction`)
    console.log(`   ${chalk.green('📝')} From idea to technical tasks in minutes`)
    console.log(`   ${chalk.cyan('🤖')} Perfect context for AI agents`)
    console.log('')
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('🚀 Quick Start'))
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.bold('1.')} Initialize your project:`)
    console.log(`     ${chalk.green('cd your-project && prjct init')}`)
    console.log('')
    console.log(`  ${chalk.bold('2.')} Start your first task:`)
    console.log(`     ${chalk.green('prjct task "build auth"')}`)
    console.log('')
    console.log(`  ${chalk.bold('3.')} Ship & celebrate:`)
    console.log(`     ${chalk.green('prjct ship "user login"')}`)
    console.log('')
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.dim('Documentation:')} ${chalk.cyan('https://prjct.app')}`)
    console.log(
      `  ${chalk.dim('Report issues:')} ${chalk.cyan('https://github.com/jlopezlira/prjct-cli/issues')}`
    )
    console.log('')
    console.log(chalk.bold.magenta('Happy shipping! 🚀'))
    console.log('')
  }
}
