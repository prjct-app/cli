/**
 * View Generator
 *
 * Generates MD views from JSON data files.
 * JSON is the source of truth, MD is the generated view for Claude.
 *
 * Flow: JSON (data/) → Generator → MD (views/)
 */

import fs from 'fs/promises'
import path from 'path'
import {
  StateJson,
  QueueJson,
  IdeasJson,
  RoadmapJson,
  ShippedJson,
  ProjectSchema,
  DEFAULT_STATE,
  DEFAULT_QUEUE,
  DEFAULT_IDEAS,
  DEFAULT_ROADMAP,
  DEFAULT_SHIPPED,
  getProjectPath,
  getDataPath,
  getViewsPath,
} from './schemas'

// ============================================
// HELPERS
// ============================================

async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

function formatDate(isoString: string): string {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(isoString: string): string {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

function timeAgo(isoString: string): string {
  if (!isoString) return ''
  const ms = Date.now() - new Date(isoString).getTime()
  return formatDuration(ms) + ' ago'
}

// ============================================
// VIEW GENERATORS
// ============================================

/**
 * Generate now.md from state.json
 */
export function generateNowView(state: StateJson): string {
  if (!state.currentTask) {
    return `# NOW

No current task. Use \`/p:now <task>\` to start.

---
**Quick Actions:**
- \`/p:now "task description"\` - Start a new task
- \`/p:next\` - View priority queue
- \`/p:feature\` - Plan a new feature
`
  }

  const { description, startedAt, sessionId, featureId } = state.currentTask
  const elapsed = timeAgo(startedAt)

  let content = `# NOW

**${description}**

| Info | Value |
|------|-------|
| Started | ${formatDateTime(startedAt)} (${elapsed}) |
| Session | \`${sessionId}\` |`

  if (featureId) {
    content += `
| Feature | \`${featureId}\` |`
  }

  content += `

---
**Actions:**
- \`/p:done\` - Complete this task
- \`/p:pause\` - Pause and switch to something else
`

  return content
}

/**
 * Generate next.md from queue.json
 */
export function generateQueueView(queue: QueueJson): string {
  const pending = queue.tasks.filter(t => !t.completed)
  const completed = queue.tasks.filter(t => t.completed)

  if (pending.length === 0 && completed.length === 0) {
    return `# Priority Queue

No tasks in queue. Use \`/p:feature\` to add tasks.

---
**Quick Actions:**
- \`/p:feature "description"\` - Add a new feature with tasks
- \`/p:idea "text"\` - Capture a quick idea
`
  }

  let content = `# Priority Queue

> ${pending.length} pending task${pending.length !== 1 ? 's' : ''}
`

  // Group by priority
  const critical = pending.filter(t => t.priority === 'critical')
  const high = pending.filter(t => t.priority === 'high')
  const medium = pending.filter(t => t.priority === 'medium')
  const low = pending.filter(t => t.priority === 'low')

  if (critical.length > 0) {
    content += `
## 🔴 Critical

${critical.map(t => `- [ ] ${t.description}${t.featureId ? ` *(${t.featureId})*` : ''}`).join('\n')}
`
  }

  if (high.length > 0) {
    content += `
## 🟠 High

${high.map(t => `- [ ] ${t.description}${t.featureId ? ` *(${t.featureId})*` : ''}`).join('\n')}
`
  }

  if (medium.length > 0) {
    content += `
## 🟡 Medium

${medium.map(t => `- [ ] ${t.description}${t.featureId ? ` *(${t.featureId})*` : ''}`).join('\n')}
`
  }

  if (low.length > 0) {
    content += `
## 🟢 Low

${low.map(t => `- [ ] ${t.description}${t.featureId ? ` *(${t.featureId})*` : ''}`).join('\n')}
`
  }

  if (completed.length > 0) {
    content += `
---

## ✅ Recently Completed

${completed.slice(0, 5).map(t => `- [x] ${t.description}`).join('\n')}
`
  }

  content += `
---
*Updated: ${formatDateTime(queue.lastUpdated)}*
`

  return content
}

/**
 * Generate ideas.md from ideas.json
 */
export function generateIdeasView(ideas: IdeasJson): string {
  const pending = ideas.ideas.filter(i => i.status === 'pending')
  const reviewing = ideas.ideas.filter(i => i.status === 'reviewing')
  const converted = ideas.ideas.filter(i => i.status === 'converted')
  const archived = ideas.ideas.filter(i => i.status === 'archived')

  if (ideas.ideas.length === 0) {
    return `# Ideas

No ideas captured yet. Use \`/p:idea "text"\` to capture one.

---
**Quick Actions:**
- \`/p:idea "your idea"\` - Capture a new idea
- \`/p:feature\` - Convert an idea to a feature
`
  }

  let content = `# Ideas

> ${pending.length} pending | ${reviewing.length} reviewing | ${converted.length} converted
`

  if (pending.length > 0) {
    content += `
## 💡 Pending

${pending.map(i => {
  const tags = i.tags.length > 0 ? ` [${i.tags.join(', ')}]` : ''
  // Support both addedAt (new schema) and createdAt (legacy)
  const addedDate = i.addedAt || (i as unknown as { createdAt?: string }).createdAt || ''
  return `- **${i.text}**${tags}
  *Added: ${formatDate(addedDate)}*`
}).join('\n\n')}
`
  }

  if (reviewing.length > 0) {
    content += `
## 🔍 Under Review

${reviewing.map(i => `- **${i.text}**`).join('\n')}
`
  }

  if (converted.length > 0) {
    content += `
## ✅ Converted to Features

${converted.slice(0, 5).map(i => `- ~~${i.text}~~ → \`${i.convertedTo}\``).join('\n')}
`
  }

  content += `
---
*Updated: ${formatDateTime(ideas.lastUpdated)}*
`

  return content
}

/**
 * Generate roadmap.md from roadmap.json
 */
export function generateRoadmapView(roadmap: RoadmapJson): string {
  const active = roadmap.features.filter(f => f.status === 'active')
  const planned = roadmap.features.filter(f => f.status === 'planned')
  const completed = roadmap.features.filter(f => f.status === 'completed')
  const shipped = roadmap.features.filter(f => f.status === 'shipped')

  if (roadmap.features.length === 0 && roadmap.backlog.length === 0) {
    return `# Roadmap

No features planned yet. Use \`/p:feature "description"\` to add one.

---
**Quick Actions:**
- \`/p:feature "feature name"\` - Plan a new feature
- \`/p:idea\` - Capture ideas for later
`
  }

  let content = `# Roadmap

> ${active.length} active | ${planned.length} planned | ${shipped.length} shipped
`

  if (active.length > 0) {
    content += `
## 🚀 Active

${active.map(f => {
  const completedTasks = f.tasks.filter(t => t.completed).length
  const totalTasks = f.tasks.length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return `### ${f.name}

- **Impact**: ${f.impact} | **Effort**: ${f.effort || 'TBD'}
- **Progress**: ${progress}% (${completedTasks}/${totalTasks} tasks)

**Tasks:**
${f.tasks.map(t => `- [${t.completed ? 'x' : ' '}] ${t.description}`).join('\n')}
`
}).join('\n')}
`
  }

  if (planned.length > 0) {
    content += `
## 📋 Planned

${planned.map(f => `- **${f.name}** - Impact: ${f.impact}, Effort: ${f.effort || 'TBD'}`).join('\n')}
`
  }

  if (shipped.length > 0) {
    content += `
## ✅ Recently Shipped

${shipped.slice(0, 5).map(f => `- **${f.name}**${f.version ? ` (${f.version})` : ''} - ${formatDate(f.shippedAt || '')}`).join('\n')}
`
  }

  if (roadmap.backlog.length > 0) {
    content += `
## 📝 Backlog

${roadmap.backlog.map(item => `- ${item}`).join('\n')}
`
  }

  content += `
---
*Updated: ${formatDateTime(roadmap.lastUpdated)}*
`

  return content
}

