/**
 * Uninstall Command
 *
 * Complete system removal of prjct-cli.
 * Handles cleanup of all prjct files, configurations, and installations.
 *
 * @version 1.0.0
 */

import { execSync } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import chalk from 'chalk'
import { getProviderPaths } from '../infrastructure/command-installer'
import pathManager from '../infrastructure/path-manager'
import type { CommandResult, UninstallOptions } from '../types'
import { PrjctCommandsBase } from './base'

// Markers for prjct section in CLAUDE.md
const PRJCT_START_MARKER = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
const PRJCT_END_MARKER = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

interface UninstallItem {
  path: string
  type: 'directory' | 'file' | 'section'
  description: string
  size?: number
  count?: number
  exists: boolean
}

interface InstallationInfo {
  homebrew: boolean
  npm: boolean
  homebrewFormula?: string
}

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(entryPath)
      } else {
        try {
          const stats = await fs.stat(entryPath)
          totalSize += stats.size
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return totalSize
}

/**
 * Format bytes to human readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / 1024 ** i

  return `${size.toFixed(1)} ${units[i]}`
}

/**
 * Count items in a directory
 */
async function countDirectoryItems(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).length
  } catch {
    return 0
  }
}

/**
 * Detect installation method
 */
function detectInstallation(): InstallationInfo {
  const info: InstallationInfo = {
    homebrew: false,
    npm: false,
  }

  // Check Homebrew
  try {
    const result = execSync('brew list prjct-cli 2>/dev/null', { encoding: 'utf-8' })
    if (result) {
      info.homebrew = true
      info.homebrewFormula = 'prjct-cli'
    }
  } catch {
    // Not installed via Homebrew
  }

  // Check npm global
  try {
    const result = execSync('npm list -g prjct-cli --depth=0 2>/dev/null', { encoding: 'utf-8' })
    if (result.includes('prjct-cli')) {
      info.npm = true
    }
  } catch {
    // Not installed via npm
  }

  return info
}

/**
 * Gather all items to uninstall
 */
async function gatherUninstallItems(): Promise<UninstallItem[]> {
  const items: UninstallItem[] = []
  const providerPaths = getProviderPaths()

  // 1. ~/.prjct-cli/ (main data directory)
  const prjctCliPath = pathManager.getGlobalBasePath()
  const prjctCliExists = fsSync.existsSync(prjctCliPath)
  const projectCount = prjctCliExists
    ? await countDirectoryItems(path.join(prjctCliPath, 'projects'))
    : 0
  const prjctCliSize = prjctCliExists ? await getDirectorySize(prjctCliPath) : 0

  items.push({
    path: prjctCliPath,
    type: 'directory',
    description: `All project data${projectCount > 0 ? `, ${projectCount} project${projectCount > 1 ? 's' : ''}` : ''}`,
    size: prjctCliSize,
    count: projectCount,
    exists: prjctCliExists,
  })

  // 2. ~/.claude/CLAUDE.md (prjct section only)
  const claudeMdPath = path.join(providerPaths.claude.config, 'CLAUDE.md')
  const claudeMdExists = fsSync.existsSync(claudeMdPath)
  let hasPrjctSection = false

  if (claudeMdExists) {
    try {
      const content = fsSync.readFileSync(claudeMdPath, 'utf-8')
      hasPrjctSection = content.includes(PRJCT_START_MARKER) && content.includes(PRJCT_END_MARKER)
    } catch {
      // Can't read file
    }
  }

  items.push({
    path: claudeMdPath,
    type: 'section',
    description: 'prjct section in CLAUDE.md',
    exists: claudeMdExists && hasPrjctSection,
  })

  // 3. ~/.claude/commands/p/ (prjct commands)
  const claudeCommandsPath = providerPaths.claude.commands
  const claudeCommandsExists = fsSync.existsSync(claudeCommandsPath)
  const claudeCommandsSize = claudeCommandsExists ? await getDirectorySize(claudeCommandsPath) : 0

  items.push({
    path: claudeCommandsPath,
    type: 'directory',
    description: 'Claude commands',
    size: claudeCommandsSize,
    exists: claudeCommandsExists,
  })

  // 4. ~/.claude/commands/p.md (router)
  const claudeRouterPath = providerPaths.claude.router
  const claudeRouterExists = fsSync.existsSync(claudeRouterPath)

  items.push({
    path: claudeRouterPath,
    type: 'file',
    description: 'Claude router',
    exists: claudeRouterExists,
  })

  // 5. ~/.claude/prjct-statusline.sh (status line script)
  const statusLinePath = path.join(providerPaths.claude.config, 'prjct-statusline.sh')
  const statusLineExists = fsSync.existsSync(statusLinePath)

  items.push({
    path: statusLinePath,
    type: 'file',
    description: 'Status line script',
    exists: statusLineExists,
  })

  // 6. ~/.gemini/commands/p.toml (Gemini router, if exists)
  const geminiRouterPath = providerPaths.gemini.router
  const geminiRouterExists = fsSync.existsSync(geminiRouterPath)

  items.push({
    path: geminiRouterPath,
    type: 'file',
    description: 'Gemini router',
    exists: geminiRouterExists,
  })

  // 7. ~/.gemini/GEMINI.md (prjct section only, if exists)
  const geminiMdPath = path.join(providerPaths.gemini.config, 'GEMINI.md')
  const geminiMdExists = fsSync.existsSync(geminiMdPath)
  let hasGeminiPrjctSection = false

  if (geminiMdExists) {
    try {
      const content = fsSync.readFileSync(geminiMdPath, 'utf-8')
      hasGeminiPrjctSection =
        content.includes(PRJCT_START_MARKER) && content.includes(PRJCT_END_MARKER)
    } catch {
      // Can't read file
    }
  }

  if (geminiMdExists && hasGeminiPrjctSection) {
    items.push({
      path: geminiMdPath,
      type: 'section',
      description: 'prjct section in GEMINI.md',
      exists: true,
    })
  }

  return items
}

