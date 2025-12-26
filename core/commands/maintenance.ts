/**
 * Maintenance Commands: cleanup, design, recover, undo, redo, history
 * Git-based snapshots for undo/redo functionality
 */

import path from 'path'

import type { CommandResult, CleanupOptions, DesignOptions } from './types'
import {
  PrjctCommandsBase,
  pathManager,
  configManager,
  fileHelper,
  jsonlHelper,
  dateHelper,
  out
} from './base'
import { ideasStorage, queueStorage } from '../storage'

export class MaintenanceCommands extends PrjctCommandsBase {
  /**
   * Memory cleanup helper
   */
  async _cleanupMemory(projectPath: string): Promise<{ success: boolean; results: { rotated: string[]; totalSize: number; freedSpace: number } }> {
    const projectId = await configManager.getProjectId(projectPath)

    const results = { rotated: [] as string[], totalSize: 0, freedSpace: 0 }
    const jsonlFiles = [
      pathManager.getFilePath(projectId!, 'memory', 'context.jsonl'),
      pathManager.getFilePath(projectId!, 'progress', 'shipped.md'),
      pathManager.getFilePath(projectId!, 'planning', 'ideas.md'),
    ]

    for (const filePath of jsonlFiles) {
      try {
        const sizeMB = await jsonlHelper.getFileSizeMB(filePath)
        if (sizeMB > 0) {
          results.totalSize += sizeMB
          const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(filePath, 10)
          if (rotated) {
            results.rotated.push(path.basename(filePath))
            results.freedSpace += sizeMB
          }
        }
      } catch {
        // skip
      }
    }

    return { success: true, results }
  }

  /**
   * Internal cleanup helper for memory during normal cleanup
   */
  async _cleanupMemoryInternal(projectPath: string): Promise<void> {
    const projectId = await configManager.getProjectId(projectPath)
    const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')
    await jsonlHelper.rotateJsonLinesIfNeeded(memoryPath, 10)
  }

  /**
   * /p:cleanup - Clean temp files and old entries
   */
  async cleanup(_options: CleanupOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const isMemoryMode = _options.memory === true || _options.type === 'memory'

      if (isMemoryMode) {
        out.spin('cleaning memory...')
        const result = await this._cleanupMemory(projectPath)
        out.done('memory cleaned')
        return result
      }

      out.spin('cleaning up...')

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      const cleaned: string[] = []

      // Clean memory (keep last 100 entries)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      try {
        const entries = await jsonlHelper.readJsonLines(memoryPath)

        if (entries.length > 100) {
          const kept = entries.slice(-100)
          await jsonlHelper.writeJsonLines(memoryPath, kept)
          cleaned.push(`Memory: ${entries.length - 100} old entries removed`)
        } else {
          cleaned.push('Memory: No cleanup needed')
        }
      } catch {
        cleaned.push('Memory: No file found')
      }

      // Clean ideas using ideasStorage
      try {
        const result = await ideasStorage.cleanup(projectId)
        if (result.removed > 0) {
          cleaned.push(`Ideas: ${result.removed} old archived ideas removed`)
        } else {
          cleaned.push('Ideas: No cleanup needed')
        }
      } catch {
        cleaned.push('Ideas: No file found')
      }

      // Check queue for completed tasks using queueStorage
      try {
        const tasks = await queueStorage.getActiveTasks(projectId)
        const completedTasks = tasks.filter(t => t.completed).length

        if (completedTasks > 0) {
          cleaned.push(
            `Queue: ${completedTasks} completed tasks found (not removed - use /p:done to clear)`
          )
        } else {
          cleaned.push('Queue: No completed tasks')
        }
      } catch {
        cleaned.push('Queue: No file found')
      }

      await this._cleanupMemoryInternal(projectPath)

