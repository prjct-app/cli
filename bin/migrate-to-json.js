#!/usr/bin/env bun

/**
 * prjct migrate-to-json - Complete migration to JSON-first architecture
 *
 * Migrates ALL data to unified JSON structure in data/ directory.
 * Prioritizes MD files (richer data), complements with existing JSON.
 * Deletes legacy files after successful migration.
 *
 * Usage:
 *   prjct migrate-to-json --project=<projectId>   Migrate specific project
 *   prjct migrate-to-json --all                   Migrate all projects
 *   prjct migrate-to-json --dry-run               Preview changes
 */

const path = require('path')
const fs = require('fs/promises')
const os = require('os')

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
}

const GLOBAL_STORAGE = path.join(os.homedir(), '.prjct-cli', 'projects')

// ============================================
// HELPERS
// ============================================

function generateId(prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return prefix ? `${prefix}_${id}` : id
}

async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function writeJson(filePath, data) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function deleteDirIfEmpty(dirPath) {
  try {
    const files = await fs.readdir(dirPath)
    if (files.length === 0) {
      await fs.rmdir(dirPath)
      return true
    }
  } catch {}
  return false
}

function normalizeStatus(s) {
  if (!s) return 'skipped'
  const lower = s.toLowerCase()
  if (lower === 'pass' || lower === 'passed' || lower === 'ok') return 'pass'
  if (lower === 'fail' || lower === 'failed' || lower === 'error') return 'fail'
  if (lower === 'warn' || lower === 'warning' || lower === 'warnings') return 'warning'
  return 'skipped'
}

// ============================================
// PARSERS - Extract data from MD and JSON
// ============================================

/**
 * Parse state from now.md + now.json + sessions/current.json
 */
async function parseState(projectPath) {
  const nowMd = await readFile(path.join(projectPath, 'core', 'now.md'))
  const nowJson = await readJson(path.join(projectPath, 'core', 'now.json'))
  const sessionJson = await readJson(path.join(projectPath, 'sessions', 'current.json'))

  const state = {
    currentTask: null,
    lastUpdated: new Date().toISOString(),
  }

  // No task
  if (!nowMd || nowMd.includes('No current task') || nowMd.trim() === '') {
    return state
  }

  // Extract from MD first
  const descMatch = nowMd.match(/\*\*(.+?)\*\*/)
  const description = descMatch ? descMatch[1] : (nowJson?.task || 'Unknown task')

  const startedMatch = nowMd.match(/Started:\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/)
  const startedAt = startedMatch ? startedMatch[1] : (nowJson?.startedAt || sessionJson?.startedAt || new Date().toISOString())

  const sessionMatch = nowMd.match(/Session:\s*(sess_\w+)/)
  const sessionId = sessionMatch ? sessionMatch[1] : (nowJson?.sessionId || sessionJson?.id || `sess_${generateId()}`)

  const featureMatch = nowMd.match(/Feature:\s*(feat_\w+)/)
  const featureId = featureMatch ? featureMatch[1] : undefined

  const agentMatch = nowMd.match(/Agent:\s*(\w+)/)
  const agent = agentMatch ? agentMatch[1] : undefined

  state.currentTask = {
    id: `task_${generateId()}`,
    description,
    startedAt,
    sessionId,
    ...(featureId && { featureId }),
    ...(agent && { agent }),
  }

  // Add session metrics if available
  if (sessionJson?.metrics) {
    state.sessionMetrics = sessionJson.metrics
  }

  return state
}

/**
 * Parse queue from next.md + next.json
 */
