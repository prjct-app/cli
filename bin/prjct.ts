/**
 * prjct CLI entry point
 *
 * Auto-setup on first use (like Astro, Vite, etc.)
 * Supports both Bun and Node.js runtimes.
 *
 * IMPORTANT: postinstall.js often doesn't run, so we detect and
 * auto-install on first CLI use. This is the reliable path.
 */

// Performance: capture process start time (nanosecond precision)
// Exposed via globalThis so core/index.ts can read it for startup time metrics
;(globalThis as Record<string, unknown>).__perfStartNs = process.hrtime.bigint()

import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { detectAllProviders } from '../core/infrastructure/ai-provider'
import configManager from '../core/infrastructure/config-manager'
import editorsConfig from '../core/infrastructure/editors-config'
import { DEFAULT_PORT, startServer } from '../core/server/server'
import { fileExists } from '../core/utils/file-helper'
import { invalidateProviderCache } from '../core/utils/provider-cache'
import { VERSION } from '../core/utils/version'

/**
 * Check if routers are installed for detected providers
 * Returns true if at least one provider has its router installed
 */
async function checkRoutersInstalled(): Promise<boolean> {
  const home = os.homedir()
  const detection = await detectAllProviders()

  // Check Claude router
  if (detection.claude.installed) {
    const claudeRouter = path.join(home, '.claude', 'commands', 'p.md')
    if (!(await fileExists(claudeRouter))) {
      return false
    }
  }

  // Check Gemini router
  if (detection.gemini.installed) {
    const geminiRouter = path.join(home, '.gemini', 'commands', 'p.toml')
    if (!(await fileExists(geminiRouter))) {
      return false
    }
  }

  // If no providers detected, consider it "installed" (setup will handle)
  if (!detection.claude.installed && !detection.gemini.installed) {
    return true
  }

  return true
}

// Check for special subcommands that bypass normal CLI
const args = process.argv.slice(2)

// Parse --quiet / -q flag (must be done early, before any output)
const quietIndex = args.findIndex((arg) => arg === '--quiet' || arg === '-q')
const isQuietMode = quietIndex !== -1
if (isQuietMode) {
  args.splice(quietIndex, 1) // Remove flag from args
  const { setQuietMode } = await import('../core/utils/output')
  setQuietMode(true)
}

// Parse --refresh flag (force re-detection of providers, invalidate cache)
const refreshIndex = args.indexOf('--refresh')
const isRefresh = refreshIndex !== -1
if (isRefresh) {
  args.splice(refreshIndex, 1)
  await invalidateProviderCache()
}

// Colors for output (chalk respects NO_COLOR env)

// Session tracking for commands that bypass core/index.ts
async function trackSession(command: string): Promise<() => void> {
  const start = Date.now()
  try {
    const projectId = await configManager.getProjectId(process.cwd())
    if (projectId) {
      const { sessionTracker } = await import('../core/services/session-tracker')
      await sessionTracker.expireIfStale(projectId)
      await sessionTracker.touch(projectId)
      return () => {
        const durationMs = Date.now() - start
        sessionTracker.trackCommand(projectId, command, durationMs).catch(() => {})

        // Performance tracking (non-critical, lazy-loaded)
        import('../core/infrastructure/performance-tracker')
          .then(({ performanceTracker }) => {
            performanceTracker
              .recordTiming(projectId, 'command_duration', durationMs, { command })
              .catch(() => {})
            performanceTracker.recordMemory(projectId, { command }).catch(() => {})
          })
          .catch(() => {})
      }
    }
  } catch {
    // Non-critical
  }
  return () => {}
}

