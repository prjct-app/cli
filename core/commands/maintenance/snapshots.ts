/**
 * Snapshot Commands
 *
 * Git-based undo/redo functionality and session recovery.
 */

import path from 'path'

import type { CommandResult } from '../types'
import {
  pathManager,
  configManager,
  fileHelper,
  dateHelper,
  out
} from '../base'
import { memoryService } from '../../services'

interface SnapshotHistory {
  snapshots: { id: string; timestamp: string; message: string }[]
  current: number
}

interface SessionData {
  task?: string
  startedAt?: string
  context?: string
}

/**
 * /p:recover - Recover abandoned session with context restoration
 */
export async function recover(projectPath: string = process.cwd()): Promise<CommandResult> {
  try {
    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      out.fail('no project ID')
      return { success: false, error: 'No project ID found' }
    }

    out.spin('checking for abandoned sessions...')

    // Check for current session file
    const sessionPath = pathManager.getFilePath(projectId, 'progress', 'sessions/current.json')

    let sessionData: SessionData | null = null
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

    console.log('\n Found abandoned session:\n')
    console.log(`   Task: ${sessionData.task}`)
    if (sessionData.startedAt) {
      const elapsed = dateHelper.calculateDuration(new Date(sessionData.startedAt))
      console.log(`   Started: ${elapsed} ago`)
    }
    if (sessionData.context) {
      console.log(`   Context: ${sessionData.context.slice(0, 100)}...`)
    }

    console.log('\n Options:')
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
export async function undo(projectPath: string = process.cwd()): Promise<CommandResult> {
  try {
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
      let history: SnapshotHistory = { snapshots: [], current: -1 }

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

      await memoryService.log(projectPath, 'undo_performed', {
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
export async function redo(projectPath: string = process.cwd()): Promise<CommandResult> {
  try {
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

    let history: SnapshotHistory

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

      await memoryService.log(projectPath, 'redo_performed', {
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
export async function history(projectPath: string = process.cwd()): Promise<CommandResult> {
  try {
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

    let snapshotHistory: SnapshotHistory

    try {
      const content = await fileHelper.readFile(snapshotFile)
      snapshotHistory = JSON.parse(content)
    } catch {
      console.log('\n SNAPSHOT HISTORY\n')
      console.log('='.repeat(50))
      console.log('  No snapshots yet.')
      console.log('  Use /p:undo to create a snapshot.\n')
      return { success: true, snapshots: [] }
    }

    console.log('\n SNAPSHOT HISTORY\n')
    console.log('='.repeat(50))

    if (snapshotHistory.snapshots.length === 0) {
      console.log('  No snapshots yet.')
      console.log('  Use /p:undo to create a snapshot.\n')
    } else {
      snapshotHistory.snapshots.forEach((snap, i) => {
        const marker = i === snapshotHistory.current ? '>' : ' '
        const date = new Date(snap.timestamp).toLocaleString()
        console.log(`  ${marker} ${i + 1}. ${date}`)
      })
      console.log('')
      console.log(`  ${snapshotHistory.snapshots.length} snapshot(s) available`)
      console.log('  Use /p:redo to restore the latest\n')
    }

    console.log('='.repeat(50) + '\n')

    return { success: true, snapshots: snapshotHistory.snapshots, current: snapshotHistory.current }
  } catch (error) {
    out.fail((error as Error).message)
    return { success: false, error: (error as Error).message }
  }
}
