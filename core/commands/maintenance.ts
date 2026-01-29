/**
 * Maintenance Commands
 *
 * Composed from individual modules:
 * - cleanup: Memory and project file cleanup
 * - design: System architecture and component design
 * - snapshots: Git-based undo/redo and session recovery
 */

import type { CleanupOptions, CommandResult, DesignOptions } from '../types'
import { PrjctCommandsBase } from './base'

// Import individual command functions
import { cleanup, cleanupMemory, cleanupMemoryInternal } from './cleanup'
import { design } from './design'
import { history, recover, redo, undo } from './snapshots'

/**
 * MaintenanceCommands - Facade class for maintenance operations
 *
 * Delegates to individual modules for implementation.
 */
export class MaintenanceCommands extends PrjctCommandsBase {
  // Cleanup operations
  _cleanupMemory = cleanupMemory
  _cleanupMemoryInternal = cleanupMemoryInternal

  async cleanup(
    options: CleanupOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return cleanup(options, projectPath)
  }

  // Design operations
  async design(
    target: string | null = null,
    options: DesignOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return design(target, options, projectPath)
  }

  // Snapshot operations
  async recover(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return recover(projectPath)
  }

  async undo(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return undo(projectPath)
  }

  async redo(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return redo(projectPath)
  }

  async history(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return history(projectPath)
  }
}

// Re-export individual functions for direct use
export { cleanup, cleanupMemory, cleanupMemoryInternal } from './cleanup'
export { design } from './design'
export { history, recover, redo, undo } from './snapshots'
