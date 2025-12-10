/**
 * Analytics Commands: context, recap, progress, status, roadmap, stuck
 */

import path from 'path'

import type { CommandResult, Context } from './types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  jsonlHelper,
  dateHelper,
  out
} from './base'

interface MemoryEntry {
  timestamp: string
  action: string
  data?: Record<string, unknown>
}

export class AnalyticsCommands extends PrjctCommandsBase {
  /**
   * /p:context - Show project context and recent activity
   */
  async context(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading context...')
      const context = await contextBuilder.build(projectPath) as Context

      const nowContent = (await toolRegistry.get('Read')!(context.paths.now)) as string | null
      const nextContent = (await toolRegistry.get('Read')!(context.paths.next)) as string | null

      let task = 'none'
      if (nowContent && !nowContent.includes('No current task')) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        task = taskMatch ? taskMatch[1] : 'active'
      }

      const nextLines = nextContent?.split('\n').filter((line) => line.trim() && !line.startsWith('#')) || []
      const queueCount = nextLines.length

      await this.logToMemory(projectPath, 'context_viewed', { timestamp: dateHelper.getTimestamp() })

      out.done(`task: ${task} | queue: ${queueCount}`)
      return { success: true }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:recap - Show project overview with progress
   */
  async recap(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading recap...')
      const context = await contextBuilder.build(projectPath) as Context

      const shippedContent = (await toolRegistry.get('Read')!(context.paths.shipped)) as string | null
      const shippedFeatures = shippedContent?.split('##').filter((s) => s.trim() && !s.includes('SHIPPED')) || []

      const nextContent = (await toolRegistry.get('Read')!(context.paths.next)) as string | null
      const nextTasks = nextContent?.split('\n').filter((l) => l.match(/^\d+\./) || l.includes('[ ]')).length || 0

      const ideasContent = (await toolRegistry.get('Read')!(context.paths.ideas)) as string | null
      const ideas = ideasContent?.split('##').filter((s) => s.trim() && !s.includes('IDEAS') && !s.includes('Brain')).length || 0

      await this.logToMemory(projectPath, 'recap_viewed', {
        shipped: shippedFeatures.length,
        tasks: nextTasks,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`shipped: ${shippedFeatures.length} | queue: ${nextTasks} | ideas: ${ideas}`)
      return { success: true, stats: { shipped: shippedFeatures.length, tasks: nextTasks, ideas } }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:stuck - Get contextual help with problems
   */
  async stuck(issue: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!issue) {
        out.fail('issue description required')
        return { success: false, error: 'Issue description required' }
      }

      out.spin('logging issue...')

      const analyzer = require('../domain/analyzer')
      analyzer.init(projectPath)
      const packageJson = await analyzer.readPackageJson()
      const detectedStack = packageJson?.name || 'project'

      await this.logToMemory(projectPath, 'help_requested', {
        issue,
        stack: detectedStack,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`issue logged: ${issue.slice(0, 40)}`)
      return { success: true, issue, stack: detectedStack }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:progress - Show metrics for period
   */
  async progress(period: string = 'week', projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const validPeriods = ['day', 'week', 'month', 'all']
      if (!validPeriods.includes(period)) period = 'week'

      out.spin(`loading ${period} progress...`)

      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')

      const startDate = period === 'day' ? dateHelper.getDaysAgo(1) :
                        period === 'week' ? dateHelper.getDaysAgo(7) :
                        period === 'month' ? dateHelper.getDaysAgo(30) : new Date(0)

      let entries: MemoryEntry[] = []
      try {
        const allEntries = await jsonlHelper.readJsonLines(memoryPath) as MemoryEntry[]
        entries = allEntries.filter((e) => new Date(e.timestamp) >= startDate)
      } catch { entries = [] }

      const metrics = {
        tasksCompleted: entries.filter((e) => e.action === 'task_completed').length,
        featuresShipped: entries.filter((e) => e.action === 'feature_shipped').length,
        totalActions: entries.length,
      }

      await this.logToMemory(projectPath, 'progress_viewed', { period, metrics, timestamp: dateHelper.getTimestamp() })

      out.done(`${period}: ${metrics.tasksCompleted} tasks | ${metrics.featuresShipped} shipped`)
      return { success: true, period, metrics }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:roadmap - Show roadmap with ASCII logic maps
   */
  async roadmap(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading roadmap...')
      const context = await contextBuilder.build(projectPath) as Context
      const roadmapContent = (await toolRegistry.get('Read')!(context.paths.roadmap)) as string | null

      if (!roadmapContent || roadmapContent.trim() === '# ROADMAP') {
        out.warn('no roadmap yet')
        return { success: true, message: 'No roadmap' }
      }

      const features = (roadmapContent.match(/##/g) || []).length

      await this.logToMemory(projectPath, 'roadmap_viewed', { timestamp: dateHelper.getTimestamp() })

      out.done(`${features} features in roadmap`)
      return { success: true, content: roadmapContent }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:status - KPI dashboard with ASCII graphics
   */
  async status(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      console.log('📊 Project Status Dashboard\n')

      const context = await contextBuilder.build(projectPath) as Context

      const nowContent = (await toolRegistry.get('Read')!(context.paths.now)) as string | null
      const nextContent = (await toolRegistry.get('Read')!(context.paths.next)) as string | null
      const shippedContent = (await toolRegistry.get('Read')!(context.paths.shipped)) as string | null
      const ideasContent = (await toolRegistry.get('Read')!(context.paths.ideas)) as string | null

      const stats = {
        activeTask: !!(nowContent && !nowContent.includes('No current task')),
        tasksInQueue:
          nextContent
            ?.split('\n')
            .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]')).length || 0,
        featuresShipped:
          shippedContent
            ?.split('##')
            .filter((section) => section.trim() && !section.includes('SHIPPED 🚀')).length || 0,
        ideasCaptured:
          ideasContent
            ?.split('##')
            .filter(
              (section) =>
                section.trim() && !section.includes('IDEAS 💡') && !section.includes('Brain Dump')
            ).length || 0,
      }

      console.log('═══════════════════════════════════════════════════')
      console.log(`  ${path.basename(projectPath)} - Status Overview`)
      console.log('═══════════════════════════════════════════════════\n')

      console.log('## 🎯 Current Focus\n')
      if (stats.activeTask && nowContent) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const task = taskMatch ? taskMatch[1] : 'Active task'
        const startedMatch = nowContent.match(/Started: (.+)/)
        const started = startedMatch ? startedMatch[1] : 'Unknown'
        console.log(`   📌 ${task}`)
        console.log(`   ⏱️  Started: ${started}\n`)
      } else {
        console.log('   No active task\n')
      }

      console.log('## 📋 Queue Status\n')
      console.log(`   Tasks in Queue: ${stats.tasksInQueue}`)
      this._renderProgressBar('Queue Load', stats.tasksInQueue, 20)
      console.log('')

      console.log('## 🚀 Shipped Features\n')
      console.log(`   Features Shipped: ${stats.featuresShipped}`)
      this._renderProgressBar('Progress', stats.featuresShipped, 10)
      console.log('')

      console.log('## 💡 Ideas Backlog\n')
      console.log(`   Ideas Captured: ${stats.ideasCaptured}`)
      this._renderProgressBar('Backlog', stats.ideasCaptured, 15)
      console.log('')

      console.log('## 💚 Overall Health\n')
      const health = this._calculateHealth(stats)
      console.log(`   Health Score: ${health.score}/100`)
      this._renderProgressBar('Health', health.score, 100)
      console.log(`   ${health.message}\n`)

      console.log('💡 Next steps:')
      console.log('• /p:now → Start working on a task')
      console.log('• /p:feature → Add new feature')
      console.log('• /p:ship → Ship completed work')

      await this.logToMemory(projectPath, 'status_viewed', {
        stats,
        health: health.score,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, stats, health }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