/**
 * Remove prjct section from a markdown file
 */
async function removePrjctSection(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')

    if (!content.includes(PRJCT_START_MARKER) || !content.includes(PRJCT_END_MARKER)) {
      return false
    }

    const startIndex = content.indexOf(PRJCT_START_MARKER)
    const endIndex = content.indexOf(PRJCT_END_MARKER) + PRJCT_END_MARKER.length

    // Remove the section and any trailing newlines
    let newContent = content.substring(0, startIndex) + content.substring(endIndex)
    newContent = newContent.replace(/\n{3,}/g, '\n\n').trim()

    // If the file is now empty or just whitespace, delete it
    if (!newContent || newContent.trim().length === 0) {
      await fs.unlink(filePath)
    } else {
      await fs.writeFile(filePath, `${newContent}\n`, 'utf-8')
    }

    return true
  } catch {
    return false
  }
}

/**
 * Create backup of prjct data
 */
async function createBackup(): Promise<string | null> {
  const homeDir = os.homedir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const backupDir = path.join(homeDir, `.prjct-backup-${timestamp}`)

  try {
    await fs.mkdir(backupDir, { recursive: true })

    const prjctCliPath = pathManager.getGlobalBasePath()

    if (fsSync.existsSync(prjctCliPath)) {
      // Copy entire .prjct-cli directory
      await copyDirectory(prjctCliPath, path.join(backupDir, '.prjct-cli'))
    }

    return backupDir
  } catch {
    return null
  }
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Perform the actual uninstallation
 */
async function performUninstall(
  items: UninstallItem[],
  installation: InstallationInfo,
  options: UninstallOptions
): Promise<{ deleted: string[]; errors: string[] }> {
  const deleted: string[] = []
  const errors: string[] = []

  for (const item of items) {
    if (!item.exists) continue

    try {
      if (item.type === 'section') {
        // Remove prjct section from file
        const success = await removePrjctSection(item.path)
        if (success) {
          deleted.push(item.path)
        }
      } else if (item.type === 'directory') {
        await fs.rm(item.path, { recursive: true, force: true })
        deleted.push(item.path)
      } else if (item.type === 'file') {
        await fs.unlink(item.path)
        deleted.push(item.path)
      }
    } catch (error) {
      errors.push(`${item.path}: ${(error as Error).message}`)
    }
  }

  // Uninstall package managers
  if (!options.keepPackage) {
    if (installation.homebrew && installation.homebrewFormula) {
      try {
        if (!options.dryRun) {
          execSync(`brew uninstall ${installation.homebrewFormula}`, { stdio: 'pipe' })
        }
        deleted.push('Homebrew: prjct-cli')
      } catch (error) {
        errors.push(`Homebrew: ${(error as Error).message}`)
      }
    }

    if (installation.npm) {
      try {
        if (!options.dryRun) {
          execSync('npm uninstall -g prjct-cli', { stdio: 'pipe' })
        }
        deleted.push('npm: prjct-cli')
      } catch (error) {
        errors.push(`npm: ${(error as Error).message}`)
      }
    }
  }

  return { deleted, errors }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'uninstall')
    })
  })
}

