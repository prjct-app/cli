/**
 * Project Scanner
 * Finds projects with .prjct directories for migration.
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FindProjectsOptions } from './types'

/**
 * Find all projects with .prjct directories on the user's machine
 */
export async function findAllProjects(options: FindProjectsOptions = {}): Promise<string[]> {
  const { deepScan = true } = options
  const projectDirs: string[] = []

  let searchPaths: string[] = []
  if (deepScan) {
    searchPaths = [os.homedir()]
  } else {
    const commonDirs = [
      'Projects',
      'Documents',
      'Developer',
      'Code',
      'dev',
      'workspace',
      'repos',
      'src',
      'Apps',
    ]
    searchPaths = commonDirs
      .map((dir) => path.join(os.homedir(), dir))
      .filter((dirPath) => {
        try {
          require('fs').accessSync(dirPath)
          return true
        } catch {
          return false
        }
      })
  }

  const shouldSkip = (dirName: string): boolean => {
    const skipDirs = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.cache',
      'coverage',
      '.vscode',
      '.idea',
      'vendor',
      '__pycache__',
    ]
    return skipDirs.includes(dirName) || (dirName.startsWith('.') && dirName !== '.prjct')
  }

  const searchDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
    if (depth > 10) return

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      if (entries.some((entry) => entry.name === '.prjct' && entry.isDirectory())) {
        projectDirs.push(dirPath)
        return // Don't search subdirectories if we found a project
      }

      for (const entry of entries) {
        if (entry.isDirectory() && !shouldSkip(entry.name)) {
          const subPath = path.join(dirPath, entry.name)
          await searchDirectory(subPath, depth + 1)
        }
      }
    } catch {
      // Ignore errors
    }
  }

  for (const searchPath of searchPaths) {
    await searchDirectory(searchPath)
  }

  return projectDirs
}