async function parseQueue(projectPath) {
  const nextMd = await readFile(path.join(projectPath, 'core', 'next.md'))
  const nextJson = await readJson(path.join(projectPath, 'core', 'next.json'))

  const queue = {
    tasks: [],
    lastUpdated: new Date().toISOString(),
  }

  if (!nextMd) return queue

  // Parse from MD (has more context)
  const taskRegex = /^\s*[-*]?\s*(\d+\.\s*)?\[([x ])\]\s*(.+?)(?:\s*\(from:\s*(.+?)\))?$/gm
  let match

  while ((match = taskRegex.exec(nextMd)) !== null) {
    const completed = match[2].toLowerCase() === 'x'
    let description = match[3].trim()
    const featureContext = match[4]?.trim()

    // Determine priority
    let priority = 'medium'
    const lineStart = nextMd.lastIndexOf('\n', match.index)
    const sectionBefore = nextMd.substring(Math.max(0, lineStart - 300), match.index)

    if (sectionBefore.includes('🔴') || sectionBefore.toLowerCase().includes('critical')) priority = 'critical'
    else if (sectionBefore.includes('🟠') || sectionBefore.toLowerCase().includes('high') || description.includes('[HIGH]')) priority = 'high'
    else if (sectionBefore.includes('🟢') || sectionBefore.toLowerCase().includes('low') || description.includes('[LOW]')) priority = 'low'

    // Clean up description
    description = description.replace(/\[(?:HIGH|MEDIUM|LOW)\]/g, '').replace(/[🐛✅]/g, '').trim()

    if (description) {
      queue.tasks.push({
        id: `task_${generateId()}`,
        description,
        priority,
        completed,
        ...(completed && { completedAt: new Date().toISOString() }),
        createdAt: new Date().toISOString(),
        ...(featureContext && { featureId: featureContext }),
      })
    }
  }

  // Add tasks from JSON that might not be in MD
  if (nextJson?.activeTasks) {
    for (const task of nextJson.activeTasks) {
      const exists = queue.tasks.some(t =>
        t.description.toLowerCase().includes(task.task?.toLowerCase()?.substring(0, 20) || '')
      )
      if (!exists && task.task) {
        queue.tasks.push({
          id: `task_${generateId()}`,
          description: task.task,
          priority: 'medium',
          completed: task.completed || false,
          createdAt: new Date().toISOString(),
          ...(task.source && { featureId: task.source }),
        })
      }
    }
  }

  return queue
}

/**
 * Parse ideas from ideas.md + ideas.json
 */