      await this.logToMemory(projectPath, 'cleanup_performed', {
        items: cleaned.length,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${cleaned.length} items cleaned`)
      return { success: true, cleaned }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:design - Design system architecture, APIs, and components
   */
  async design(target: string | null = null, options: DesignOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const designType = options.type || 'architecture'
      const validTypes = ['architecture', 'api', 'component', 'database', 'flow']

      if (!validTypes.includes(designType)) {
        out.fail(`invalid type: ${designType}`)
        return { success: false, error: 'Invalid design type' }
      }

      const designTarget = target || 'system'
      out.spin(`designing ${designType}...`)

      const projectId = await configManager.getProjectId(projectPath)
      const designsPath = path.join(
        pathManager.getGlobalProjectPath(projectId!),
        'planning',
        'designs'
      )
      await fileHelper.ensureDir(designsPath)

      let designContent = ''

      switch (designType) {
        case 'architecture':
          designContent = `# Architecture Design: ${designTarget}\n\n*Use templates/design/architecture.md for full design*\n`
          break
        case 'api':
          designContent = `# API Design: ${designTarget}\n\n*Use templates/design/api.md for full design*\n`
          break
        case 'component':
          designContent = `# Component Design: ${designTarget}\n\n*Use templates/design/component.md for full design*\n`
          break
        case 'database':
          designContent = `# Database Design: ${designTarget}\n\n*Use templates/design/database.md for full design*\n`
          break
        case 'flow':
          designContent = `# Flow Design: ${designTarget}\n\n*Use templates/design/flow.md for full design*\n`
          break
      }

      const designFileName = `${designType}-${designTarget.toLowerCase().replace(/\s+/g, '-')}.md`
      const designFilePath = path.join(designsPath, designFileName)
      await fileHelper.writeFile(designFilePath, designContent)

      await this.logToMemory(projectPath, 'design_created', {
        type: designType,
        target: designTarget,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${designType} design created`)
      return { success: true, designPath: designFilePath, type: designType, target: designTarget }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:recover - Recover abandoned session with context restoration
   */
  async recover(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      out.spin('checking for abandoned sessions...')

      // Check for current session file
      const sessionPath = pathManager.getFilePath(projectId, 'progress', 'sessions/current.json')

      let sessionData: { task?: string; startedAt?: string; context?: string } | null = null
      try {
        const content = await fileHelper.readFile(sessionPath)
        sessionData = JSON.parse(content)
      } catch {
        sessionData = null
      }

      if (!sessionData || !sessionData.task) {
        out.warn('no abandoned session found')
        return { success: true, message: 'No abandoned session found' }
      }

      console.log('\n🔍 Found abandoned session:\n')
      console.log(`   Task: ${sessionData.task}`)
      if (sessionData.startedAt) {
        const elapsed = dateHelper.calculateDuration(new Date(sessionData.startedAt))
        console.log(`   Started: ${elapsed} ago`)
      }
      if (sessionData.context) {
        console.log(`   Context: ${sessionData.context.slice(0, 100)}...`)
      }

      console.log('\n💡 Options:')
      console.log('   1. Use /p:work to resume working')
      console.log('   2. Use /p:done to mark as complete')
      console.log('   3. Delete session file to discard\n')

      return { success: true, session: sessionData }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:undo - Git-based undo (stash current changes)
   */
  async undo(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('creating undo point...')

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      // Create snapshots directory
      const snapshotsPath = path.join(
        pathManager.getGlobalProjectPath(projectId),
        'snapshots'
      )
      await fileHelper.ensureDir(snapshotsPath)

      // Check git status
      const { execSync } = await import('child_process')

      try {
        const status = execSync('git status --porcelain', {
          cwd: projectPath,
          encoding: 'utf-8'
        }).trim()

        if (!status) {
          out.warn('nothing to undo (no changes)')
          return { success: true, message: 'No changes to undo' }
        }

        // Create stash with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const stashMessage = `prjct-undo-${timestamp}`

        execSync(`git stash push -m "${stashMessage}"`, {
          cwd: projectPath,
          encoding: 'utf-8'
        })

        // Save snapshot metadata
        const snapshotFile = path.join(snapshotsPath, 'history.json')
        let history: { snapshots: { id: string; timestamp: string; message: string }[]; current: number } = { snapshots: [], current: -1 }

        try {
          const content = await fileHelper.readFile(snapshotFile)
          history = JSON.parse(content)
        } catch {
          // New history
        }

        history.snapshots.push({
          id: stashMessage,
          timestamp: new Date().toISOString(),
          message: stashMessage
        })
        history.current = history.snapshots.length - 1

        await fileHelper.writeFile(snapshotFile, JSON.stringify(history, null, 2))

        await this.logToMemory(projectPath, 'undo_performed', {
          snapshotId: stashMessage,
          timestamp: dateHelper.getTimestamp(),
        })

        out.done('changes stashed (use /p:redo to restore)')
        return { success: true, snapshotId: stashMessage }
      } catch (gitError) {
        out.fail('git operation failed')
        return { success: false, error: (gitError as Error).message }
      }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:redo - Restore previously undone changes
   */
  async redo(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('restoring changes...')

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      const snapshotsPath = path.join(
        pathManager.getGlobalProjectPath(projectId),
        'snapshots'
      )
      const snapshotFile = path.join(snapshotsPath, 'history.json')

      let history: { snapshots: { id: string; timestamp: string; message: string }[]; current: number }

      try {
        const content = await fileHelper.readFile(snapshotFile)
        history = JSON.parse(content)
      } catch {
        out.warn('no undo history found')
        return { success: false, message: 'No undo history found' }
      }

      if (history.snapshots.length === 0) {
        out.warn('nothing to redo')
        return { success: false, message: 'Nothing to redo' }
      }

      const { execSync } = await import('child_process')

      try {
        // Get latest stash
        const stashList = execSync('git stash list', {
          cwd: projectPath,
          encoding: 'utf-8'
        }).trim()

        if (!stashList) {
          out.warn('no stashed changes')
          return { success: false, message: 'No stashed changes found' }
        }

        // Find prjct stash
        const prjctStash = stashList.split('\n').find(line => line.includes('prjct-undo-'))

        if (!prjctStash) {
          out.warn('no prjct undo point found')
          return { success: false, message: 'No prjct undo point found' }
        }

        // Pop the stash
        execSync('git stash pop', {
          cwd: projectPath,
          encoding: 'utf-8'
        })

        // Remove from history
        history.snapshots.pop()
        history.current = Math.max(0, history.current - 1)

        await fileHelper.writeFile(snapshotFile, JSON.stringify(history, null, 2))

        await this.logToMemory(projectPath, 'redo_performed', {
          timestamp: dateHelper.getTimestamp(),
        })

        out.done('changes restored')
        return { success: true }
      } catch (gitError) {
        out.fail('git operation failed')
        return { success: false, error: (gitError as Error).message }
      }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:history - Show snapshot history for undo/redo
   */
  async history(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      const snapshotsPath = path.join(
        pathManager.getGlobalProjectPath(projectId),
        'snapshots'
      )
      const snapshotFile = path.join(snapshotsPath, 'history.json')

      let history: { snapshots: { id: string; timestamp: string; message: string }[]; current: number }

      try {
        const content = await fileHelper.readFile(snapshotFile)
        history = JSON.parse(content)
      } catch {
        console.log('\n📜 SNAPSHOT HISTORY\n')
        console.log('═'.repeat(50))
        console.log('  No snapshots yet.')
        console.log('  Use /p:undo to create a snapshot.\n')
        return { success: true, snapshots: [] }
      }

      console.log('\n📜 SNAPSHOT HISTORY\n')
      console.log('═'.repeat(50))

      if (history.snapshots.length === 0) {
        console.log('  No snapshots yet.')
        console.log('  Use /p:undo to create a snapshot.\n')
      } else {
        history.snapshots.forEach((snap, i) => {
          const marker = i === history.current ? '→' : ' '
          const date = new Date(snap.timestamp).toLocaleString()
          console.log(`  ${marker} ${i + 1}. ${date}`)
        })
        console.log('')
        console.log(`  ${history.snapshots.length} snapshot(s) available`)
        console.log('  Use /p:redo to restore the latest\n')
      }

      console.log('═'.repeat(50) + '\n')

      return { success: true, snapshots: history.snapshots, current: history.current }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