/**
 * Main uninstall function
 */
export async function uninstall(
  options: UninstallOptions = {},
  _projectPath: string = process.cwd()
): Promise<CommandResult> {
  const items = await gatherUninstallItems()
  const installation = detectInstallation()
  const existingItems = items.filter((i) => i.exists)

  // Check if there's anything to uninstall
  if (existingItems.length === 0 && !installation.homebrew && !installation.npm) {
    console.log(chalk.yellow('\nNo prjct installation found.'))
    return {
      success: true,
      message: 'Nothing to uninstall',
    }
  }

  // Calculate total size
  const totalSize = existingItems.reduce((sum, item) => sum + (item.size || 0), 0)

  // Display warning and items
  console.log('')
  console.log(chalk.red.bold('  WARNING: This action is DANGEROUS and IRREVERSIBLE'))
  console.log('')
  console.log(chalk.white('The following will be permanently deleted:'))
  console.log('')

  for (const item of existingItems) {
    const displayPath = pathManager.getDisplayPath(item.path)
    let info = ''

    if (item.type === 'section') {
      info = chalk.dim('(section only)')
    } else if (item.size) {
      info = chalk.dim(`(${formatSize(item.size)})`)
    }

    console.log(`  ${chalk.cyan(displayPath.padEnd(35))} ${info}`)
    console.log(`  ${chalk.dim(item.description)}`)
    console.log('')
  }

  // Show package manager installations
  if (installation.homebrew) {
    console.log(`  ${chalk.cyan('Homebrew'.padEnd(35))} ${chalk.dim('prjct-cli formula')}`)
    console.log('')
  }

  if (installation.npm) {
    console.log(`  ${chalk.cyan('npm global'.padEnd(35))} ${chalk.dim('prjct-cli package')}`)
    console.log('')
  }

  if (totalSize > 0) {
    console.log(chalk.dim(`  Total size: ${formatSize(totalSize)}`))
    console.log('')
  }

  // Handle dry run
  if (options.dryRun) {
    console.log(chalk.yellow('Dry run - no changes made'))
    return {
      success: true,
      message: 'Dry run complete',
      itemsFound: existingItems.length,
    }
  }

  // Handle backup
  if (options.backup) {
    console.log(chalk.blue('Creating backup...'))
    const backupPath = await createBackup()

    if (backupPath) {
      console.log(chalk.green(`Backup created: ${pathManager.getDisplayPath(backupPath)}`))
      console.log('')
    } else {
      console.log(chalk.yellow('Failed to create backup, continuing...'))
    }
  }

  // Require confirmation unless --force
  if (!options.force) {
    console.log(chalk.yellow('Type "uninstall" to confirm:'))
    const confirmed = await promptConfirmation('> ')

    if (!confirmed) {
      console.log(chalk.yellow('\nUninstall cancelled.'))
      return {
        success: false,
        message: 'Uninstall cancelled by user',
      }
    }
  }

  // Perform uninstallation
  console.log('')
  console.log(chalk.blue('Removing prjct...'))

  const { deleted, errors } = await performUninstall(items, installation, options)

  // Report results
  console.log('')

  if (deleted.length > 0) {
    console.log(chalk.green(`Removed ${deleted.length} items`))
  }

  if (errors.length > 0) {
    console.log(chalk.yellow(`\n${errors.length} errors:`))
    for (const error of errors) {
      console.log(chalk.red(`  - ${error}`))
    }
  }

  console.log('')
  console.log(chalk.green('prjct has been uninstalled.'))
  console.log(chalk.dim('Thanks for using prjct! We hope to see you again.'))
  console.log('')

  return {
    success: errors.length === 0,
    message: `Removed ${deleted.length} items`,
    deleted,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * UninstallCommands class for integration with command system
 */
export class UninstallCommands extends PrjctCommandsBase {
  async uninstall(
    options: UninstallOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    // Uninstall doesn't require project init
    return uninstall(options, projectPath)
  }
}
