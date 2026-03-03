/**
 * Update Command: prjct update
 *
 * Full system updater — 3 phases:
 * 1. Package update (npm/homebrew → npm)
 * 2. Global cleanup (all projects: migrate + sweep + reinstall commands)
 * 3. Daemon restart
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import { CommandInstaller } from '../infrastructure/command-installer'
import editorsConfig from '../infrastructure/editors-config'
import pathManager from '../infrastructure/path-manager'
import UpdateChecker from '../infrastructure/update-checker'
import { migrateJsonToSqlite, sweepLegacyJson } from '../storage/migrate-json'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { VERSION } from '../utils/version'
import { PrjctCommandsBase } from './base'

interface UpdateOptions {
  'dry-run'?: boolean
  md?: boolean
}

interface PhaseResult {
  success: boolean
  details: string[]
  errors: string[]
}

/**
 * Detect if prjct-cli is installed via homebrew
 */
function isHomebrewInstall(): boolean {
  try {
    const result = execSync('brew list prjct-cli 2>/dev/null', { encoding: 'utf-8' })
    return !!result
  } catch {
    return false
  }
}

/**
 * Get current installed version
 */
function getCurrentVersion(): string | null {
  try {
    const result = execSync('npm list -g prjct-cli --depth=0 2>/dev/null', { encoding: 'utf-8' })
    const match = result.match(/prjct-cli@([\d.]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export class UpdateCommands extends PrjctCommandsBase {
  /**
   * prjct update [--dry-run] [--md]
   *
   * 3-phase system updater:
   * 1. Package update (npm update or homebrew→npm migration)
   * 2. Global cleanup (all projects: migrations + command reinstall)
   * 3. Daemon restart
   */
  async update(
    options: UpdateOptions = {},
    _projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const dryRun = options['dry-run'] === true
    const md = options.md === true

    const results: { phase1: PhaseResult; phase2: PhaseResult; phase3: PhaseResult } = {
      phase1: { success: true, details: [], errors: [] },
      phase2: { success: true, details: [], errors: [] },
      phase3: { success: true, details: [], errors: [] },
    }

    try {
      // ── Phase 1: Package Update ──
      if (!md) out.step(1, 3, 'Updating package...')
      results.phase1 = await this.phasePackageUpdate(dryRun)
      if (!md) out.stop()

      // ── Phase 2: Global Cleanup ──
      if (!md) out.step(2, 3, 'Cleaning up all projects...')
      results.phase2 = await this.phaseGlobalCleanup(dryRun)
      if (!md) out.stop()

      // ── Phase 3: Daemon Restart ──
      if (!md) out.step(3, 3, 'Restarting daemon...')
      results.phase3 = await this.phaseDaemonRestart(dryRun)
      if (!md) out.stop()

      // ── Post-update: stamp version + clear cache ──
      if (!dryRun) {
        try {
          await editorsConfig.updateVersion(VERSION)
        } catch {
          // Non-blocking
        }
        try {
          const checker = new UpdateChecker()
          await checker.writeCache({ lastCheck: 0, latestVersion: '' })
        } catch {
          // Non-blocking
        }
      }

      // ── Output ──
      if (md) {
        return this.formatMdOutput(results, dryRun)
      }

      return this.formatTerminalOutput(results, dryRun)
    } catch (error) {
      if (!md) out.stop()
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  // ── Phase 1: Package Update ──

  private async phasePackageUpdate(dryRun: boolean): Promise<PhaseResult> {
    const result: PhaseResult = { success: true, details: [], errors: [] }
    const versionBefore = getCurrentVersion()

    if (dryRun) {
      const homebrew = isHomebrewInstall()
      if (homebrew) {
        result.details.push('Would uninstall homebrew formula')
        result.details.push('Would install via npm: npm install -g prjct-cli')
      } else {
        result.details.push('Would run: npm update -g prjct-cli')
      }
      return result
    }

    try {
      const homebrew = isHomebrewInstall()

      if (homebrew) {
        // Migrate from homebrew to npm
        try {
          execSync('brew uninstall prjct-cli 2>/dev/null', { stdio: 'pipe' })
          result.details.push('Uninstalled homebrew formula')
        } catch {
          result.details.push('Homebrew uninstall skipped (not found)')
        }

        execSync('npm install -g prjct-cli@latest', { stdio: 'pipe' })
        result.details.push('Installed via npm')
      } else {
        // Use install @latest instead of update to bypass semver range constraints
        // and always fetch the true latest from the registry
        execSync('npm install -g prjct-cli@latest', { stdio: 'pipe' })
        result.details.push('npm install complete')
      }

      // Verify version
      const versionAfter = getCurrentVersion()
      if (versionBefore && versionAfter && versionBefore !== versionAfter) {
        result.details.push(`${versionBefore} → ${versionAfter}`)
      } else if (versionAfter) {
        result.details.push(`v${versionAfter} (already latest)`)
      }
    } catch (err) {
      result.success = false
      result.errors.push(getErrorMessage(err))
    }

    return result
  }

  // ── Phase 2: Global Cleanup ──

  private async phaseGlobalCleanup(dryRun: boolean): Promise<PhaseResult> {
    const result: PhaseResult = { success: true, details: [], errors: [] }

    // 2a. Migrate all projects
    const projectIds = await this.getAllProjectIds()

    if (projectIds.length === 0) {
      result.details.push('No projects found')
    } else {
      let totalMigrated = 0
      let totalSwept = 0

      for (const projectId of projectIds) {
        if (dryRun) continue

        try {
          const migrationResult = await migrateJsonToSqlite(projectId)
          const swept = await sweepLegacyJson(projectId)
          totalMigrated += migrationResult.migratedFiles.length
          totalSwept += swept

          if (migrationResult.errors.length > 0) {
            for (const err of migrationResult.errors) {
              result.errors.push(`${projectId.slice(0, 8)}: ${err.file}: ${err.error}`)
            }
          }
        } catch (err) {
          result.errors.push(`${projectId.slice(0, 8)}: ${getErrorMessage(err)}`)
        }
      }

      if (dryRun) {
        result.details.push(`Would migrate ${projectIds.length} project(s)`)
      } else {
        const parts = [`${projectIds.length} project(s) checked`]
        if (totalMigrated > 0) parts.push(`${totalMigrated} files migrated`)
        if (totalSwept > 0) parts.push(`${totalSwept} leftovers swept`)
        result.details.push(parts.join(', '))
      }
    }

    // 2b. Full legacy cleanup + reinstall
    if (dryRun) {
      result.details.push('Would clean all legacy artifacts')
      result.details.push('Would reinstall editor commands')
      result.details.push('Would reinstall global config (all providers)')
    } else {
      // Clean ALL legacy artifacts first (routers, subdirs, homebrew remnants)
      try {
        const installer = new CommandInstaller()
        const legacyResult = await installer.cleanupAllLegacy()
        if (legacyResult.cleaned.length > 0) {
          result.details.push(`Cleaned ${legacyResult.cleaned.length} legacy artifact(s)`)
        }
      } catch (err) {
        result.errors.push(`Legacy cleanup: ${getErrorMessage(err)}`)
      }

      // Reinstall editor commands
      try {
        const installer = new CommandInstaller()
        const installResult = await installer.installCommands()
        result.details.push(
          `Editor commands reinstalled (${installResult.installed?.length || 0} providers)`
        )
      } catch (err) {
        result.errors.push(`Commands: ${getErrorMessage(err)}`)
      }

      // Reinstall global config (replaces old prjct section between markers)
      try {
        const installer = new CommandInstaller()
        await installer.installGlobalConfig()
        result.details.push('Global config updated (prjct section replaced)')
      } catch (err) {
        result.errors.push(`Global config: ${getErrorMessage(err)}`)
      }

      // Install global config for ALL detected providers (not just active)
      try {
        const { detectAllProviders } = await import('../infrastructure/ai-provider')
        const detection = await detectAllProviders()
        const home = path.join(require('node:os').homedir())

        // Claude: installGlobalConfig already handles active provider
        // Gemini: ensure GEMINI.md is also updated
        if (detection.gemini.installed) {
          const geminiPath = path.join(home, '.gemini', 'GEMINI.md')
          try {
            const geminiContent = await fs.readFile(geminiPath, 'utf-8')
            const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
            const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

            if (geminiContent.includes(startMarker) && geminiContent.includes(endMarker)) {
              // Read fresh template
              const templatePath = path.join(
                path.dirname(require.resolve('../../package.json')),
                'templates',
                'global',
                'GEMINI.md'
              )
              const template = await fs.readFile(templatePath, 'utf-8')
              const prjctSection = template.substring(
                template.indexOf(startMarker),
                template.indexOf(endMarker) + endMarker.length
              )

              const before = geminiContent.substring(0, geminiContent.indexOf(startMarker))
              const after = geminiContent.substring(
                geminiContent.indexOf(endMarker) + endMarker.length
              )

              // Strip legacy prjct-project sections
              let cleaned = before + prjctSection + after
              const projStart = '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
              const projEnd = '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'
              if (cleaned.includes(projStart) && cleaned.includes(projEnd)) {
                const bp = cleaned.substring(0, cleaned.indexOf(projStart))
                const ap = cleaned.substring(cleaned.indexOf(projEnd) + projEnd.length)
                cleaned = `${(bp + ap).replace(/\n{3,}/g, '\n\n').trim()}\n`
              }

              await fs.writeFile(geminiPath, cleaned, 'utf-8')
              result.details.push('Gemini global config updated')
            }
          } catch {
            // Gemini not configured — skip
          }
        }
      } catch {
        // Provider detection failed — non-critical
      }
    }

    if (result.errors.length > 0) result.success = false
    return result
  }

  // ── Phase 3: Daemon Restart ──

  private async phaseDaemonRestart(dryRun: boolean): Promise<PhaseResult> {
    const result: PhaseResult = { success: true, details: [], errors: [] }

    if (dryRun) {
      result.details.push('Would restart daemon')
      return result
    }

    try {
      const { isDaemonRunning, stopDaemon, forceKillDaemon, spawnDaemon } = await import(
        '../daemon/client'
      )

      // Stop (graceful → force)
      if (await isDaemonRunning()) {
        const stopped = await stopDaemon()
        if (!stopped) {
          forceKillDaemon()
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
        result.details.push('Daemon stopped')
      } else {
        // Clean up stale files
        forceKillDaemon()
        result.details.push('No running daemon (cleaned stale files)')
      }

      // Respawn (non-fatal: daemon auto-starts on next command if this fails)
      const started = await spawnDaemon()
      if (started) {
        result.details.push('Daemon restarted')
      } else {
        result.details.push('Daemon will start automatically on next use')
      }
    } catch (err) {
      result.success = false
      result.errors.push(getErrorMessage(err))
    }

    return result
  }

  // ── Output Formatting ──

  private formatTerminalOutput(
    results: { phase1: PhaseResult; phase2: PhaseResult; phase3: PhaseResult },
    dryRun: boolean
  ): CommandResult {
    // Daemon restart is non-fatal: package + cleanup determine overall success
    const allSuccess = results.phase1.success && results.phase2.success
    const allErrors = [...results.phase1.errors, ...results.phase2.errors]

    console.log('')

    const phases = [
      { label: 'Package', result: results.phase1, fatal: true },
      { label: 'Cleanup', result: results.phase2, fatal: true },
      { label: 'Daemon', result: results.phase3, fatal: false },
    ]

    for (const { label, result, fatal } of phases) {
      const icon = result.success ? chalk.green('✓') : fatal ? chalk.red('✗') : chalk.yellow('⚠')
      console.log(`  ${icon} ${chalk.bold(label)}`)
      for (const detail of result.details) {
        console.log(`    ${chalk.dim(detail)}`)
      }
      for (const err of result.errors) {
        console.log(`    ${chalk.yellow('⚠')} ${err}`)
      }
    }

    console.log('')

    if (dryRun) {
      out.done('Dry run complete — no changes made')
    } else if (allSuccess) {
      out.done('System updated')
    } else {
      out.warn(`Updated with ${allErrors.length} error(s)`)
    }

    return {
      success: allSuccess,
      message: dryRun ? 'Dry run complete' : allSuccess ? 'System updated' : 'Updated with errors',
    }
  }

  private formatMdOutput(
    results: { phase1: PhaseResult; phase2: PhaseResult; phase3: PhaseResult },
    dryRun: boolean
  ): CommandResult {
    // Daemon restart is non-fatal
    const allSuccess = results.phase1.success && results.phase2.success
    const lines: string[] = []

    lines.push(dryRun ? '# Update (Dry Run)' : '# System Update')
    lines.push('')

    const phases = [
      { label: 'Package Update', result: results.phase1, fatal: true },
      { label: 'Global Cleanup', result: results.phase2, fatal: true },
      { label: 'Daemon Restart', result: results.phase3, fatal: false },
    ]

    for (const { label, result, fatal } of phases) {
      const status = result.success ? 'OK' : fatal ? 'FAILED' : 'WARNING'
      lines.push(`## ${label} (${status})`)
      for (const detail of result.details) {
        lines.push(`- ${detail}`)
      }
      for (const err of result.errors) {
        lines.push(`- WARNING: ${err}`)
      }
      lines.push('')
    }

    if (!dryRun) {
      lines.push(
        allSuccess
          ? '**Status:** All phases completed successfully.'
          : '**Status:** Completed with errors.'
      )
    }

    console.log(lines.join('\n'))

    return {
      success: allSuccess,
      message: dryRun ? 'Dry run complete' : allSuccess ? 'System updated' : 'Updated with errors',
    }
  }

  // ── Helpers ──

  /**
   * Scan ~/.prjct-cli/projects/ for all project directories
   */
  private async getAllProjectIds(): Promise<string[]> {
    const projectsDir = path.join(pathManager.getGlobalBasePath(), 'projects')

    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    } catch {
      return []
    }
  }
}
