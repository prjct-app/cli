/**
 * Workflow Commands: now, done, next, build
 * Core task management
 */

import type { CommandResult, Context } from './types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  dateHelper,
  out
} from './base'

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * /p:now - Set or show current task
   */
  async now(task: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath, { task }) as Context

      if (task) {
        const agentResult = await this._assignAgentForTask(task, projectPath, context)
        const agent = agentResult.agent?.name || 'generalist'
        const confidence = agentResult.routing?.confidence || 0.5

        const nowContent = `# NOW\n\n**${task}**\n\nStarted: ${new Date().toLocaleString()}\nAgent: ${agent} (${Math.round(confidence * 100)}% confidence)\n`
        await toolRegistry.get('Write')!(context.paths.now, nowContent)

        out.done(`${task} [${agent}]`)

        await this.logToMemory(projectPath, 'task_started', {
          task,
          agent,
          confidence,
          timestamp: dateHelper.getTimestamp(),
        })
        return { success: true, task, agent }
      } else {
        const nowContent = await toolRegistry.get('Read')!(context.paths.now) as string

        if (!nowContent || nowContent.includes('No current task')) {
          out.warn('no active task')
          return { success: true, message: 'No active task' }
        }

        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const agentMatch = nowContent.match(/Agent: ([^\s(]+)/)
        const currentTask = taskMatch ? taskMatch[1] : 'unknown'
        const currentAgent = agentMatch ? agentMatch[1] : ''
        out.done(`working on: ${currentTask}${currentAgent ? ` [${currentAgent}]` : ''}`)
        return { success: true, content: nowContent }
      }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:done - Complete current task
   */
  async done(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath) as Context
      const nowContent = await toolRegistry.get('Read')!(context.paths.now) as string

      if (!nowContent || nowContent.includes('No current task') || nowContent.trim() === '# NOW') {
        out.warn('no active task')
        return { success: true, message: 'No active task to complete' }
      }

      const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
      const task = taskMatch ? taskMatch[1] : 'task'

      const startedMatch = nowContent.match(/Started: (.+)/)
      let duration = ''
      if (startedMatch) {
        const started = new Date(startedMatch[1])
        duration = dateHelper.calculateDuration(started)
      }

      const emptyNow = '# NOW\n\nNo current task. Use `/p:now` to set focus.\n'
      await toolRegistry.get('Write')!(context.paths.now, emptyNow)

      out.done(`${task}${duration ? ` (${duration})` : ''}`)

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        timestamp: dateHelper.getTimestamp(),
      })
      return { success: true, task, duration }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:next - Show priority queue
   */
  async next(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath) as Context
      const nextContent = await toolRegistry.get('Read')!(context.paths.next) as string

      if (!nextContent || nextContent.trim() === '# NEXT\n\n## Priority Queue') {
        out.warn('queue empty')
        return { success: true, message: 'Queue is empty' }
      }

      const taskCount = (nextContent.match(/^- \[/gm) || []).length
      out.done(`${taskCount} task${taskCount !== 1 ? 's' : ''} queued`)

      return { success: true, content: nextContent }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:build - Start task with agent assignment
   */
  async build(taskOrNumber: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath, { task: taskOrNumber }) as Context

      const nowContent = await toolRegistry.get('Read')!(context.paths.now) as string
      if (nowContent && !nowContent.includes('No current task')) {
        console.log('⚠️  Already working on a task!')
        console.log('   Complete it with /p:done first\n')
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const currentTask = taskMatch ? taskMatch[1] : 'current task'
        console.log(`   Current: ${currentTask}`)
        return { success: false, message: 'Task already active' }
      }

      let task = taskOrNumber

      if (!isNaN(Number(taskOrNumber))) {
        const nextContent = await toolRegistry.get('Read')!(context.paths.next) as string
        const tasks = nextContent
          .split('\n')
          .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]'))

        const index = parseInt(taskOrNumber) - 1
        if (index >= 0 && index < tasks.length) {
          task = tasks[index].replace(/^\d+\.\s*\[.\]\s*/, '').trim()
          console.log(`📋 Selected from queue: ${task}\n`)
        } else {
          console.log(`❌ Invalid task number. Queue has ${tasks.length} tasks.`)
          console.log('   Use /p:next to see queue')
          return { success: false, error: 'Invalid task number' }
        }
      }

      if (!task) {
        console.log('❌ Task description required')
        console.log('Usage: /p:build "task description"')
        console.log('   or: /p:build 1 (select from queue)')
        return { success: false, error: 'Task required' }
      }

      console.log(`🏗️  Building: ${task}\n`)

      const complexity = this._detectComplexity(task)
      const estimate = complexity.hours

      console.log('📊 Analysis:')
      console.log(`   Complexity: ${complexity.level}`)
      console.log(`   Estimated: ${estimate}h`)
      console.log(`   Type: ${complexity.type}\n`)

      const agentResult = await this._assignAgentForTask(task, projectPath, context)
      const agent = agentResult.agent?.name || 'generalist'
      const confidence = agentResult.routing?.confidence || 0.5
      console.log(`🤖 Agent: ${agent} (${Math.round(confidence * 100)}% confidence)\n`)

      const nowContentNew = `# NOW

**${task}**

Started: ${new Date().toLocaleString()}
Estimated: ${estimate}h
Complexity: ${complexity.level}
Agent: ${agent} (${Math.round(confidence * 100)}% confidence)
`
      await toolRegistry.get('Write')!(context.paths.now, nowContentNew)

      console.log('✅ Task started!\n')
      console.log('💡 Next steps:')
      console.log('• Start coding')
      console.log('• /p:done → Mark complete')
      console.log('• /p:stuck → Get help if needed')

      await this.logToMemory(projectPath, 'task_built', {
        task,
        complexity: complexity.level,
        estimate,
        agent,
        confidence,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task, complexity, estimate, agent }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