if (args[0] === 'start' || args[0] === 'setup') {
  // Interactive setup with beautiful UI
  const { runStart } = await import('../core/cli/start')
  await runStart()
} else if (args[0] === 'dev') {
  // Dev mode - placeholder for future development server
  console.log('Dev mode is not yet implemented.')
  console.log('Use "prjct serve" to start the web server.')
  process.exitCode = 0
} else if (args[0] === 'web' || args[0] === 'serve') {
  // Launch prjct web server
  try {
    const projectPath = process.cwd()
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      console.error('No prjct project found. Run "prjct init" first.')
      process.exitCode = 1
    } else {
      const port = parseInt(args[1], 10) || DEFAULT_PORT
      await startServer(projectId, projectPath, port)
    }
  } catch (error) {
    console.error('Server error:', (error as Error).message)
    process.exitCode = 1
  }
} else if (args[0] === 'context') {
  // Context tools - smart context filtering for AI agents
  const projectPath = process.cwd()
  const projectId = await configManager.getProjectId(projectPath)

  if (!projectId) {
    console.error('No prjct project found. Run "prjct init" first.')
    process.exitCode = 1
  } else {
    const done = await trackSession('context')
    const { runContextTool } = await import('../core/tools/context')
    const result = await runContextTool(args.slice(1), projectId, projectPath)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.tool === 'error' ? 1 : 0
    done()
  }
} else if (args[0] === 'hooks') {
  // Git hooks management
  const done = await trackSession('hooks')
  const { hooksService } = await import('../core/services/hooks-service')
  const subcommand = args[1] || 'status'
  const exitCode = await hooksService.run(process.cwd(), subcommand)
  process.exitCode = exitCode
  done()
} else if (args[0] === 'doctor') {
  // Health check command
  const done = await trackSession('doctor')
  const { doctorService } = await import('../core/services/doctor-service')
  const exitCode = await doctorService.run(process.cwd())
  process.exitCode = exitCode
  done()
} else if (args[0] === 'uninstall') {
  // Complete system removal
  const { uninstall } = await import('../core/commands/uninstall')

  // Parse flags
  const force = args.includes('--force') || args.includes('-f')
  const backup = args.includes('--backup') || args.includes('-b')
  const dryRun = args.includes('--dry-run') || args.includes('-n')
  const keepPackage = args.includes('--keep-package')

  const result = await uninstall({ force, backup, dryRun, keepPackage })
  process.exitCode = result.success ? 0 : 1
} else if (args[0] === 'watch') {
  // Watch mode - auto-sync on file changes
  const projectPath = process.cwd()
  const projectId = await configManager.getProjectId(projectPath)

  if (!projectId) {
    console.error('No prjct project found. Run "prjct init" first.')
    process.exitCode = 1
  } else {
    const { watchService } = await import('../core/services/watch-service')

    // Parse options
    const verbose = args.includes('--verbose') || args.includes('-v')
    const debounceArg = args.find((a) => a.startsWith('--debounce='))
    const debounceMs = debounceArg ? parseInt(debounceArg.split('=')[1], 10) : undefined
    const intervalArg = args.find((a) => a.startsWith('--interval='))
    const minIntervalMs = intervalArg ? parseInt(intervalArg.split('=')[1], 10) * 1000 : undefined

    const result = await watchService.start(projectPath, {
      verbose,
      quiet: isQuietMode,
      debounceMs,
      minIntervalMs,
    })

    if (!result.success) {
      console.error(result.error)
      process.exitCode = 1
    }
    // Watch mode runs indefinitely until Ctrl+C
  }
} else if (args[0] === 'linear') {
  // Linear CLI subcommand - direct access to Linear SDK
  const { spawn } = await import('node:child_process')
  const fs = await import('node:fs')
  const projectPath = process.cwd()
  const projectId = await configManager.getProjectId(projectPath)

  if (!projectId) {
    console.error('No prjct project found. Run "prjct init" first.')
    process.exitCode = 1
  } else {
    // Resolve linear CLI path: prefer source (dev) → compiled (production)
    const srcPath = path.join(__dirname, '..', 'core', 'cli', 'linear.ts')
    const distPath = path.join(__dirname, '..', 'dist', 'cli', 'linear.mjs')
    // When running from dist/bin/, the compiled path is adjacent
    const distPathAdjacent = path.join(__dirname, '..', 'cli', 'linear.mjs')

    let linearCliPath: string
    let runtime: string

    if (fs.existsSync(srcPath)) {
      // Dev mode: use raw TypeScript with bun
      linearCliPath = srcPath
      runtime = 'bun'
    } else if (fs.existsSync(distPathAdjacent)) {
      // Production (running from dist/bin/): compiled JS adjacent
      linearCliPath = distPathAdjacent
      runtime = 'node'
    } else if (fs.existsSync(distPath)) {
      // Production (running from bin/): compiled JS in dist/
      linearCliPath = distPath
      runtime = 'node'
    } else {
      console.error('Linear CLI not found. Run "npm run build" first.')
      process.exitCode = 1
      linearCliPath = ''
      runtime = ''
    }

    if (linearCliPath) {
      const linearArgs = ['--project', projectId, ...args.slice(1)]
      const child = spawn(runtime, [linearCliPath, ...linearArgs], {
        stdio: 'inherit',
        cwd: projectPath,
      })

      child.on('close', (code) => {
        process.exitCode = code || 0
      })
    }
  }
} else if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
  // Show help - bypass setup check to always show help
  const { getHelp } = await import('../core/utils/help')
  const topic = args[1] // Optional: prjct help <command>
  console.log(getHelp(topic))
  process.exitCode = 0
} else if (args[0] === 'version' || args[0] === '-v' || args[0] === '--version') {
  // Show version with provider status (uses cached detection unless --refresh)
  const detection = await detectAllProviders(isRefresh)
  const home = os.homedir()
  const cwd = process.cwd()
  const [
    claudeConfigured,
    geminiConfigured,
    cursorDetected,
    cursorConfigured,
    windsurfDetected,
    windsurfConfigured,
  ] = await Promise.all([
    fileExists(path.join(home, '.claude', 'commands', 'p.md')),
    fileExists(path.join(home, '.gemini', 'commands', 'p.toml')),
    fileExists(path.join(cwd, '.cursor')),
    fileExists(path.join(cwd, '.cursor', 'rules', 'prjct.mdc')),
    fileExists(path.join(cwd, '.windsurf')),
    fileExists(path.join(cwd, '.windsurf', 'rules', 'prjct.md')),
  ])

  console.log(`
${chalk.cyan('p/')} prjct v${VERSION}
${chalk.dim('Context layer for AI coding agents')}

${chalk.dim('Providers:')}`)

  // Claude status
  if (detection.claude.installed) {
    const status = claudeConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
    const ver = detection.claude.version ? ` (v${detection.claude.version})` : ''
    console.log(`  Claude Code   ${status}${chalk.dim(ver)}`)
  } else {
    console.log(`  Claude Code   ${chalk.dim('○ not installed')}`)
  }

  // Gemini status
  if (detection.gemini.installed) {
    const status = geminiConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
    const ver = detection.gemini.version ? ` (v${detection.gemini.version})` : ''
    console.log(`  Gemini CLI    ${status}${chalk.dim(ver)}`)
  } else {
    console.log(`  Gemini CLI    ${chalk.dim('○ not installed')}`)
  }

  // Cursor status (project-level)
  if (cursorDetected) {
    const status = cursorConfigured ? chalk.green('✓ ready') : chalk.yellow('● detected')
    console.log(`  Cursor IDE    ${status}${chalk.dim(' (project)')}`)
  } else {
    console.log(`  Cursor IDE    ${chalk.dim('○ not detected')}`)
  }

  // Windsurf status (project-level)
  if (windsurfDetected) {
    const status = windsurfConfigured ? chalk.green('✓ ready') : chalk.yellow('● detected')
    console.log(`  Windsurf IDE  ${status}${chalk.dim(' (project)')}`)
  } else {
    console.log(`  Windsurf IDE  ${chalk.dim('○ not detected')}`)
  }

  console.log(`
${chalk.dim("Run 'prjct start' to configure (CLI providers)")}
${chalk.dim("Run 'prjct init' to configure (Cursor/Windsurf IDE)")}
${chalk.cyan('https://prjct.app')}
`)
} else {
  // Check if setup has been done
  const configPath = path.join(os.homedir(), '.prjct-cli', 'config', 'installed-editors.json')
  const routersInstalled = await checkRoutersInstalled()

  if (!(await fileExists(configPath)) || !routersInstalled) {
    // First time - prompt to run start
    console.log(`
${chalk.cyan.bold('  Welcome to prjct!')}

  Run ${chalk.bold('prjct start')} to configure your AI providers.

  ${chalk.dim(`This is a one-time setup that lets you choose between
  Claude Code, Gemini CLI, or both.`)}
`)
    process.exitCode = 0
  } else {
    // Check version and auto-update if needed
    try {
      const lastVersion = await editorsConfig.getLastVersion()

      if (lastVersion && lastVersion !== VERSION) {
        console.log(`\n${chalk.yellow('ℹ')} Updating prjct v${lastVersion} → v${VERSION}...\n`)

        const { default: setup } = await import('../core/infrastructure/setup')
        await setup.run()
      }
    } catch (_error) {
      // Silent fail on version check
    }

    // Continue to main CLI logic
    await import('../core/index')
  }
}