/**
 * Generate shipped.md from shipped.json
 */
export function generateShippedView(shipped: ShippedJson): string {
  if (shipped.items.length === 0) {
    return `# Shipped

Nothing shipped yet. Use \`/p:ship "feature"\` after completing work.

---
**Quick Actions:**
- \`/p:now\` - Start working on something
- \`/p:ship "feature name"\` - Ship your work
`
  }

  // Group by date (YYYY-MM-DD)
  const byDate = new Map<string, typeof shipped.items>()
  for (const item of shipped.items) {
    const date = item.shippedAt.split('T')[0]
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(item)
  }

  let content = `# Shipped

> ${shipped.items.length} item${shipped.items.length !== 1 ? 's' : ''} shipped
`

  // Sort dates descending
  const sortedDates = Array.from(byDate.keys()).sort().reverse()

  for (const date of sortedDates.slice(0, 10)) {
    const items = byDate.get(date)!
    content += `
## ${formatDate(date + 'T00:00:00Z')}

${items.map(item => {
  let entry = `- ✅ **${item.name}**`
  if (item.version) entry += ` (${item.version})`
  entry += `\n  - Type: ${item.type}`

  if (item.changes && item.changes.length > 0) {
    entry += `\n  - Changes:`
    for (const change of item.changes.slice(0, 3)) {
      // Handle both string and ShipChange object formats
      const desc = typeof change === 'string' ? change : change.description
      entry += `\n    - ${desc}`
    }
  }

  // Support both new (qualityMetrics) and legacy (metrics) formats
  const qm = item.qualityMetrics || (item as unknown as { metrics?: { lintStatus: string; testStatus: string } }).metrics
  if (qm) {
    entry += `\n  - Lint: ${qm.lintStatus} | Tests: ${qm.testStatus}`
  }

  // Add duration if available
  if (item.duration) {
    const dur = item.duration
    const durStr = dur.hours > 0 ? `${dur.hours}h ${dur.minutes}m` : `${dur.minutes}m`
    entry += `\n  - Duration: ${durStr}`
  }

  // Add code metrics if available
  if (item.codeMetrics) {
    const cm = item.codeMetrics
    entry += `\n  - Files: ${cm.filesChanged} | +${cm.linesAdded}/-${cm.linesRemoved}`
  }

  return entry
}).join('\n\n')}
`
  }

  content += `
---
*Updated: ${formatDateTime(shipped.lastUpdated)}*
`

  return content
}

