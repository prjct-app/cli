/**
 * Command Installer
 * Installs prjct global config in Claude Code and other AI CLI agents.
 *
 * Simplified: No more router, templates, or module system.
 * prjct = data helper. Skills handle workflows natively.
 *
 * @version 1.0.0 - Post-template deprecation
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import type {
  CheckResult,
  GlobalConfigResult,
  InstallResult,
  SyncResult,
  UninstallResult,
} from '../types/infrastructure'
import { fileExists } from '../utils/file-helper'
import {
  installDocs as installDocsImpl,
  installGlobalConfig as installGlobalConfigImpl,
} from './command-installer/global-config'

// Re-export the installGlobalConfig used by external callers (e.g. update.ts).
// Defined here as a thin wrapper rather than a re-export for clarity.
export async function installGlobalConfig(): Promise<GlobalConfigResult> {
  return installGlobalConfigImpl()
}

export class CommandInstaller {
  homeDir: string
  commandsPath = ''
  configPath = ''
  private _initialized = false

  constructor() {
    this.homeDir = os.homedir()
  }

  private async ensureInit(): Promise<void> {
    if (this._initialized) return

    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    this.commandsPath = path.join(activeProvider.configDir, 'commands')
    this.configPath = activeProvider.configDir
    this._initialized = true
  }

  async detectActiveProvider(): Promise<boolean> {
    await this.ensureInit()
    return fileExists(this.configPath)
  }

  /**
   * Install commands to active AI agent (no-op — router deprecated)
   */
  async installCommands(): Promise<InstallResult> {
    const providerDetected = await this.detectActiveProvider()
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    if (!providerDetected) {
      return {
        success: false,
        error: `${activeProvider.displayName} not detected. Please install it first.`,
      }
    }

    await this.cleanupRouter()

    return { success: true, installed: [], path: this.commandsPath }
  }

  async uninstallCommands(): Promise<UninstallResult> {
    try {
      const uninstalled: string[] = []

      await this.ensureInit()
      for (const routerFile of ['p.md', 'p.toml']) {
        const routerPath = path.join(this.commandsPath, routerFile)
        try {
          await fs.unlink(routerPath)
          uninstalled.push(routerFile)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            return { success: false, error: getErrorMessage(error) }
          }
        }
      }

      return { success: true, uninstalled }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Check if commands are installed (skills-based — no router needed)
   */
  async checkInstallation(): Promise<CheckResult> {
    const providerDetected = await this.detectActiveProvider()

    if (!providerDetected) {
      return { installed: false, providerDetected: false }
    }

    return {
      installed: true,
      providerDetected: true,
      commands: [],
      path: this.commandsPath,
    }
  }

  async getInstallPath(): Promise<string> {
    await this.ensureInit()
    return this.commandsPath
  }

  /**
   * Sync commands - cleanup legacy router + update global config
   */
  async syncCommands(): Promise<SyncResult> {
    const providerDetected = await this.detectActiveProvider()

    if (!providerDetected) {
      return {
        success: false,
        error: 'AI agent not detected',
        added: 0,
        updated: 0,
        removed: 0,
      }
    }

    try {
      const cleaned = await this.cleanupRouter()

      return {
        success: true,
        added: 0,
        updated: 0,
        removed: cleaned ? 1 : 0,
      } as SyncResult
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        added: 0,
        updated: 0,
        removed: 0,
      }
    }
  }

  /**
   * Remove legacy router files (p.md, p.toml) from commands directory.
   */
  async cleanupRouter(): Promise<boolean> {
    await this.ensureInit()
    let cleaned = false

    for (const routerFile of ['p.md', 'p.toml']) {
      const routerPath = path.join(this.commandsPath, routerFile)
      try {
        await fs.unlink(routerPath)
        cleaned = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          // Log but don't fail
        }
      }
    }

    return cleaned
  }

  /**
   * Remove legacy ~/.claude/commands/p/ subdirectory (pre-v1.25 architecture).
   */
  async cleanupLegacyCommands(): Promise<boolean> {
    await this.ensureInit()
    const pSubdirPath = path.join(this.commandsPath, 'p')
    try {
      const stat = await fs.stat(pSubdirPath).catch(() => null)
      if (stat?.isDirectory()) {
        await fs.rm(pSubdirPath, { recursive: true, force: true })
        return true
      }
    } catch {
      // already gone
    }
    return false
  }

  async installGlobalConfig(): Promise<GlobalConfigResult> {
    return installGlobalConfigImpl()
  }

  /**
   * Full legacy cleanup — removes ALL stale prjct artifacts from all providers.
   * Called during `prjct update` to ensure clean migration.
   */
  async cleanupAllLegacy(): Promise<{ cleaned: string[] }> {
    const home = os.homedir()
    const cleaned: string[] = []

    const legacyFiles = [
      path.join(home, '.claude', 'commands', 'p.md'),
      path.join(home, '.claude', 'commands', 'p.toml'),
      path.join(home, '.gemini', 'commands', 'p.md'),
      path.join(home, '.gemini', 'commands', 'p.toml'),
    ]

    for (const filePath of legacyFiles) {
      try {
        await fs.unlink(filePath)
        cleaned.push(filePath)
      } catch {
        // Already gone
      }
    }

    const legacyDirs = [
      path.join(home, '.claude', 'commands', 'p'),
      path.join(home, '.gemini', 'commands', 'p'),
    ]

    for (const dirPath of legacyDirs) {
      try {
        const stat = await fs.stat(dirPath).catch(() => null)
        if (stat?.isDirectory()) {
          await fs.rm(dirPath, { recursive: true, force: true })
          cleaned.push(dirPath)
        }
      } catch {
        // Already gone
      }
    }

    const brewLegacy = [path.join(home, '.prjct-cli', 'config', 'homebrew-migrated')]

    for (const filePath of brewLegacy) {
      try {
        await fs.unlink(filePath)
        cleaned.push(filePath)
      } catch {
        // Already gone
      }
    }

    return { cleaned }
  }

  async installDocs(): Promise<{ success: boolean; error?: string }> {
    return installDocsImpl()
  }
}

/**
 * Get installation paths for all providers
 */
export function getProviderPaths(): {
  claude: { commands: string; config: string; router: string }
  gemini: { commands: string; config: string; router: string }
} {
  const homeDir = os.homedir()
  return {
    claude: {
      commands: path.join(homeDir, '.claude', 'commands'),
      config: path.join(homeDir, '.claude'),
      router: path.join(homeDir, '.claude', 'commands', 'p.md'),
    },
    gemini: {
      commands: path.join(homeDir, '.gemini', 'commands'),
      config: path.join(homeDir, '.gemini'),
      router: path.join(homeDir, '.gemini', 'commands', 'p.toml'),
    },
  }
}

const commandInstaller = new CommandInstaller()
export default commandInstaller
