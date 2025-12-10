/**
 * Detection - Legacy Installation Detection
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

export const legacyInstallDir = path.join(os.homedir(), '.prjct-cli')
export const npmGlobalProjectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')
export const isWindows = process.platform === 'win32'

/**
 * Check if legacy curl installation exists
 */
export async function hasLegacyInstallation(): Promise<boolean> {
  try {
    const stat = await fs.stat(legacyInstallDir)
    if (!stat.isDirectory()) return false

    // Check for .git directory (indicates curl install)
    try {
      await fs.access(path.join(legacyInstallDir, '.git'))
      return true
    } catch {
      // No .git, check for other legacy indicators
      const entries = await fs.readdir(legacyInstallDir)

      // Legacy has: bin/, core/, templates/, scripts/, package.json
      const legacyFiles = ['bin', 'core', 'templates', 'scripts', 'package.json']
      const hasLegacyFiles = legacyFiles.every((file) => entries.includes(file))

      if (hasLegacyFiles) {
        return true
      }

      // Only has projects/ and config/ = already migrated
      const onlyDataDirs = entries.every((entry) => ['projects', 'config'].includes(entry))
      return !onlyDataDirs
    }
  } catch {
    return false
  }
}

/**
 * Get npm global installation path
 */
export function getNpmGlobalPath(): string {
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return path.join(npmRoot, 'prjct-cli')
  } catch {
    // Fallback to common locations
    const nodePath = process.execPath
    const nodeDir = path.dirname(path.dirname(nodePath))
    return path.join(nodeDir, 'lib', 'node_modules', 'prjct-cli')
  }
}

/**
 * Check if user has npm global installation
 */
export async function hasNpmInstallation(): Promise<boolean> {
  try {
    execSync('npm list -g prjct-cli', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Get version of legacy installation
 */
export async function getLegacyVersion(): Promise<string | null> {
  try {
    const packageJsonPath = path.join(legacyInstallDir, 'package.json')
    const content = await fs.readFile(packageJsonPath, 'utf8')
    const pkg = JSON.parse(content)
    return pkg.version || 'unknown'
  } catch {
    return null
  }
}

/**
 * Quick check - silent, returns true if cleanup needed
 */
export async function needsCleanup(): Promise<boolean> {
  const hasLegacy = await hasLegacyInstallation()
  const hasNpm = await hasNpmInstallation()
  return hasLegacy && hasNpm
}
