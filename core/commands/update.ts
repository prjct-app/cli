/**
 * Update Command: prjct update
 *
 * Full system updater — 3 phases:
 * 1. Package update (auto-detects npm / pnpm / bun / yarn, plus homebrew migration)
 * 2. Global cleanup (all projects: migrate + sweep + reinstall commands)
 * 3. Daemon restart
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { CommandInstaller } from '../infrastructure/command-installer'
import editorsConfig from '../infrastructure/editors-config'
import pathManager from '../infrastructure/path-manager'
import UpdateChecker from '../infrastructure/update-checker'
import { migrateJsonToSqlite, sweepLegacyJson } from '../storage/migrate-json'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failFromError } from '../utils/md-aware'
import out from '../utils/output'
import { resetPackageRoot, VERSION } from '../utils/version'
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

// ── Package manager detection ──

type PkgManagerName = 'npm' | 'pnpm' | 'bun' | 'yarn'

interface PkgManager {
  name: PkgManagerName
  installArgs: string[] // e.g. ['install', '-g', 'prjct-cli@latest']
  /** Returns the path to the directory containing prjct-cli/, or null. */
  getInstallRoot: () => string | null
}

const HOME = os.homedir()

const MANAGERS: Record<PkgManagerName, PkgManager> = {
  npm: {
    name: 'npm',
    installArgs: ['install', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        return execSync('npm root -g', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch {
        return null
      }
    },
  },
  pnpm: {
    name: 'pnpm',
    installArgs: ['add', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        return execSync('pnpm root -g', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch {
        return null
      }
    },
  },
  bun: {
    name: 'bun',
    installArgs: ['add', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => path.join(HOME, '.bun', 'install', 'global', 'node_modules'),
  },
  yarn: {
    name: 'yarn',
    installArgs: ['global', 'add', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        const dir = execSync('yarn global dir', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
        return path.join(dir, 'node_modules')
      } catch {
        return null
      }
    },
  },
}

/** Whether `name` resolves to an executable in the current PATH. */
function isOnPath(name: PkgManagerName): boolean {
  try {
    execSync(`command -v ${name}`, { stdio: 'pipe', shell: '/bin/sh' })
    return true
  } catch {
    return false
  }
}

/**
 * Detect which package manager owns the running prjct binary by inspecting
 * its real path. Falls back to npm if no signal is found.
 */
function detectInstallerFromRunningBinary(): PkgManagerName | null {
  const candidates = [process.argv[1], process.execPath].filter(Boolean) as string[]
  for (const candidate of candidates) {
    let real = candidate
    try {
      real = require('node:fs').realpathSync(candidate)
    } catch {
      // ignore
    }
    if (real.includes('/.bun/install/global') || real.includes('/.bun/bin/')) return 'bun'
    if (real.includes('/Library/pnpm/') || real.includes('/.pnpm/')) return 'pnpm'
    if (real.includes('/.local/share/pnpm/')) return 'pnpm'
    if (real.includes('/.yarn/') || real.includes('/yarn/global')) return 'yarn'
  }
  return null
}

/**
 * Pick the package manager to use for the upgrade.
 * Priority: detected installer (if available on PATH) → first available among
 * bun/pnpm/npm/yarn. Throws if none are available.
 */
function selectPackageManager(): PkgManager {
  const detected = detectInstallerFromRunningBinary()
  if (detected && isOnPath(detected)) return MANAGERS[detected]

  for (const name of ['bun', 'pnpm', 'npm', 'yarn'] as PkgManagerName[]) {
    if (isOnPath(name)) return MANAGERS[name]
  }
  throw new Error(
    'No supported package manager found in PATH (tried npm, pnpm, bun, yarn). ' +
      'Install one and re-run, or upgrade manually: bun add -g prjct-cli@latest'
  )
}

interface InstalledLocation {
  pm: PkgManager
  version: string
}

/**
 * Find every package manager that has prjct-cli installed globally.
 * Returns one entry per manager, with the version read from its package.json.
 * Use this to update all installs (not just the running binary's manager) —
 * users with multiple installs (e.g. bun + nvm npm) hit PATH-resolution bugs
 * where updating one leaves the other stale and shadowing it.
 */
function getAllInstalledLocations(): InstalledLocation[] {
  const found: InstalledLocation[] = []
  for (const pm of [MANAGERS.bun, MANAGERS.pnpm, MANAGERS.npm, MANAGERS.yarn]) {
    const root = pm.getInstallRoot()
    if (!root) continue
    const pkgPath = path.join(root, 'prjct-cli', 'package.json')
    try {
      const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'))
      if (pkg?.name === 'prjct-cli' && typeof pkg.version === 'string') {
        found.push({ pm, version: pkg.version })
      }
    } catch {
      // not installed via this manager
    }
  }
  return found
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

      // After Phase 1, redirect to the INSTALLED package.
      // The running process may have started from source (npm link / bun link)
      // or from the old install. All Phase 2+3 operations must use the
      // newly installed files, not the source/old paths.
      if (!dryRun && results.phase1.success) {
        this.redirectToInstalledPackage()
      }

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
      return failFromError(error)
    }
  }

  // ── Phase 1: Package Update ──

  private async phasePackageUpdate(dryRun: boolean): Promise<PhaseResult> {
    const result: PhaseResult = { success: true, details: [], errors: [] }
    const installsBefore = getAllInstalledLocations()

    if (dryRun) {
      const homebrew = isHomebrewInstall()
      if (homebrew) {
        let pmName: string
        try {
          pmName = selectPackageManager().name
        } catch (err) {
          pmName = '<none-available>'
          result.errors.push(getErrorMessage(err))
        }
        result.details.push('Would uninstall homebrew formula')
        result.details.push(`Would install via ${pmName}`)
      } else if (installsBefore.length === 0) {
        let pmName: string
        try {
          pmName = selectPackageManager().name
        } catch (err) {
          pmName = '<none-available>'
          result.errors.push(getErrorMessage(err))
        }
        result.details.push(`Would install via ${pmName}`)
      } else {
        for (const { pm, version } of installsBefore) {
          result.details.push(`Would reinstall via ${pm.name} (currently v${version})`)
        }
      }
      return result
    }

    try {
      const homebrew = isHomebrewInstall()

      if (homebrew) {
        // Migrate from homebrew to a node package manager
        try {
          execSync('brew uninstall prjct-cli 2>/dev/null', { stdio: 'pipe' })
          result.details.push('Uninstalled homebrew formula')
        } catch {
          result.details.push('Homebrew uninstall skipped (not found)')
        }
      }

      // Determine which managers to install with:
      // - If installs already exist, update each of them (preserves user's
      //   chosen PMs; fixes PATH-shadowing when there are duplicates).
      // - Otherwise (homebrew migration or fresh install), use the detected PM.
      let targets: PkgManager[]
      if (installsBefore.length > 0) {
        targets = installsBefore.map((i) => i.pm)
      } else {
        targets = [selectPackageManager()]
      }

      for (const pm of targets) {
        if (!isOnPath(pm.name)) {
          result.errors.push(
            `${pm.name} is not on PATH but has a prjct-cli install. ` +
              `Either install ${pm.name} or remove that copy.`
          )
          continue
        }
        try {
          // Use install @latest (rather than `update`) to bypass semver range
          // constraints and always fetch the true latest from the registry.
          execSync([pm.name, ...pm.installArgs].join(' '), { stdio: 'pipe' })
          result.details.push(`${pm.name} install complete`)
        } catch (err) {
          result.errors.push(`${pm.name}: ${getErrorMessage(err)}`)
        }
      }

      // Per-install version transitions
      const installsAfter = getAllInstalledLocations()
      const beforeMap = new Map(installsBefore.map((i) => [i.pm.name, i.version]))
      const transitions: string[] = []
      let anyChange = false

      for (const { pm, version } of installsAfter) {
        const before = beforeMap.get(pm.name)
        if (before && before !== version) {
          transitions.push(`${pm.name}: ${before} → ${version}`)
          anyChange = true
        } else if (!before) {
          transitions.push(`${pm.name}: installed v${version}`)
          anyChange = true
        }
      }

      if (transitions.length > 1) {
        // Multiple installs: list them all so user knows everything got synced
        for (const t of transitions) result.details.push(t)
      } else if (transitions.length === 1) {
        result.details.push(transitions[0]!)
      } else if (installsAfter.length > 0) {
        result.details.push(`v${installsAfter[0]!.version} (already latest)`)
      }

      // Warn about installs that exist post-update but weren't there before
      // (shouldn't happen — but in case homebrew left something behind)
      void anyChange
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
              // Read template from bundle (installed files), not source
              const { getTemplateContent } = await import('../agentic/template-loader')
              const template = getTemplateContent('global/GEMINI.md')

              if (template?.includes(startMarker) && template.includes(endMarker)) {
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
   * After Phase 1 installs the new package via npm, redirect PACKAGE_ROOT
   * and template cache to the INSTALLED package location.
   *
   * Without this, the running process keeps using paths from whatever
   * started it (source tree via npm link, old install, etc.).
   * Phase 2+3 must operate on the installed files, not source.
   */
  private redirectToInstalledPackage(): void {
    try {
      const { existsSync, realpathSync, readFileSync } = require('node:fs')

      // Walk every known global node_modules root and pick the first one
      // that holds a real prjct-cli package.json. pnpm installs as a symlink
      // into its content-addressable store (.pnpm/prjct-cli@x.y.z/...) — that
      // is a real install, not a link back to our source tree, so we follow
      // symlinks via realpath and verify the resolved target is not the
      // current source root.
      const sourceRoot = (() => {
        try {
          return realpathSync(path.resolve(__dirname, '..', '..'))
        } catch {
          return ''
        }
      })()

      const roots = [
        MANAGERS.bun.getInstallRoot(),
        MANAGERS.pnpm.getInstallRoot(),
        MANAGERS.npm.getInstallRoot(),
        MANAGERS.yarn.getInstallRoot(),
      ].filter((p): p is string => !!p)

      for (const root of roots) {
        const candidate = path.join(root, 'prjct-cli')
        const pkgJsonPath = path.join(candidate, 'package.json')
        if (!existsSync(pkgJsonPath)) continue

        let resolved = candidate
        try {
          resolved = realpathSync(candidate)
        } catch {
          // ignore
        }

        // Skip if the install resolves back to our source tree (e.g. npm link)
        if (sourceRoot && resolved === sourceRoot) continue

        try {
          const pkg = JSON.parse(readFileSync(path.join(resolved, 'package.json'), 'utf-8'))
          if (pkg?.name !== 'prjct-cli') continue
        } catch {
          continue
        }

        resetPackageRoot(resolved)
        const { resetBundle } = require('../agentic/template-loader')
        resetBundle()
        return
      }
    } catch {
      // Non-blocking: fall through to use current PACKAGE_ROOT
    }
  }

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