// ============================================
// MAIN GENERATOR
// ============================================

interface GenerateResult {
  generated: string[]
  errors: string[]
}

/**
 * Generate all views for a project from JSON data
 */
export async function generateViews(projectId: string): Promise<GenerateResult> {
  const dataPath = getDataPath(projectId)
  const viewsPath = getViewsPath(projectId)

  const generated: string[] = []
  const errors: string[] = []

  // Read all JSON data
  const state = await readJson<StateJson>(path.join(dataPath, 'state.json'), DEFAULT_STATE)
  const queue = await readJson<QueueJson>(path.join(dataPath, 'queue.json'), DEFAULT_QUEUE)
  const ideas = await readJson<IdeasJson>(path.join(dataPath, 'ideas.json'), DEFAULT_IDEAS)
  const roadmap = await readJson<RoadmapJson>(path.join(dataPath, 'roadmap.json'), DEFAULT_ROADMAP)
  const shipped = await readJson<ShippedJson>(path.join(dataPath, 'shipped.json'), DEFAULT_SHIPPED)

  // Generate views
  const views = [
    { name: 'now.md', content: generateNowView(state) },
    { name: 'next.md', content: generateQueueView(queue) },
    { name: 'ideas.md', content: generateIdeasView(ideas) },
    { name: 'roadmap.md', content: generateRoadmapView(roadmap) },
    { name: 'shipped.md', content: generateShippedView(shipped) },
  ]

  // Write views
  for (const view of views) {
    try {
      await writeFile(path.join(viewsPath, view.name), view.content)
      generated.push(view.name)
    } catch (err) {
      errors.push(`${view.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return { generated, errors }
}

/**
 * Generate a single view
 */
export async function generateView(
  projectId: string,
  viewName: 'now' | 'next' | 'ideas' | 'roadmap' | 'shipped'
): Promise<void> {
  const dataPath = getDataPath(projectId)
  const viewsPath = getViewsPath(projectId)

  const generators: Record<string, () => Promise<string>> = {
    now: async () => {
      const state = await readJson<StateJson>(path.join(dataPath, 'state.json'), DEFAULT_STATE)
      return generateNowView(state)
    },
    next: async () => {
      const queue = await readJson<QueueJson>(path.join(dataPath, 'queue.json'), DEFAULT_QUEUE)
      return generateQueueView(queue)
    },
    ideas: async () => {
      const ideas = await readJson<IdeasJson>(path.join(dataPath, 'ideas.json'), DEFAULT_IDEAS)
      return generateIdeasView(ideas)
    },
    roadmap: async () => {
      const roadmap = await readJson<RoadmapJson>(path.join(dataPath, 'roadmap.json'), DEFAULT_ROADMAP)
      return generateRoadmapView(roadmap)
    },
    shipped: async () => {
      const shipped = await readJson<ShippedJson>(path.join(dataPath, 'shipped.json'), DEFAULT_SHIPPED)
      return generateShippedView(shipped)
    },
  }

  const content = await generators[viewName]()
  await writeFile(path.join(viewsPath, `${viewName}.md`), content)
}

export default {
  generateViews,
  generateView,
  generateNowView,
  generateQueueView,
  generateIdeasView,
  generateRoadmapView,
  generateShippedView,
}
