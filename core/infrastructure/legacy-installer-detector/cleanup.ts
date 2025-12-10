/**
 * Cleanup - Legacy Installation Cleanup
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { legacyInstallDir, isWindows } from './detection'
import type { CleanupResult } from './types'

/**
 * Get platform-specific shell config files
 */
export function getShellConfigFiles(): string[] {
  if (isWindows) {
    const profilePaths: string[] = []

    if (process.env.USERPROFILE) {
      profilePaths.push(
        path.join(
          process.env.USERPROFILE,
          'Documents',
          'PowerShell',
          'Microsoft.PowerShell_profile.ps1'
        ),
        path.join(
          process.env.USERPROFILE,
          'Documents',
          'WindowsPowerShell',
          'Microsoft.PowerShell_profile.ps1'
        )
      )
    }

    return profilePaths
  } else {
    return [
      path.join(os.homedir(), '.zshrc'),
      path.join(os.homedir(), '.bashrc'),
      path.join(os.homedir(), '.profile'),
      path.join(os.homedir(), '.bash_profile'),
    ]
  }
}

/**
 * Remove legacy installation files (keep projects data)
 */
export async function cleanupLegacyInstallation(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: false,
    message: '',
  }

  try {
    const dirsToRemove = [
      'bin',
      'core',
      'templates',
      'scripts',
      'node_modules',
      '.git',
      '__tests__',
      'website',
      'docs',
      '.github',
    ]
    const filesToRemove = [
      'package.json',
      'package-lock.json',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'CLAUDE.md',
      'CONTRIBUTING.md',
      'MIGRATION.md',
      'TESTING.md',
      '.gitignore',
      '.eslintrc.js',
      '.prettierrc',
      'vitest.config.js',
      'vitest.workspace.js',
    ]

    let removedItems = 0

    for (const dir of dirsToRemove) {
      const dirPath = path.join(legacyInstallDir, dir)
      try {
        await fs.rm(dirPath, { recursive: true, force: true })
        removedItems++
      } catch {
        // Directory doesn't exist
      }
    }

    for (const file of filesToRemove) {
      const filePath = path.join(legacyInstallDir, file)
      try {
        await fs.unlink(filePath)
        removedItems++
      } catch {
        // File doesn't exist
      }
    }

    result.success = true
    result.message = `Removed ${removedItems} legacy installation items`
    return result
  } catch (error) {
    result.message = `Cleanup failed: ${(error as Error).message}`
    return result
  }
}

/**
 * Clean up legacy PATH entries from shell config files
 */
export async function cleanupLegacyPATH(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: false,
    message: '',
    filesModified: 0,
  }

  try {
    const shellConfigs = getShellConfigFiles()

    for (const configFile of shellConfigs) {
      try {
        const content = await fs.readFile(configFile, 'utf8')

        if (!content.includes('.prjct-cli/bin')) {
          continue
        }

        const lines = content.split('\n')
        const filteredLines = lines.filter((line) => {
          return !line.includes('.prjct-cli/bin') && !line.includes('# prjct/cli')
        })

        const cleanedLines: string[] = []
        for (let i = 0; i < filteredLines.length; i++) {
          const line = filteredLines[i]
          const prevLine = filteredLines[i - 1]

          if (line.trim() === '' && prevLine && prevLine.trim() === '') {
            continue
          }

          cleanedLines.push(line)
        }

        await fs.writeFile(configFile, cleanedLines.join('\n'), 'utf8')
        result.filesModified!++
      } catch {
        // File doesn't exist or can't read
      }
    }

    result.success = true
    result.message =
      result.filesModified! > 0
        ? `Cleaned PATH from ${result.filesModified} shell config(s)`
        : 'No legacy PATH entries found'

    return result
  } catch (error) {
    result.message = `PATH cleanup failed: ${(error as Error).message}`
    return result
  }
}

/**
 * Clean up legacy symlinks
 */
export async function cleanupLegacySymlinks(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: false,
    message: '',
  }

  if (isWindows) {
    result.success = true
    result.message = 'No symlinks on Windows'
    return result
  }

  try {
    const symlinkPath = path.join(os.homedir(), '.local', 'bin', 'prjct')

    try {
      const stat = await fs.lstat(symlinkPath)

      if (stat.isSymbolicLink()) {
        const target = await fs.readlink(symlinkPath)

        if (target.includes('.prjct-cli')) {
          await fs.unlink(symlinkPath)
          result.success = true
          result.message = 'Removed legacy symlink'
          return result
        }
      }
    } catch {
      // Symlink doesn't exist
    }

    result.success = true
    result.message = 'No legacy symlinks found'
    return result
  } catch (error) {
    result.message = `Symlink cleanup failed: ${(error as Error).message}`
    return result
  }
}
