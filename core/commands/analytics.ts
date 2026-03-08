/**
 * Analytics Commands: dash, help
 * Unified dashboard and contextual help - MD-First Architecture
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import contextBuilder from '../agentic/context-builder'
import configManager from '../infrastructure/config-manager'
import { createStalenessChecker } from '../services/staleness-checker'
import { contextZoneStorage } from '../storage/context-zone-storage'
import { prjctDb } from '../storage/database'
import { ideasStorage } from '../storage/ideas-storage'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import type { ProjectContext } from '../types/core'
import { getErrorMessage } from '../types/fs'
import * as dateHelper from '../utils/date-helper'
import { mdList, mdNextSteps, mdOutput, mdSection, mdTable } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { commandRegistry } from './registry'

interface MemoryEntry {
  timestamp: string
  action: string
  data?: Record<string, unknown>
}

export class AnalyticsCommands extends PrjctCommandsBase {
  /**
   * /p:dash - Unified dashboard
   * Views: default, week, month, roadmap, compact
   */
  async dash(
    view: string = 'default',
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const projectName = path.basename(projectPath)

      // Get current task (from storage layer - JSON source of truth)
      const currentTask = await stateStorage.getCurrentTask(projectId)

      // Get queue
      const queueTasks = await queueStorage.getActiveTasks(projectId)

      // Get shipped (recent)
      const shipped = await shippedStorage.getRecent(projectId, 5)

      // Get ideas
      const ideas = await ideasStorage.getPending(projectId)

      if (view === 'compact') {
        // One-liner status
        const taskStatus = currentTask ? `🎯 ${currentTask.description.slice(0, 30)}` : '💤 idle'
        const queueStatus = `📋 ${queueTasks.length}`
        const shippedStatus = `🚀 ${shipped.length}`
        out.done(`${taskStatus} | ${queueStatus} | ${shippedStatus}`)
        return { success: true, view: 'compact' }
      }

      if (view === 'week' || view === 'month') {
        // Period-based metrics
        const days = view === 'week' ? 7 : 30
        const startDate = dateHelper.getDaysAgo(days)

        let entries: MemoryEntry[] = []
        try {
          const sinceIso = startDate.toISOString()
          const rows = prjctDb.query<{ data: string; timestamp: string }>(
            projectId,
            'SELECT data, timestamp FROM events WHERE type LIKE ? AND timestamp >= ? ORDER BY id DESC',
            'memory.%',
            sinceIso
          )
          entries = rows.map((row) => {
            const parsed = JSON.parse(row.data)
            return { ...parsed, timestamp: row.timestamp } as MemoryEntry
          })
        } catch {
          entries = []
        }

        const metrics = {
          tasksCompleted: entries.filter((e) => e.action === 'task_completed').length,
          featuresShipped: entries.filter((e) => e.action === 'feature_shipped').length,
          totalActions: entries.length,
        }

        console.log(`\n📊 ${view.toUpperCase()} PROGRESS - ${projectName}\n`)
        console.log('═'.repeat(50))
        console.log(`  Tasks completed: ${metrics.tasksCompleted}`)
        console.log(`  Features shipped: ${metrics.featuresShipped}`)
        console.log(`  Total actions: ${metrics.totalActions}`)
        console.log('═'.repeat(50))

        // ASCII sparkline
        const sparkline = this._generateSparkline(entries, days)
        console.log(`\n  Activity: ${sparkline}\n`)

        return { success: true, view, metrics }
      }

      if (view === 'roadmap') {
        // Roadmap view
        const context = (await contextBuilder.build(projectPath)) as ProjectContext
        let roadmapContent: string | null = null
        try {
          roadmapContent = await fs.readFile(context.paths.roadmap, 'utf-8')
        } catch {
          roadmapContent = null
        }

        console.log(`\n🗺️  ROADMAP - ${projectName}\n`)
        console.log('═'.repeat(50))

        if (!roadmapContent || roadmapContent.trim() === '# ROADMAP') {
          console.log('  No features planned yet.')
          console.log('  Use /p:feature to add features.\n')
        } else {
          // Parse and display roadmap
          const features = roadmapContent
            .split('##')
            .filter((s) => s.trim() && !s.includes('ROADMAP'))
          features.slice(0, 5).forEach((f, i) => {
            const name = f.split('\n')[0].trim()
            console.log(`  ${i + 1}. ${name}`)
          })
          if (features.length > 5) {
            console.log(`  ... and ${features.length - 5} more`)
          }
        }
        console.log(`${'═'.repeat(50)}\n`)

        return { success: true, view: 'roadmap' }
      }

      // Default view - project overview
      if (options.md) {
        // Markdown output
        const currentFocus = currentTask
          ? `${currentTask.description}${currentTask.startedAt ? ` (started ${dateHelper.calculateDuration(new Date(currentTask.startedAt))} ago)` : ''}`
          : 'No active task'

        const queueItems =
          queueTasks.length > 0
            ? queueTasks.slice(0, 5).map((t) => {
                const priority = t.priority ? ` [${t.priority}]` : ''
                const desc = t.description.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '')
                return `${desc}${priority}`
              })
            : ['Queue is empty']

        const shipItems =
          shipped.length > 0
            ? shipped.slice(0, 5).map((s) => {
                const date = s.shippedAt ? new Date(s.shippedAt).toLocaleDateString() : ''
                return `${s.name}${date ? ` (${date})` : ''}`
              })
            : ['Nothing shipped yet']

        // Context health summary
        let contextHealthSection: string | null = null
        try {
          const summary = contextZoneStorage.getSummary(projectId, 7)
          if (summary.smartPercent < 100 || summary.compactions > 0) {
            contextHealthSection =
              '### Context Health (7d)\n' +
              mdTable(
                ['Zone', '%'],
                [
                  ['Smart', `${summary.smartPercent}%`],
                  ['Warning', `${summary.warningPercent}%`],
                  ['Dumb', `${summary.dumbPercent}%`],
                  ['Compactions', `${summary.compactions}`],
                ]
              )
          }
        } catch {
          // Context health is non-blocking — tables may not exist yet
        }

        const md = mdOutput(
          `## Dashboard: ${projectName}`,
          mdSection('Current Focus', currentFocus),
          mdSection(`Queue (${queueTasks.length})`, mdList(queueItems, true)),
          mdSection('Recent Ships', mdList(shipItems)),
          mdSection('Ideas', `${ideas.length} pending`),
          contextHealthSection,
          mdNextSteps([
            { label: 'Start task', command: 'prjct task "..." --md' },
            { label: 'Complete', command: 'prjct done --md' },
            { label: 'Ship', command: 'prjct ship --md' },
          ])
        )
        console.log(md)
      } else {
        console.log(`\n📊 DASHBOARD - ${projectName}\n`)
        console.log('═'.repeat(50))

        // Check staleness (PRJ-120)
        const checker = createStalenessChecker(projectPath)
        const stalenessStatus = await checker.check(projectId)
        const stalenessWarning = checker.getWarning(stalenessStatus)
        if (stalenessWarning) {
          console.log(`\n${stalenessWarning}`)
        }

        // Current task
        console.log('\n🎯 CURRENT FOCUS')
        if (currentTask) {
          console.log(`   ${currentTask.description}`)
          if (currentTask.startedAt) {
            const elapsed = dateHelper.calculateDuration(new Date(currentTask.startedAt))
            console.log(`   Started: ${elapsed} ago`)
          }
        } else {
          console.log('   No active task. Use /p:work to start.')
        }

        // Queue
        console.log('\n📋 QUEUE')
        if (queueTasks.length === 0) {
          console.log('   Queue is empty')
        } else {
          queueTasks.slice(0, 3).forEach((t, i) => {
            const priority = t.priority ? `[${t.priority}]` : ''
            console.log(`   ${i + 1}. ${t.description.slice(0, 40)} ${priority}`)
          })
          if (queueTasks.length > 3) {
            console.log(`   ... and ${queueTasks.length - 3} more`)
          }
        }

        // Recent ships
        console.log('\n🚀 RECENT SHIPS')
        if (shipped.length === 0) {
          console.log('   Nothing shipped yet')
        } else {
          shipped.slice(0, 3).forEach((s) => {
            const date = s.shippedAt ? new Date(s.shippedAt).toLocaleDateString() : ''
            console.log(`   • ${s.name} ${date ? `(${date})` : ''}`)
          })
        }

        // Ideas
        console.log('\n💡 IDEAS')
        console.log(`   ${ideas.length} pending ideas`)

        console.log(`\n${'═'.repeat(50)}`)
        console.log('💡 /p:work to start | /p:done to complete | /p:ship to ship\n')
      }

      await this.logToMemory(projectPath, 'dash_viewed', {
        view,
        timestamp: dateHelper.getTimestamp(),
      })

      return {
        success: true,
        view: 'default',
        stats: {
          currentTask: currentTask?.description || null,
          queueCount: queueTasks.length,
          shippedCount: shipped.length,
          ideasCount: ideas.length,
        },
      }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:help - Contextual help and guidance
   */
  async help(topic: string = '', _projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      if (!topic) {
        // Show command overview
        console.log('\n PRJCT COMMANDS\n')
        console.log('='.repeat(50))

        const categories = commandRegistry.getAllCategories()
        const commands = commandRegistry.getAll()

        // Group by category
        const byCategory: Record<string, typeof commands> = {}
        commands.forEach((cmd) => {
          if (cmd.deprecated) return
          if (!byCategory[cmd.group]) byCategory[cmd.group] = []
          byCategory[cmd.group].push(cmd)
        })

        Object.entries(byCategory).forEach(([cat, cmds]) => {
          const catInfo = categories.get(cat)
          console.log(`\n${catInfo?.title || cat}:`)
          cmds.forEach((cmd) => {
            const params = cmd.params ? ` ${cmd.params}` : ''
            console.log(`  ${cmd.name}${params}`)
            console.log(`    ${cmd.description}`)
          })
        })

        console.log(`\n${'═'.repeat(50)}`)
        console.log('💡 Use /p:help <command> for detailed help\n')

        return { success: true, topic: 'overview' }
      }

      // Topic-specific help
      const command = commandRegistry.getByName(topic)
      if (command) {
        console.log(`\n📚 HELP: /p:${command.name}\n`)
        console.log('═'.repeat(50))
        console.log(`Description: ${command.description}`)

        if (command.params) {
          console.log(`Parameters: ${command.params}`)
        }

        if (command.usage) {
          console.log('\nUsage:')
          if (command.usage.claude) console.log(`  Claude: ${command.usage.claude}`)
          if (command.usage.terminal) console.log(`  Terminal: ${command.usage.terminal}`)
        }

        if (command.features) {
          console.log('\nFeatures:')
          for (const f of command.features) {
            console.log(`  • ${f}`)
          }
        }

        console.log(`\n${'═'.repeat(50)}\n`)
        return { success: true, topic, command }
      }

      // Intent translation (like old /p:ask)
      const intents: Record<string, { command: string; hint: string }> = {
        start: { command: 'work', hint: 'Start working on a task' },
        begin: { command: 'work', hint: 'Start working on a task' },
        finish: { command: 'done', hint: 'Mark current task complete' },
        complete: { command: 'done', hint: 'Mark current task complete' },
        deploy: { command: 'ship', hint: 'Ship a feature' },
        release: { command: 'ship', hint: 'Ship a feature' },
        status: { command: 'dash', hint: 'View project dashboard' },
        overview: { command: 'dash', hint: 'View project dashboard' },
        queue: { command: 'next', hint: 'View task queue' },
        tasks: { command: 'next', hint: 'View task queue' },
        add: { command: 'feature', hint: 'Add a new feature' },
        new: { command: 'feature', hint: 'Add a new feature' },
        break: { command: 'pause', hint: 'Pause current task' },
        stop: { command: 'pause', hint: 'Pause current task' },
        continue: { command: 'resume', hint: 'Resume paused task' },
        back: { command: 'resume', hint: 'Resume paused task' },
      }

      const lowerTopic = topic.toLowerCase()
      for (const [intent, info] of Object.entries(intents)) {
        if (lowerTopic.includes(intent)) {
          console.log(`\n💡 Did you mean /p:${info.command}?`)
          console.log(`   ${info.hint}\n`)
          return { success: true, topic, suggestion: info.command }
        }
      }

      console.log(`\n❓ Unknown topic: ${topic}`)
      console.log('   Use /p:help to see all commands\n')
      return { success: false, error: `Unknown topic: ${topic}` }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Generate ASCII sparkline for activity
   */
  private _generateSparkline(entries: MemoryEntry[], days: number): string {
    const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    const now = new Date()
    const counts: number[] = []

    // Count entries per day
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))

      const count = entries.filter((e) => {
        const ts = new Date(e.timestamp)
        return ts >= dayStart && ts <= dayEnd
      }).length

      counts.push(count)
    }

    const max = Math.max(...counts, 1)
    return counts.map((c) => bars[Math.floor((c / max) * (bars.length - 1))]).join('')
  }
}
