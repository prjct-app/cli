/**
 * Analytics Commands: dash, help
 * Unified dashboard and contextual help - MD-First Architecture
 */

import path from 'node:path'
import { ideasStorage, queueStorage, shippedStorage, stateStorage } from '../storage'
import type { CommandResult, ProjectContext } from '../types'
import {
  configManager,
  contextBuilder,
  dateHelper,
  jsonlHelper,
  out,
  PrjctCommandsBase,
  pathManager,
  toolRegistry,
} from './base'
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
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
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

        const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
        let entries: MemoryEntry[] = []
        try {
          const allEntries = (await jsonlHelper.readJsonLines(memoryPath)) as MemoryEntry[]
          entries = allEntries.filter((e) => new Date(e.timestamp) >= startDate)
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
        const roadmapContent = (await toolRegistry.get('Read')!(context.paths.roadmap)) as
          | string
          | null

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
      console.log(`\n📊 DASHBOARD - ${projectName}\n`)
      console.log('═'.repeat(50))

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
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
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
          command.features.forEach((f) => console.log(`  • ${f}`))
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
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
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
