/**
 * prjct CLI entry point
 *
 * Auto-setup on first use (like Astro, Vite, etc.)
 * Supports both Bun and Node.js runtimes.
 *
 * IMPORTANT: postinstall.js often doesn't run, so we detect and
 * auto-install on first CLI use. This is the reliable path.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { VERSION } from '../core/utils/version'
import editorsConfig from '../core/infrastructure/editors-config'
import { startServer, DEFAULT_PORT } from '../core/server/server'
import configManager from '../core/infrastructure/config-manager'
import { detectAllProviders } from '../core/infrastructure/ai-provider'

/**
 * Check if routers are installed for detected providers
 * Returns true if at least one provider has its router installed
 */
function checkRoutersInstalled(): boolean {
  const home = os.homedir()
  const detection = detectAllProviders()

  // Check Claude router
  if (detection.claude.installed) {
    const claudeRouter = path.join(home, '.claude', 'commands', 'p.md')
    if (!fs.existsSync(claudeRouter)) {
      return false
    }
  }

  // Check Gemini router
  if (detection.gemini.installed) {
    const geminiRouter = path.join(home, '.gemini', 'commands', 'p.toml')
    if (!fs.existsSync(geminiRouter)) {
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
const quietIndex = args.findIndex(arg => arg === '--quiet' || arg === '-q')
const isQuietMode = quietIndex !== -1
if (isQuietMode) {
  args.splice(quietIndex, 1) // Remove flag from args
  const { setQuietMode } = await import('../core/utils/output')
  setQuietMode(true)
}

// Colors for output
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

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
      const port = parseInt(args[1]) || DEFAULT_PORT
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
    const { runContextTool } = await import('../core/context-tools')
    const result = await runContextTool(args.slice(1), projectId, projectPath)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.tool === 'error' ? 1 : 0
  }
} else if (args[0] === 'doctor') {
  // Health check command
  const { doctorService } = await import('../core/services/doctor-service')
  const exitCode = await doctorService.run(process.cwd())
  process.exitCode = exitCode
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
    const debounceArg = args.find(a => a.startsWith('--debounce='))
    const debounceMs = debounceArg ? parseInt(debounceArg.split('=')[1]) : undefined
    const intervalArg = args.find(a => a.startsWith('--interval='))
    const minIntervalMs = intervalArg ? parseInt(intervalArg.split('=')[1]) * 1000 : undefined

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
  const { spawn } = await import('child_process')
  const projectPath = process.cwd()
  const projectId = await configManager.getProjectId(projectPath)

  if (!projectId) {
    console.error('No prjct project found. Run "prjct init" first.')
    process.exitCode = 1
  } else {
    // Get the path to the linear CLI
    const linearCliPath = path.join(__dirname, '..', 'core', 'cli', 'linear.ts')

    // Forward args to linear CLI, adding --project flag
    const linearArgs = ['--project', projectId, ...args.slice(1)]

    // Use bun to run the CLI
    const child = spawn('bun', [linearCliPath, ...linearArgs], {
      stdio: 'inherit',
      cwd: projectPath,
    })

    child.on('close', (code) => {
      process.exitCode = code || 0
    })
  }
} else if (args[0] === 'version' || args[0] === '-v' || args[0] === '--version') {
  // Show version with provider status
  const detection = detectAllProviders()
  const home = os.homedir()
  const cwd = process.cwd()
  const claudeConfigured = fs.existsSync(path.join(home, '.claude', 'commands', 'p.md'))
  const geminiConfigured = fs.existsSync(path.join(home, '.gemini', 'commands', 'p.toml'))
  const cursorDetected = fs.existsSync(path.join(cwd, '.cursor'))
  const cursorConfigured = fs.existsSync(path.join(cwd, '.cursor', 'rules', 'prjct.mdc'))
  const windsurfDetected = fs.existsSync(path.join(cwd, '.windsurf'))
  const windsurfConfigured = fs.existsSync(path.join(cwd, '.windsurf', 'rules', 'prjct.md'))

  const GREEN = '\x1b[32m'

  console.log(`
${CYAN}p/${RESET} prjct v${VERSION}
${DIM}Context layer for AI coding agents${RESET}

${DIM}Providers:${RESET}`)

  // Claude status
  if (detection.claude.installed) {
    const status = claudeConfigured ? `${GREEN}✓ ready${RESET}` : `${YELLOW}● installed${RESET}`
    const ver = detection.claude.version ? ` (v${detection.claude.version})` : ''
    console.log(`  Claude Code   ${status}${DIM}${ver}${RESET}`)
  } else {
    console.log(`  Claude Code   ${DIM}○ not installed${RESET}`)
  }

  // Gemini status
  if (detection.gemini.installed) {
    const status = geminiConfigured ? `${GREEN}✓ ready${RESET}` : `${YELLOW}● installed${RESET}`
    const ver = detection.gemini.version ? ` (v${detection.gemini.version})` : ''
    console.log(`  Gemini CLI    ${status}${DIM}${ver}${RESET}`)
  } else {
    console.log(`  Gemini CLI    ${DIM}○ not installed${RESET}`)
  }

  // Cursor status (project-level)
  if (cursorDetected) {
    const status = cursorConfigured ? `${GREEN}✓ ready${RESET}` : `${YELLOW}● detected${RESET}`
    console.log(`  Cursor IDE    ${status}${DIM} (project)${RESET}`)
  } else {
    console.log(`  Cursor IDE    ${DIM}○ not detected${RESET}`)
  }

  // Windsurf status (project-level)
  if (windsurfDetected) {
    const status = windsurfConfigured ? `${GREEN}✓ ready${RESET}` : `${YELLOW}● detected${RESET}`
    console.log(`  Windsurf IDE  ${status}${DIM} (project)${RESET}`)
  } else {
    console.log(`  Windsurf IDE  ${DIM}○ not detected${RESET}`)
  }

  console.log(`
${DIM}Run 'prjct start' to configure (CLI providers)${RESET}
${DIM}Run 'prjct init' to configure (Cursor/Windsurf IDE)${RESET}
${CYAN}https://prjct.app${RESET}
`)
} else {
  // Check if setup has been done
  const configPath = path.join(os.homedir(), '.prjct-cli', 'config', 'installed-editors.json')
  const routersInstalled = checkRoutersInstalled()

  if (!fs.existsSync(configPath) || !routersInstalled) {
    // First time - prompt to run start
    console.log(`
${CYAN}${BOLD}  Welcome to prjct!${RESET}

  Run ${BOLD}prjct start${RESET} to configure your AI providers.

  ${DIM}This is a one-time setup that lets you choose between
  Claude Code, Gemini CLI, or both.${RESET}
`)
    process.exitCode = 0
  } else {
    // Check version and auto-update if needed
    try {
      const lastVersion = await editorsConfig.getLastVersion()

      if (lastVersion && lastVersion !== VERSION) {
        console.log(`\n${YELLOW}ℹ${RESET} Updating prjct v${lastVersion} → v${VERSION}...\n`)

        const { default: setup } = await import('../core/infrastructure/setup')
        await setup.run()
      }
    } catch (error) {
      // Silent fail on version check
    }

    // Continue to main CLI logic
    await import('../core/index')
  }
}
