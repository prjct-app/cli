/**
 * SnapshotManager - Git-based Undo/Redo System
 *
 * Uses Git internally to track file changes and enable undo/redo.
 * Inspired by OpenCode's snapshot system.
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/snapshots/
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import pathManager from '../infrastructure/path-manager'
import configManager from '../infrastructure/config-manager'
import { emit } from '../bus'
import { isNotFoundError } from '../types/fs'

const execAsync = promisify(exec)

interface SnapshotInfo {
  hash: string | null
  message: string
  timestamp: string
  files: string[]
}

interface SnapshotListItem {
  hash: string
  short: string
  message: string
  date: string
}

interface RestoreResult {
  hash: string
  files: string[]
  timestamp: string
}

interface RedoStackEntry {
  hash: string
  message: string
  timestamp: string
  files: string[]
}

class SnapshotManager {
  projectPath: string
  projectId: string | null = null
  snapshotDir: string | null = null
  initialized: boolean = false

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Initialize snapshot system for project
   */
  async initialize(): Promise<void> {
    this.projectId = await configManager.getProjectId(this.projectPath)
    if (!this.projectId) {
      throw new Error('No prjct project found. Run /p:init first.')
    }

    // Snapshots live in global storage
    const globalPath = pathManager.getGlobalProjectPath(this.projectId)
    this.snapshotDir = path.join(globalPath, 'snapshots')

    // Ensure directory exists
    await fs.mkdir(this.snapshotDir, { recursive: true })

    // Initialize bare git repo if not exists
    const gitDir = path.join(this.snapshotDir, '.git')
    try {
      await fs.access(gitDir)
    } catch (error) {
      if (isNotFoundError(error)) {
        await this.initGitRepo()
      } else {
        throw error
      }
    }

    this.initialized = true
  }

  /**
   * Initialize internal Git repository
   */
  async initGitRepo(): Promise<void> {
    // Create bare-ish repo structure
    await execAsync(`git init "${this.snapshotDir}"`, { cwd: this.projectPath })

    // Configure for snapshot use
    await execAsync(`git config user.email "prjct@local"`, { cwd: this.snapshotDir! })
    await execAsync(`git config user.name "prjct-snapshots"`, { cwd: this.snapshotDir! })

    // Create initial empty commit
    await execAsync(`git commit --allow-empty -m "init: snapshot system"`, { cwd: this.snapshotDir! })
  }

  /**
   * Create a snapshot of current project state
   */
  async create(message: string, files: string[] | null = null): Promise<SnapshotInfo> {
    if (!this.initialized) await this.initialize()

    const timestamp = new Date().toISOString()

    // Copy changed files to snapshot directory
    const changedFiles = files || (await this.getChangedFiles())

    if (changedFiles.length === 0) {
      return {
        hash: null,
        message: 'No changes to snapshot',
        timestamp,
        files: [],
      }
    }

    // Copy files to snapshot dir maintaining structure
    for (const file of changedFiles) {
      const srcPath = path.join(this.projectPath, file)
      const destPath = path.join(this.snapshotDir!, file)

      try {
        const content = await fs.readFile(srcPath, 'utf-8')
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await fs.writeFile(destPath, content)
      } catch (error) {
        if (isNotFoundError(error)) {
          // File might be deleted, mark for removal
          try {
            await fs.unlink(destPath)
          } catch (unlinkError) {
            // Ignore if dest doesn't exist either
            if (!isNotFoundError(unlinkError)) {
              throw unlinkError
            }
          }
        } else {
          throw error
        }
      }
    }

    // Stage and commit in snapshot repo
    await execAsync(`git add -A`, { cwd: this.snapshotDir! })

    const commitMsg = `${message}\n\nFiles: ${changedFiles.length}\nTimestamp: ${timestamp}`
    await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: this.snapshotDir! })

    // Get commit hash
    const { stdout } = await execAsync(`git rev-parse HEAD`, { cwd: this.snapshotDir! })
    const hash = stdout.trim()

    // Log to manifest
    await this.logSnapshot({
      hash,
      message,
      timestamp,
      files: changedFiles,
    })

    // Emit event for plugins
    await emit.snapshotCreated({
      hash,
      message,
      timestamp,
      filesCount: changedFiles.length,
      projectId: this.projectId,
    })

    return { hash, message, timestamp, files: changedFiles }
  }

  /**
   * Get list of changed files in project
   */
  async getChangedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git status --porcelain`, { cwd: this.projectPath })

      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter((file) => !file.startsWith('.prjct/'))
    } catch {
      return []
    }
  }

  /**
   * List all snapshots
   */
  async list(limit: number = 10): Promise<SnapshotListItem[]> {
    if (!this.initialized) await this.initialize()

    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:'{"hash":"%H","short":"%h","message":"%s","date":"%ai"}' -n ${limit}`,
        { cwd: this.snapshotDir! }
      )

      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as SnapshotListItem
          } catch (error) {
            if (error instanceof SyntaxError) {
              return null
            }
            throw error
          }
        })
        .filter((item): item is SnapshotListItem => item !== null)
    } catch {
      return []
    }
  }

  /**
   * Restore project to a specific snapshot
   */
  async restore(hash: string): Promise<RestoreResult> {
    if (!this.initialized) await this.initialize()

    // Get files changed in that commit
    const { stdout: filesOutput } = await execAsync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
      cwd: this.snapshotDir!,
    })

    const files = filesOutput.split('\n').filter(Boolean)

    // Checkout files from that snapshot
    await execAsync(`git checkout ${hash} -- .`, { cwd: this.snapshotDir! })

    // Copy files back to project
    for (const file of files) {
      const srcPath = path.join(this.snapshotDir!, file)
      const destPath = path.join(this.projectPath, file)

      try {
        const content = await fs.readFile(srcPath, 'utf-8')
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await fs.writeFile(destPath, content)
      } catch (error) {
        if (isNotFoundError(error)) {
          // File doesn't exist in snapshot, might need to delete from project
          try {
            await fs.unlink(destPath)
          } catch (unlinkError) {
            // Ignore if dest doesn't exist either
            if (!isNotFoundError(unlinkError)) {
              throw unlinkError
            }
          }
        } else {
          throw error
        }
      }
    }

    // Log restoration
    await this.logRestore(hash, files)

    const timestamp = new Date().toISOString()

    // Emit event for plugins
    await emit.snapshotRestored({
      hash,
      filesCount: files.length,
      timestamp,
      projectId: this.projectId,
    })

    return { hash, files, timestamp }
  }

  /**
   * Get diff between current state and a snapshot
   */
  async diff(hash: string): Promise<string> {
    if (!this.initialized) await this.initialize()

    try {
      const { stdout } = await execAsync(`git diff ${hash} --stat`, { cwd: this.snapshotDir! })
      return stdout
    } catch {
      return ''
    }
  }

  /**
   * Get the most recent snapshot hash
   */
  async getLatestHash(): Promise<string | null> {
    if (!this.initialized) await this.initialize()

    try {
      const { stdout } = await execAsync(`git rev-parse HEAD`, { cwd: this.snapshotDir! })
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * Get the hash before the current one (for undo)
   */
  async getPreviousHash(): Promise<string | null> {
    if (!this.initialized) await this.initialize()

    try {
      const { stdout } = await execAsync(`git rev-parse HEAD~1`, { cwd: this.snapshotDir! })
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * Log snapshot to manifest
   */
  async logSnapshot(snapshot: SnapshotInfo): Promise<void> {
    const manifestPath = path.join(this.snapshotDir!, 'manifest.jsonl')
    const entry =
      JSON.stringify({
        type: 'snapshot',
        ...snapshot,
      }) + '\n'

    await fs.appendFile(manifestPath, entry)
  }

  /**
   * Log restoration to manifest
   */
  async logRestore(hash: string, files: string[]): Promise<void> {
    const manifestPath = path.join(this.snapshotDir!, 'manifest.jsonl')
    const entry =
      JSON.stringify({
        type: 'restore',
        hash,
        files,
        timestamp: new Date().toISOString(),
      }) + '\n'

    await fs.appendFile(manifestPath, entry)
  }

  /**
   * Get redo stack (snapshots after current position)
   * This tracks undone snapshots that can be redone
   */
  async getRedoStack(): Promise<RedoStackEntry[]> {
    const stackPath = path.join(this.snapshotDir!, 'redo-stack.json')
    try {
      const content = await fs.readFile(stackPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return []
      }
      throw error
    }
  }

  /**
   * Push to redo stack (when undoing)
   */
  async pushToRedoStack(snapshot: RedoStackEntry): Promise<void> {
    const stack = await this.getRedoStack()
    stack.push(snapshot)
    const stackPath = path.join(this.snapshotDir!, 'redo-stack.json')
    await fs.writeFile(stackPath, JSON.stringify(stack, null, 2))
  }

  /**
   * Pop from redo stack (when redoing)
   */
  async popFromRedoStack(): Promise<RedoStackEntry | undefined> {
    const stack = await this.getRedoStack()
    const snapshot = stack.pop()
    const stackPath = path.join(this.snapshotDir!, 'redo-stack.json')
    await fs.writeFile(stackPath, JSON.stringify(stack, null, 2))
    return snapshot
  }

  /**
   * Clear redo stack (when creating new snapshot after undo)
   */
  async clearRedoStack(): Promise<void> {
    const stackPath = path.join(this.snapshotDir!, 'redo-stack.json')
    await fs.writeFile(stackPath, '[]')
  }
}

export default SnapshotManager
