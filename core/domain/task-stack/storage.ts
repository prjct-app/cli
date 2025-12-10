/**
 * Task Stack Storage
 * File operations for task stack
 */

import fs from 'fs/promises'
import log from '../../utils/logger'
import type { TaskEntry } from './types'

/**
 * Ensure stack file exists
 */
export async function ensureStackFile(stackPath: string): Promise<void> {
  try {
    await fs.access(stackPath)
  } catch {
    // Create empty file
    await fs.writeFile(stackPath, '')
  }
}

/**
 * Append entry to stack
 */
export async function appendToStack(stackPath: string, entry: TaskEntry): Promise<void> {
  await ensureStackFile(stackPath)
  const line = JSON.stringify(entry) + '\n'
  await fs.appendFile(stackPath, line)
}

/**
 * Read all stack entries
 */
export async function readStack(stackPath: string): Promise<TaskEntry[]> {
  await ensureStackFile(stackPath)
  const content = await fs.readFile(stackPath, 'utf8')

  if (!content.trim()) {
    return []
  }

  const entries: TaskEntry[] = []
  const lines = content.split('\n').filter((line) => line.trim())

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch (error) {
      log.error('Error parsing stack line:', (error as Error).message)
    }
  }

  return entries
}

/**
 * Write full stack to file
 */
export async function writeStack(stackPath: string, stack: TaskEntry[]): Promise<void> {
  const content = stack.map((task) => JSON.stringify(task)).join('\n') + '\n'
  await fs.writeFile(stackPath, content)
}

/**
 * Generate now.md content for a task
 */
export function generateNowContent(task: TaskEntry | null, customContent: string | null, formatDuration: (ms: number) => string): string {
  if (customContent !== undefined && customContent !== null) {
    return customContent
  }

  if (!task) {
    return `# Current Task

**No active task**

Use \`/p:work\` or \`/p:resume\` to start working.

---

_Track your focus with \`/p:work [task]\`_
`
  }

  const started = new Date(task.started)
  const now = new Date()
  const elapsed = formatDuration(now.getTime() - started.getTime() - (task.pausedDuration || 0))

  return `---
task: "${task.task}"
started: ${task.started}
agent: ${task.agent}
complexity: ${task.complexity}
dev: ${task.dev}
---

# Current Task

**${task.task}**

- Started: ${started.toLocaleTimeString()} (${elapsed} ago)
- Agent: ${task.agent}
- Complexity: ${task.complexity}

---

When done: \`/p:done\`
Need to pause: \`/p:pause\`
`
}

/**
 * Update now.md file
 */
export async function updateNowFile(
  nowPath: string,
  task: TaskEntry | null,
  customContent: string | null,
  formatDuration: (ms: number) => string
): Promise<void> {
  const content = generateNowContent(task, customContent, formatDuration)
  await fs.writeFile(nowPath, content)
}
