/**
 * Queue Serializer
 *
 * Parses and serializes next.md for task queue.
 *
 * MD Format (next.md):
 * ```
 * # Priority Queue
 *
 * > Tasks ready to start
 *
 * ## Active Tasks
 * 1. [ ] Task description @agent (from: Feature Name)
 * 2. [x] Completed task ✅
 *
 * ## Previously Active
 * - [ ] Paused task
 *
 * ## Backlog
 * - [ ] 🐛 [HIGH] Bug description
 * - [ ] Feature task
 * ```
 */

import type { QueueJson, QueueTask, Priority, TaskType, TaskSection } from '../schemas/state'

/**
 * Parse next.md content to QueueJson
 */
export function parseQueue(content: string): QueueJson {
  if (!content || !content.trim()) {
    return { tasks: [], lastUpdated: '' }
  }

  const lines = content.split('\n')
  const tasks: QueueTask[] = []
  let currentSection: TaskSection = 'active'
  let taskIndex = 0

  for (const line of lines) {
    // Detect section headers
    if (line.match(/^##\s*Active/i)) {
      currentSection = 'active'
      continue
    }
    if (line.match(/^##\s*Previously/i)) {
      currentSection = 'previously_active'
      continue
    }
    if (line.match(/^##\s*Backlog/i)) {
      currentSection = 'backlog'
      continue
    }

    // Parse task lines: "1. [ ] Task" or "- [ ] Task" or "- [x] Task"
    const taskMatch = line.match(/^(?:\d+\.|[-*])\s*\[([\sx])\]\s*(.+)$/i)
    if (!taskMatch) continue

    const isCompleted = taskMatch[1].toLowerCase() === 'x'
    let taskText = taskMatch[2].trim()

    // Extract agent: @fe, @be, @fe+be
    const agentMatch = taskText.match(/@(\w+(?:\+\w+)?)/)
    const agent = agentMatch ? agentMatch[1] : undefined
    taskText = taskText.replace(/@\w+(?:\+\w+)?/, '').trim()

    // Extract origin feature: (from: Feature Name)
    const fromMatch = taskText.match(/\(from:\s*([^)]+)\)/)
    const originFeature = fromMatch ? fromMatch[1].trim() : undefined
    taskText = taskText.replace(/\(from:\s*[^)]+\)/, '').trim()

    // Detect task type from emoji/prefix
    let type: TaskType = 'feature'
    let priority: Priority = 'medium'

    if (taskText.includes('🐛') || taskText.toLowerCase().includes('bug')) {
      type = 'bug'
      taskText = taskText.replace('🐛', '').trim()
    }
    if (taskText.includes('🔧') || taskText.toLowerCase().includes('fix')) {
      type = 'improvement'
    }
    if (taskText.includes('♻️') || taskText.toLowerCase().includes('refactor')) {
      type = 'chore'
    }

    // Extract priority: [HIGH], [MEDIUM], [LOW], [CRITICAL]
    const priorityMatch = taskText.match(/\[(HIGH|MEDIUM|LOW|CRITICAL)\]/i)
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as Priority
      taskText = taskText.replace(/\[(HIGH|MEDIUM|LOW|CRITICAL)\]/i, '').trim()
    }

    // Remove checkmarks and clean up
    taskText = taskText.replace(/✅/g, '').trim()

    // Skip empty descriptions
    if (!taskText) continue

    const task: QueueTask = {
      id: `task_${Date.now()}_${taskIndex++}`,
      description: taskText,
      priority,
      type,
      completed: isCompleted,
      createdAt: new Date().toISOString(),
      section: currentSection
    }

    if (agent) task.agent = agent
    if (originFeature) task.originFeature = originFeature
    if (isCompleted) task.completedAt = new Date().toISOString()

    tasks.push(task)
  }

  // Extract updated date
  const updatedMatch = content.match(/_Updated:\s*(\d{4}-\d{2}-\d{2})/)
  const lastUpdated = updatedMatch ? updatedMatch[1] : new Date().toISOString().split('T')[0]

  return { tasks, lastUpdated }
}

/**
 * Serialize QueueJson to next.md format
 */
export function serializeQueue(data: QueueJson): string {
  const lines: string[] = [
    '# Priority Queue',
    '',
    '> Tasks ready to start (max 100)',
    '> Auto-updated by prjct',
    ''
  ]

  // Group tasks by section
  const active = data.tasks.filter(t => t.section === 'active')
  const previouslyActive = data.tasks.filter(t => t.section === 'previously_active')
  const backlog = data.tasks.filter(t => t.section === 'backlog')

  // Active Tasks
  if (active.length > 0) {
    lines.push('## Active Tasks', '')
    active.forEach((task, i) => {
      lines.push(formatTask(task, i + 1, true))
    })
    lines.push('')
  }

  // Previously Active
  if (previouslyActive.length > 0) {
    lines.push('## Previously Active', '')
    previouslyActive.forEach(task => {
      lines.push(formatTask(task, 0, false))
    })
    lines.push('')
  }

  // Backlog
  lines.push('---', '', '## Backlog', '')
  if (backlog.length > 0) {
    backlog.forEach(task => {
      lines.push(formatTask(task, 0, false))
    })
  } else {
    lines.push('_No backlog items_')
  }

  lines.push('')
  lines.push('---', '')
  lines.push(`_Updated: ${data.lastUpdated || new Date().toISOString().split('T')[0]}_`)

  return lines.join('\n')
}

/**
 * Format a single task as markdown
 */
function formatTask(task: QueueTask, num: number, numbered: boolean): string {
  const checkbox = task.completed ? '[x]' : '[ ]'
  const prefix = numbered && num > 0 ? `${num}.` : '-'

  let text = task.description

  // Add emoji for type
  if (task.type === 'bug') text = `🐛 ${text}`

  // Add priority tag for high/critical
  if (task.priority === 'high' || task.priority === 'critical') {
    text = `[${task.priority.toUpperCase()}] ${text}`
  }

  // Add agent
  if (task.agent) text = `${text} @${task.agent}`

  // Add origin feature
  if (task.originFeature) text = `${text} (from: ${task.originFeature})`

  // Add checkmark for completed
  if (task.completed) text = `${text} ✅`

  return `${prefix} ${checkbox} ${text}`
}

/**
 * Quick helpers
 */
export function createEmptyQueueMd(): string {
  return serializeQueue({ tasks: [], lastUpdated: new Date().toISOString().split('T')[0] })
}