async function parseIdeas(projectPath) {
  const ideasMd = await readFile(path.join(projectPath, 'planning', 'ideas.md'))
  const ideasJson = await readJson(path.join(projectPath, 'planning', 'ideas.json'))

  const ideas = {
    ideas: [],
    lastUpdated: new Date().toISOString(),
  }

  // Parse from MD
  if (ideasMd) {
    const sections = ideasMd.split(/(?=^##\s+\d{4}|^###\s+)/m)
    let currentDate = new Date().toISOString().split('T')[0]

    for (const section of sections) {
      const dateMatch = section.match(/^##\s+(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        currentDate = dateMatch[1]
        continue
      }

      const ideaMatch = section.match(/^###\s+(.+?)(?:\s+-\s+COMPLETED)?$/m)
      if (!ideaMatch) continue

      const title = ideaMatch[1].trim()
      if (section.toLowerCase().includes('archived') && !section.includes('**Status**')) continue

      const statusMatch = section.match(/\*\*Status\*\*:\s*(\w+)/i)
      let status = 'pending'
      if (statusMatch) {
        const raw = statusMatch[1].toLowerCase()
        if (raw === 'completed' || raw === 'done' || section.includes('COMPLETED')) status = 'converted'
        else if (raw === 'archived') status = 'archived'
        else if (raw === 'reviewing') status = 'reviewing'
      }

      const descMatch = section.match(/\*\*Description\*\*:\s*(.+?)(?:\n\n|\*\*)/s)
      const details = descMatch ? descMatch[1].trim() : undefined

      const tags = []
      if (section.toLowerCase().includes('ux')) tags.push('ux')
      if (section.toLowerCase().includes('api')) tags.push('api')
      if (section.toLowerCase().includes('performance')) tags.push('performance')

      ideas.ideas.push({
        id: `idea_${generateId()}`,
        text: title,
        ...(details && { details }),
        priority: section.includes('HIGH') ? 'high' : section.includes('LOW') ? 'low' : 'medium',
        status,
        tags,
        createdAt: `${currentDate}T00:00:00.000Z`,
      })
    }
  }

  // Merge from JSON
  if (ideasJson?.ideas) {
    for (const idea of ideasJson.ideas) {
      const exists = ideas.ideas.some(i =>
        i.text.toLowerCase().includes(idea.text?.toLowerCase()?.substring(0, 20) || '')
      )
      if (!exists && idea.text) {
        ideas.ideas.push({
          id: `idea_${generateId()}`,
          text: idea.text,
          priority: idea.priority || 'medium',
          status: 'pending',
          tags: idea.tags || [],
          createdAt: idea.addedAt || new Date().toISOString(),
        })
      }
    }
  }

  return ideas
}

/**
 * Parse roadmap from roadmap.md + roadmap.json
 */
async function parseRoadmap(projectPath) {
  const roadmapMd = await readFile(path.join(projectPath, 'planning', 'roadmap.md'))
  const roadmapJson = await readJson(path.join(projectPath, 'planning', 'roadmap.json'))

  const roadmap = {
    features: [],
    backlog: [],
    lastUpdated: new Date().toISOString(),
  }

  if (roadmapMd) {
    const sections = roadmapMd.split(/(?=^##\s+(?:\d{4}-\d{2}-\d{2}|🎯|Phase|Backlog))/m)

    for (const section of sections) {
      // Backlog section
      if (section.toLowerCase().includes('backlog')) {
        const items = section.match(/^\s*[-*]\s*\[\s*\]\s*(.+)$/gm) || []
        for (const item of items) {
          const text = item.replace(/^\s*[-*]\s*\[\s*\]\s*/, '').trim()
          if (text && !roadmap.backlog.includes(text)) {
            roadmap.backlog.push(text)
          }
        }
        continue
      }

      // Feature section
      const headerMatch = section.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+-\s+(.+)$/m)
      if (!headerMatch) continue

      const dateStr = headerMatch[1]
      const name = headerMatch[2].trim()

      const impactMatch = section.match(/Impact:\s*\*?\*?(\w+)\*?\*?/i)
      const effortMatch = section.match(/Effort:\s*(.+?)(?:\n|$)/i)

      let status = 'planned'
      const statusMatch = section.match(/Status:\s*(\w+)/i)
      if (statusMatch) {
        const raw = statusMatch[1].toLowerCase()
        if (raw === 'active' || raw === 'in_progress') status = 'active'
        else if (raw === 'completed' || raw === 'done') status = 'completed'
        else if (raw === 'shipped') status = 'shipped'
      }
      if (section.includes('✅ COMPLETED') || section.includes('✅ Done')) status = 'completed'

      // Extract tasks
      const tasks = []
      const taskMatches = section.matchAll(/^\s*[-*]?\s*(\d+\.\s*)?\[([x ])\]\s*(.+)$/gm)
      for (const match of taskMatches) {
        const completed = match[2].toLowerCase() === 'x'
        tasks.push({
          id: `task_${generateId()}`,
          description: match[3].trim(),
          completed,
          ...(completed && { completedAt: new Date().toISOString() }),
        })
      }

      const completedCount = tasks.filter(t => t.completed).length
      const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

      roadmap.features.push({
        id: `feat_${generateId()}`,
        name,
        status,
        impact: impactMatch ? impactMatch[1].toLowerCase() : 'medium',
        ...(effortMatch && { effort: effortMatch[1].trim() }),
        progress,
        tasks,
        createdAt: `${dateStr}T00:00:00.000Z`,
        ...(status === 'active' && { startedAt: `${dateStr}T00:00:00.000Z` }),
        ...(status === 'completed' && { completedAt: new Date().toISOString() }),
        ...(status === 'shipped' && { shippedAt: new Date().toISOString() }),
      })
    }
  }

  return roadmap
}

/**
 * Parse shipped from shipped.md + shipped.json
 */
async function parseShipped(projectPath) {
  const shippedMd = await readFile(path.join(projectPath, 'progress', 'shipped.md'))
  const shippedJson = await readJson(path.join(projectPath, 'progress', 'shipped.json'))

  const shipped = {
    items: [],
    lastUpdated: new Date().toISOString(),
  }

  if (shippedMd) {
    const sections = shippedMd.split(/(?=^##\s+\d{4}-\d{2}-\d{2})/m)

    for (const section of sections) {
      const dateMatch = section.match(/^##\s+(\d{4}-\d{2}-\d{2})/)
      if (!dateMatch) continue

      const dateStr = dateMatch[1]
      const itemMatches = section.matchAll(/[-*]\s*✅\s*\*\*(.+?)\*\*(?:\s*\((.+?)\))?/g)

      for (const match of itemMatches) {
        const name = match[1].trim()
        const versionInfo = match[2]

        const versionMatch = versionInfo?.match(/v?([\d.]+)/)
        const version = versionMatch ? `v${versionMatch[1]}` : undefined

        // Extract changes
        const itemStart = match.index
        const nextItem = section.indexOf('- ✅', itemStart + 1)
        const itemSection = section.substring(itemStart, nextItem > 0 ? nextItem : undefined)

        const changes = []
        const changeMatches = itemSection.matchAll(/^\s+-\s+(?!Lint:|Tests:|Type:)(.+)$/gm)
        for (const change of changeMatches) {
          changes.push(change[1].trim())
        }

        // Metrics
        const lintMatch = itemSection.match(/Lint:\s*(\w+)/)
        const testMatch = itemSection.match(/Tests:\s*(\w+)/)
        const metrics = (lintMatch || testMatch) ? {
          lintStatus: normalizeStatus(lintMatch?.[1]),
          testStatus: normalizeStatus(testMatch?.[1]),
        } : undefined

        // Type
        let type = 'feature'
        const nameLower = name.toLowerCase()
        if (nameLower.includes('fix')) type = 'fix'
        else if (nameLower.includes('refactor')) type = 'refactor'
        else if (nameLower.includes('improvement') || nameLower.includes('optimization')) type = 'improvement'

        shipped.items.push({
          id: `ship_${generateId()}`,
          name,
          ...(version && { version }),
          type,
          changes,
          ...(metrics && { metrics }),
          shippedAt: `${dateStr}T12:00:00.000Z`,
        })
      }
    }
  }

  // Merge from JSON
  if (shippedJson?.items) {
    for (const item of shippedJson.items) {
      const exists = shipped.items.some(s =>
        s.name.toLowerCase() === item.name?.toLowerCase()
      )
      if (!exists && item.name) {
        shipped.items.push({
          id: `ship_${generateId()}`,
          name: item.name,
          type: item.type || 'feature',
          changes: [],
          shippedAt: item.shippedAt || new Date().toISOString(),
        })
      }
    }
  }

  return shipped
}

/**
 * Parse metrics from metrics.md
 */
async function parseMetrics(projectPath) {
  const metricsMd = await readFile(path.join(projectPath, 'progress', 'metrics.md'))

  const metrics = {
    current: {
      tasksStarted: 0,
      tasksCompleted: 0,
      inProgress: 0,
    },
    allTime: {
      featuresShipped: 0,
      tasksCompleted: 0,
      totalTimeTracked: '0m',
      daysActive: 0,
    },
    velocity: {
      featuresPerWeek: 0,
      tasksPerDay: 0,
    },
    lastActivity: [],
    lastUpdated: new Date().toISOString(),
  }

  if (!metricsMd) return metrics

  // Parse current sprint
  const startedMatch = metricsMd.match(/Tasks Started\*\*:\s*(\d+)/)
  const completedMatch = metricsMd.match(/Tasks Completed\*\*:\s*(\d+)/)
  const inProgressMatch = metricsMd.match(/In Progress\*\*:\s*(\d+)/)

  if (startedMatch) metrics.current.tasksStarted = parseInt(startedMatch[1])
  if (completedMatch) metrics.current.tasksCompleted = parseInt(completedMatch[1])
  if (inProgressMatch) metrics.current.inProgress = parseInt(inProgressMatch[1])

  // Parse all-time
  const featuresMatch = metricsMd.match(/Features Shipped\*\*:\s*(\d+)/)
  const totalTasksMatch = metricsMd.match(/Tasks Completed\*\*:\s*(\d+)/g)
  const timeMatch = metricsMd.match(/Total Time Tracked\*\*:\s*(.+?)(?:\n|$)/)
  const daysMatch = metricsMd.match(/Days Active\*\*:\s*(\d+)/)

  if (featuresMatch) metrics.allTime.featuresShipped = parseInt(featuresMatch[1])
  if (totalTasksMatch && totalTasksMatch.length > 1) {
    const match = totalTasksMatch[1].match(/(\d+)/)
    if (match) metrics.allTime.tasksCompleted = parseInt(match[1])
  }
  if (timeMatch) metrics.allTime.totalTimeTracked = timeMatch[1].trim()
  if (daysMatch) metrics.allTime.daysActive = parseInt(daysMatch[1])

  // Velocity
  const tasksPerDayMatch = metricsMd.match(/Tasks\/Day\*\*:\s*([\d.]+)/)
  if (tasksPerDayMatch) metrics.velocity.tasksPerDay = parseFloat(tasksPerDayMatch[1])

  // Last activity
  const activityMatches = metricsMd.matchAll(/\*\*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\*\*:\s*(.+?)(?:\n|$)/g)
  for (const match of activityMatches) {
    metrics.lastActivity.push({
      timestamp: match[1],
      description: match[2].trim(),
    })
  }

  return metrics
}

// ============================================
// MIGRATION
// ============================================

async function migrateProject(projectId, dryRun = false) {
  const projectPath = path.join(GLOBAL_STORAGE, projectId)
  const dataPath = path.join(projectPath, 'data')

  const results = {
    migrated: [],
    skipped: [],
    errors: [],
    deleted: [],
  }

  console.log(`\n${c.bold}${projectId}${c.reset}`)

  // 1. Parse all data
  const parsers = [
    { name: 'state', parse: () => parseState(projectPath), file: 'state.json' },
    { name: 'queue', parse: () => parseQueue(projectPath), file: 'queue.json' },
    { name: 'ideas', parse: () => parseIdeas(projectPath), file: 'ideas.json' },
    { name: 'roadmap', parse: () => parseRoadmap(projectPath), file: 'roadmap.json' },
    { name: 'shipped', parse: () => parseShipped(projectPath), file: 'shipped.json' },
    { name: 'metrics', parse: () => parseMetrics(projectPath), file: 'metrics.json' },
  ]

  for (const { name, parse, file } of parsers) {
    try {
      const data = await parse()
      const targetPath = path.join(dataPath, file)

      if (dryRun) {
        console.log(`  ${c.dim}→ ${name} → ${file}${c.reset}`)
      } else {
        await writeJson(targetPath, data)
        console.log(`  ${c.green}✓ ${name}${c.reset}`)
      }
      results.migrated.push(name)
    } catch (err) {
      console.log(`  ${c.red}✗ ${name}: ${err.message}${c.reset}`)
      results.errors.push(`${name}: ${err.message}`)
    }
  }

  // 2. Copy project.json if exists
  const projectJson = await readJson(path.join(projectPath, 'project.json'))
  if (projectJson) {
    if (!dryRun) {
      await writeJson(path.join(dataPath, 'project.json'), projectJson)
    }
    console.log(`  ${c.green}✓ project${c.reset}`)
    results.migrated.push('project')
  }

  // 3. Delete legacy files (only if not dry run and migration successful)
  if (!dryRun && results.errors.length === 0) {
    const filesToDelete = [
      // Core
      path.join(projectPath, 'core', 'now.md'),
      path.join(projectPath, 'core', 'now.json'),
      path.join(projectPath, 'core', 'next.md'),
      path.join(projectPath, 'core', 'next.json'),
      path.join(projectPath, 'core', 'context.md'),
      // Planning
      path.join(projectPath, 'planning', 'ideas.md'),
      path.join(projectPath, 'planning', 'ideas.json'),
      path.join(projectPath, 'planning', 'roadmap.md'),
      path.join(projectPath, 'planning', 'roadmap.json'),
      // Progress
      path.join(projectPath, 'progress', 'shipped.md'),
      path.join(projectPath, 'progress', 'shipped.json'),
      path.join(projectPath, 'progress', 'metrics.md'),
      // Root
      path.join(projectPath, 'project.json'),
    ]

    for (const file of filesToDelete) {
      if (await deleteFile(file)) {
        results.deleted.push(path.basename(file))
      }
    }

    // Try to remove empty directories
    await deleteDirIfEmpty(path.join(projectPath, 'core'))
    await deleteDirIfEmpty(path.join(projectPath, 'planning'))
    await deleteDirIfEmpty(path.join(projectPath, 'progress'))

    if (results.deleted.length > 0) {
      console.log(`  ${c.yellow}🗑 Deleted: ${results.deleted.length} legacy files${c.reset}`)
    }
  }

  return results
}

// ============================================
// CLI
// ============================================

function parseArgs(argv) {
  const args = { project: null, all: false, dryRun: false, help: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--all') args.all = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--project=')) args.project = arg.split('=')[1]
  }
  return args
}

function printHelp() {
  console.log(`
${c.cyan}${c.bold}prjct migrate-to-json${c.reset}

Complete migration to JSON-first architecture.

${c.bold}Usage:${c.reset}
  prjct migrate-to-json --project=<id>   Migrate specific project
  prjct migrate-to-json --all            Migrate all projects
  prjct migrate-to-json --dry-run        Preview without writing

${c.bold}What Gets Migrated:${c.reset}
  core/now.md + now.json        → data/state.json
  core/next.md + next.json      → data/queue.json
  planning/ideas.md + .json     → data/ideas.json
  planning/roadmap.md + .json   → data/roadmap.json
  progress/shipped.md + .json   → data/shipped.json
  progress/metrics.md           → data/metrics.json
  project.json                  → data/project.json

${c.bold}After Migration:${c.reset}
  Legacy files are automatically deleted.
  Run 'prjct generate-views --all' to create MD views.
`)
}

async function getAllProjects() {
  try {
    const entries = await fs.readdir(GLOBAL_STORAGE, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (!args.project && !args.all) {
    console.log(`${c.red}Error: Specify --project=<id> or --all${c.reset}`)
    process.exit(1)
  }

  const projects = args.all ? await getAllProjects() : [args.project]
  if (projects.length === 0) {
    console.log(`${c.yellow}No projects found${c.reset}`)
    process.exit(0)
  }

  console.log(`${c.cyan}${c.bold}${args.dryRun ? '[DRY RUN] ' : ''}Migrating to JSON-first...${c.reset}`)

  let totalMigrated = 0
  let totalErrors = 0

  for (const projectId of projects) {
    try {
      await fs.access(path.join(GLOBAL_STORAGE, projectId))
      const result = await migrateProject(projectId, args.dryRun)
      totalMigrated += result.migrated.length
      totalErrors += result.errors.length
    } catch {
      console.log(`${c.yellow}⚠ Project not found: ${projectId}${c.reset}`)
    }
  }

  console.log('')
  if (args.dryRun) {
    console.log(`${c.yellow}Dry run complete. No files were written.${c.reset}`)
  } else if (totalMigrated > 0) {
    console.log(`${c.green}${c.bold}✓ Migrated ${totalMigrated} items${c.reset}`)
    console.log(`${c.dim}Run 'prjct generate-views --all' to create MD views${c.reset}`)
  }

  if (totalErrors > 0) {
    console.log(`${c.red}✗ ${totalErrors} error(s)${c.reset}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`${c.red}Error: ${err.message}${c.reset}`)
  process.exit(1)
})
