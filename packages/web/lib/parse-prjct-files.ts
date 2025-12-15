/**
 * Comprehensive parsers for prjct-cli data files
 * Extracts ALL rich data from the prjct storage system
 */

import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

// ============================================
// TYPES - Full data model from prjct
// ============================================

export interface Author {
  name: string
  email: string
  username?: string
}

export interface CurrentTask {
  task: string
  started?: string
  duration?: string
  feature?: string
  phase?: string
  agent?: string
  estimate?: string
  priority?: string
}

export interface TaskEvent {
  ts: string
  type: 'task_start' | 'task_complete' | 'task_shipped'
  task: string
  feature?: string
  phase?: string
  agent?: string
  estimate?: string
  duration?: string
  started?: string
  completed?: string
  deliverables?: string[]
  files_modified?: number
  impact?: string
  progress?: string
  author?: Author
}

export interface ShipEvent {
  ts: string
  type: 'ship' | 'feature_ship' | 'feature_shipped'
  name: string
  feature?: string
  version?: string
  commit?: string
  tasks_done?: number
  duration?: string
  agent?: string
  impact?: string
  complexity?: string
  decision?: string
  details?: string
  author?: Author
}

export interface BugEvent {
  ts: string
  type: 'bug_report' | 'bug_fix'
  name?: string
  description: string
  severity: string
  files_modified?: number
  author?: Author
}

export interface SyncEvent {
  ts: string
  type: 'sync' | 'repository_analyzed' | 'agents_generated' | 'agents_removed'
  agents?: string[]
  stack?: string
  patterns?: number
  fileCount?: number
  gitCommits?: number
  reason?: string
  author?: Author
}

export interface CleanupEvent {
  ts: string
  type: 'cleanup'
  action?: string
  files_changed?: number
  lines_removed?: number
  lines_added?: number
  net_change?: number
  fixes?: Record<string, number>
  details?: string
  author?: Author
}

export interface RoadmapEvent {
  ts: string
  type: 'roadmap'
  action: string
  phases?: number
  features?: number
  estimated_weeks?: string
  author?: Author
}

export interface IdeaEvent {
  ts: string
  type: 'idea_captured' | 'feature_add'
  idea?: string
  name?: string
  priority?: string
  impact?: string
  effort?: string
  actionable?: boolean
  tasks_created?: number
  author?: Author
}

export interface StuckEvent {
  ts: string
  type: 'stuck'
  issue: string
  context?: string
  author?: Author
}

export type TimelineEvent =
  | TaskEvent
  | ShipEvent
  | BugEvent
  | SyncEvent
  | CleanupEvent
  | RoadmapEvent
  | IdeaEvent
  | StuckEvent
  | { ts: string; type: string; [key: string]: unknown }

export interface Metrics {
  tasksStarted: number
  tasksCompleted: number
  inProgress: number
  totalTime: string
  daysActive: number
  velocity: {
    tasksPerDay: number
    featuresPerWeek?: number
  }
  testCoverage?: {
    total: number
    passing: number
    categories?: Record<string, { count: number; passing: number }>
  }
  codeQuality?: {
    linesAdded: number
    linesRemoved: number
    filesChanged: number
  }
}

export interface ShippedFeature {
  date: string
  name: string
  version?: string
  commit?: string
  type?: string
  agent?: string
  time?: string
  impact?: string
  filesChanged?: number
  linesAdded?: number
  linesRemoved?: number
  rootCause?: string
  solution?: string
  details?: string[]
}

export interface QueueItem {
  task: string
  priority: number
  feature?: string
  agent?: string
  estimate?: string
  status: 'pending' | 'in_progress'
}

export interface Idea {
  title: string
  status: string
  date?: string
  description?: string
  painPoints?: string[]
  solutions?: string[]
  impact?: string
  effort?: string
}

export interface RoadmapPhase {
  name: string
  status: 'completed' | 'in_progress' | 'queued'
  progress: number
  features?: RoadmapFeature[]
}

export interface RoadmapFeature {
  name: string
  status: 'completed' | 'in_progress' | 'queued'
  tasks: number
  tasksCompleted: number
  time?: string
  shippedDate?: string
  version?: string
}

export interface Agent {
  name: string
  role?: string
  responsibilities?: string[]
  whenToUse?: string[]
}

export interface SessionDay {
  date: string
  events: TimelineEvent[]
  tasksStarted: number
  tasksCompleted: number
  featuresShipped: number
  timeTracked?: string
}

export interface AnalysisData {
  fileCount: number
  commitCount: number
  stack: string
  techStack?: string[]
  structure?: string
  architecture?: string
}

export interface CodePatterns {
  moduleSystem?: Record<string, string>
  namingConventions?: Record<string, string>
  asyncPatterns?: Record<string, string>
  classStructure?: string
}

// Full project stats interface
export interface ProjectStats {
  currentTask: CurrentTask | null
  metrics: Metrics
  shipped: ShippedFeature[]
  queue: QueueItem[]
  ideas: {
    pending: Idea[]
    archived: number
    implemented: number
  }
  roadmap: {
    phases: RoadmapPhase[]
    completedFeatures: number
    totalFeatures: number
    progress: number
  }
  agents: Agent[]
  timeline: TimelineEvent[]
  sessions: SessionDay[]
  analysis: AnalysisData
  patterns?: CodePatterns
  summary: {
    totalEvents: number
    firstActivity?: string
    lastActivity?: string
    activeDays: number
    totalTasksEver: number
    totalShipsEver: number
    totalBugsFixed: number
    totalCleanups: number
  }
}

// ============================================
// HELPERS
// ============================================

async function safeReadFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

async function safeReadDir(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export function getStoragePath(projectId: string): string {
  return join(homedir(), '.prjct-cli', 'projects', projectId)
}

// ============================================
// PARSERS
// ============================================

// Parse now.md - Current task with full context
export function parseNow(content: string): CurrentTask | null {
  if (!content || content.includes('No active task')) {
    return null
  }

  const lines = content.split('\n').filter(l => l.trim())

  // Get task line (first non-header, non-empty line)
  const taskLine = lines.find(l => !l.startsWith('#') && !l.startsWith('_') && l.trim())
  if (!taskLine) return null

  const task: CurrentTask = {
    task: taskLine.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim()
  }

  // Extract metadata if present
  const startedMatch = content.match(/Started:\s*(.+)/i)
  const featureMatch = content.match(/Feature:\s*(.+)/i)
  const phaseMatch = content.match(/Phase:\s*(.+)/i)
  const agentMatch = content.match(/Agent:\s*(.+)/i)
  const estimateMatch = content.match(/Estimate:\s*(.+)/i)
  const priorityMatch = content.match(/Priority:\s*(.+)/i)

  if (startedMatch) task.started = startedMatch[1].trim()
  if (featureMatch) task.feature = featureMatch[1].trim()
  if (phaseMatch) task.phase = phaseMatch[1].trim()
  if (agentMatch) task.agent = agentMatch[1].trim()
  if (estimateMatch) task.estimate = estimateMatch[1].trim()
  if (priorityMatch) task.priority = priorityMatch[1].trim()

  return task
}

// Parse next.md - Priority queue with context
export function parseQueue(content: string): QueueItem[] {
  const items: QueueItem[] = []
  if (!content) return items

  const lines = content.split('\n')
  let priority = 1
  let currentFeature: string | undefined

  for (const line of lines) {
    // Track feature headers
    const featureMatch = line.match(/^##\s+(.+)$/)
    if (featureMatch) {
      currentFeature = featureMatch[1].trim()
      continue
    }

    // Match items: 1. [ ] Task or - [ ] Task
    const itemMatch = line.match(/^(?:\d+\.|[-*])\s*\[([\sx])\]\s*(.+)$/i)
    if (itemMatch) {
      const isCompleted = itemMatch[1].toLowerCase() === 'x'
      if (isCompleted) continue // Skip completed

      const taskText = itemMatch[2].trim()

      // Extract agent if present: Task @agent
      const agentMatch = taskText.match(/@(\w+)$/)
      const estimateMatch = taskText.match(/\((\d+[hmd])\)/)

      items.push({
        task: taskText.replace(/@\w+$/, '').replace(/\(\d+[hmd]\)/, '').trim(),
        priority: priority++,
        feature: currentFeature,
        agent: agentMatch?.[1],
        estimate: estimateMatch?.[1],
        status: 'pending'
      })
    }
  }

  return items
}

// Parse metrics.md - Full metrics extraction
export function parseMetrics(content: string): Metrics {
  const defaults: Metrics = {
    tasksStarted: 0,
    tasksCompleted: 0,
    inProgress: 0,
    totalTime: '0h',
    daysActive: 0,
    velocity: { tasksPerDay: 0 }
  }

  if (!content) return defaults

  // Basic metrics
  const started = content.match(/Tasks Started\*?\*?:\s*(\d+)/i)
  const completed = content.match(/(?:Tasks Completed|Total Tasks Shipped)\*?\*?:\s*(\d+)/i)
  const inProgress = content.match(/In Progress\*?\*?:\s*(\d+)/i)
  const totalTime = content.match(/(?:Total Time|Total Time Tracked)\*?\*?:\s*([^\n]+)/i)
  const daysActive = content.match(/Days Active\*?\*?:\s*(\d+)/i)
  const tasksPerDay = content.match(/(?:Tasks\/Day|Tasks per Day)\*?\*?:\s*([\d.]+)/i)
  const featuresPerWeek = content.match(/Features\/Week\*?\*?:\s*([\d.]+)/i)

  const metrics: Metrics = {
    tasksStarted: started ? parseInt(started[1]) : 0,
    tasksCompleted: completed ? parseInt(completed[1]) : 0,
    inProgress: inProgress ? parseInt(inProgress[1]) : 0,
    totalTime: totalTime ? totalTime[1].trim() : '0h',
    daysActive: daysActive ? parseInt(daysActive[1]) : 0,
    velocity: {
      tasksPerDay: tasksPerDay ? parseFloat(tasksPerDay[1]) : 0,
      featuresPerWeek: featuresPerWeek ? parseFloat(featuresPerWeek[1]) : undefined
    }
  }

  // Test coverage section
  const testSection = content.match(/##\s*Test Coverage([\s\S]*?)(?=##|$)/i)
  if (testSection) {
    const totalTests = testSection[1].match(/Total:\s*(\d+)/i)
    const passingTests = testSection[1].match(/(\d+)\s*passing/i)
    if (totalTests || passingTests) {
      metrics.testCoverage = {
        total: totalTests ? parseInt(totalTests[1]) : 0,
        passing: passingTests ? parseInt(passingTests[1]) : 0
      }
    }
  }

  // Code quality
  const linesAdded = content.match(/Lines Added\*?\*?:\s*(\d+)/i)
  const linesRemoved = content.match(/Lines Removed\*?\*?:\s*(\d+)/i)
  const filesChanged = content.match(/Files Changed\*?\*?:\s*(\d+)/i)
  if (linesAdded || linesRemoved || filesChanged) {
    metrics.codeQuality = {
      linesAdded: linesAdded ? parseInt(linesAdded[1]) : 0,
      linesRemoved: linesRemoved ? parseInt(linesRemoved[1]) : 0,
      filesChanged: filesChanged ? parseInt(filesChanged[1]) : 0
    }
  }

  return metrics
}

// Parse shipped.md - Full feature details
export function parseShipped(content: string): ShippedFeature[] {
  const features: ShippedFeature[] = []
  if (!content) return features

  // Try ISO date format first: ## 2025-01-01
  const isoDateSections = content.split(/^##\s+(\d{4}-\d{2}-\d{2})/m)

  if (isoDateSections.length > 1) {
    // Process pairs: [before, date1, content1, date2, content2, ...]
    for (let i = 1; i < isoDateSections.length; i += 2) {
      const sectionDate = isoDateSections[i]
      const sectionContent = isoDateSections[i + 1] || ''
      parseShippedSection(sectionContent, sectionDate, features)
    }
  } else {
    // Try month format: ## November 2025 or ## December 2024
    const monthDateSections = content.split(/^##\s+(\w+\s+\d{4})/m)

    if (monthDateSections.length > 1) {
      for (let i = 1; i < monthDateSections.length; i += 2) {
        const sectionDate = monthDateSections[i]
        const sectionContent = monthDateSections[i + 1] || ''
        parseShippedSection(sectionContent, sectionDate, features)
      }
    } else {
      // No date headers - parse entire content with inline dates
      parseShippedSection(content, '', features)
    }
  }

  return features.slice(0, 30) // Last 30
}

function parseShippedSection(sectionContent: string, sectionDate: string, features: ShippedFeature[]) {
  // Parse bullet points: - **Name** (version) or - **Name** - 2025-01-01
  const bulletRegex = /^-\s+\*\*(.+?)\*\*(?:\s*\(([^)]+)\))?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/gm
  let match
  while ((match = bulletRegex.exec(sectionContent)) !== null) {
    const name = match[1].trim()
    const versionOrNote = match[2]?.trim()
    const inlineDate = match[3]

    // Extract version if it starts with 'v'
    const version = versionOrNote?.match(/^v[\d.]+/) ? versionOrNote : undefined

    features.push({
      date: inlineDate || sectionDate || new Date().toISOString().split('T')[0],
      name,
      version
    })
  }

  // Also check for ### Feature Name headers (alternative format)
  const headerRegex = /^###\s+(.+?)(?:\s+(v[\d.]+))?\s*$/gm
  while ((match = headerRegex.exec(sectionContent)) !== null) {
    const name = match[1].trim()
    const version = match[2]

    // Avoid duplicates if same feature in both formats
    if (!features.some(f => f.date === sectionDate && f.name === name)) {
      features.push({
        date: sectionDate || new Date().toISOString().split('T')[0],
        name,
        version
      })
    }
  }
}

// Parse ideas.md - Full idea structure
export function parseIdeas(content: string): { pending: Idea[]; archived: number; implemented: number } {
  const pending: Idea[] = []
  let archived = 0
  let implemented = 0

  if (!content) return { pending, archived, implemented }

  const lines = content.split('\n')
  let inArchived = false
  let inImplemented = false
  let currentIdea: Partial<Idea> | null = null
  let collectingPainPoints = false
  let collectingSolutions = false

  for (const line of lines) {
    // Check section headers
    if (line.match(/^##.*Archived/i)) {
      inArchived = true
      inImplemented = false
      if (currentIdea?.title) pending.push(currentIdea as Idea)
      currentIdea = null
      continue
    }
    if (line.match(/^##.*Implemented/i)) {
      inImplemented = true
      inArchived = false
      if (currentIdea?.title) pending.push(currentIdea as Idea)
      currentIdea = null
      continue
    }

    // Date header: ## 2025-01-01
    const dateMatch = line.match(/^##\s*(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      if (currentIdea?.title && !inArchived && !inImplemented) {
        pending.push(currentIdea as Idea)
      }
      currentIdea = { date: dateMatch[1], status: 'PENDING' }
      inArchived = false
      inImplemented = false
      continue
    }

    // Idea title: ### Title
    const titleMatch = line.match(/^###\s+(.+)$/)
    if (titleMatch) {
      if (inArchived) {
        archived++
        continue
      }
      if (inImplemented) {
        implemented++
        continue
      }

      if (currentIdea?.title) {
        pending.push(currentIdea as Idea)
      }
      currentIdea = {
        title: titleMatch[1].trim(),
        status: 'PENDING',
        date: currentIdea?.date
      }
      collectingPainPoints = false
      collectingSolutions = false
      continue
    }

    if (!currentIdea || inArchived || inImplemented) continue

    // Status
    const statusMatch = line.match(/Status\*?\*?:\s*(\w+)/i)
    if (statusMatch) currentIdea.status = statusMatch[1]

    // Description
    const descMatch = line.match(/Description\*?\*?:\s*(.+)/i)
    if (descMatch) currentIdea.description = descMatch[1].trim()

    // Impact and effort
    const impactMatch = line.match(/Impact\*?\*?:\s*(\w+)/i)
    if (impactMatch) currentIdea.impact = impactMatch[1]

    const effortMatch = line.match(/Effort\*?\*?:\s*([^\n|]+)/i)
    if (effortMatch) currentIdea.effort = effortMatch[1].trim()

    // Pain points section
    if (line.match(/Pain Points/i)) {
      collectingPainPoints = true
      collectingSolutions = false
      currentIdea.painPoints = []
      continue
    }
    if (line.match(/Solutions/i)) {
      collectingSolutions = true
      collectingPainPoints = false
      currentIdea.solutions = []
      continue
    }

    // Collect list items
    const listMatch = line.match(/^[-*\d.]\s+(.+)$/)
    if (listMatch) {
      if (collectingPainPoints && currentIdea.painPoints) {
        currentIdea.painPoints.push(listMatch[1].trim())
      } else if (collectingSolutions && currentIdea.solutions) {
        currentIdea.solutions.push(listMatch[1].trim())
      }
    }
  }

  // Add last idea
  if (currentIdea?.title && !inArchived && !inImplemented) {
    pending.push(currentIdea as Idea)
  }

  return { pending, archived, implemented }
}

// Parse roadmap.md - Full roadmap structure
export function parseRoadmap(content: string): { phases: RoadmapPhase[]; completedFeatures: number; totalFeatures: number; progress: number } {
  const phases: RoadmapPhase[] = []
  let completedFeatures = 0
  let totalFeatures = 0

  if (!content) return { phases, completedFeatures, totalFeatures, progress: 0 }

  // Split by phase headers
  const phaseSections = content.split(/^##\s+(?:Phase\s+)?/mi).filter(s => s.trim())

  for (const section of phaseSections) {
    const lines = section.split('\n')
    const header = lines[0]

    // Match: P1: Name or Phase 1: Name or just number
    const phaseMatch = header.match(/^(?:P)?(\d+)[:\s-]*(.*)$/i)
    if (!phaseMatch) continue

    const phaseNum = phaseMatch[1]
    const features: RoadmapFeature[] = []
    let phaseStatus: 'completed' | 'in_progress' | 'queued' = 'queued'

    // Check for status in section
    if (section.match(/Status\*?\*?:\s*(?:COMPLETED|Done)/i)) {
      phaseStatus = 'completed'
    } else if (section.match(/Status\*?\*?:\s*(?:IN.?PROGRESS|Active)/i)) {
      phaseStatus = 'in_progress'
    }

    // Parse features
    for (const line of lines) {
      // Feature line: - [x] Feature Name (tasks, time) - Shipped date
      const featureMatch = line.match(/^[-*]\s*\[([\sx])\]\s*(.+)/i)
      if (featureMatch) {
        totalFeatures++
        const isCompleted = featureMatch[1].toLowerCase() === 'x'
        if (isCompleted) completedFeatures++

        const featureText = featureMatch[2]
        const nameMatch = featureText.match(/^([^(]+)/)
        const tasksMatch = featureText.match(/\((\d+)\s*(?:tasks?|\/\d+)/)
        const shippedMatch = featureText.match(/Shipped\s+(\d{4}-\d{2}-\d{2})/i)
        const versionMatch = featureText.match(/\((v[\d.]+)\)/)

        if (nameMatch) {
          features.push({
            name: nameMatch[1].replace(/\*\*/g, '').trim(),
            status: isCompleted ? 'completed' : 'in_progress',
            tasks: tasksMatch ? parseInt(tasksMatch[1]) : 0,
            tasksCompleted: isCompleted ? (tasksMatch ? parseInt(tasksMatch[1]) : 0) : 0,
            shippedDate: shippedMatch?.[1],
            version: versionMatch?.[1]
          })

          // Update phase status based on features
          if (!isCompleted) phaseStatus = phaseStatus === 'completed' ? 'in_progress' : phaseStatus
        }
      }
    }

    // Calculate phase progress
    const completedInPhase = features.filter(f => f.status === 'completed').length
    const phaseProgress = features.length > 0
      ? Math.round((completedInPhase / features.length) * 100)
      : (phaseStatus === 'completed' ? 100 : 0)

    phases.push({
      name: `P${phaseNum}`,
      status: phaseStatus,
      progress: phaseProgress,
      features
    })
  }

  // Also check for progress table format
  const tableRows = content.match(/\|\s*P(\d+)[^|]*\|[^|]*\|\s*(\d+)%/gi)
  if (tableRows && phases.length === 0) {
    for (const row of tableRows) {
      const match = row.match(/P(\d+)[^|]*\|[^|]*\|\s*(\d+)%/)
      if (match) {
        const progress = parseInt(match[2])
        phases.push({
          name: `P${match[1]}`,
          status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'queued',
          progress
        })
      }
    }
  }

  const overallProgress = totalFeatures > 0
    ? Math.round((completedFeatures / totalFeatures) * 100)
    : 0

  return { phases, completedFeatures, totalFeatures, progress: overallProgress }
}

// Parse context.jsonl - Full timeline with all event types
export function parseTimeline(content: string): TimelineEvent[] {
  const events: TimelineEvent[] = []
  if (!content) return events

  const lines = content.split('\n').filter(l => l.trim())

  for (const line of lines) {
    try {
      const raw = JSON.parse(line)
      const ts = raw.ts || raw.timestamp || ''
      const type = raw.type || raw.action || 'unknown'

      // Normalize the event
      const event: TimelineEvent = {
        ts,
        type,
        ...raw
      }

      events.push(event)
    } catch {
      // Skip invalid JSON
    }
  }

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => {
    const dateA = new Date(a.ts).getTime()
    const dateB = new Date(b.ts).getTime()
    return dateB - dateA
  })
}

// Parse session files from progress/sessions and memory/sessions
export async function parseSessions(storagePath: string): Promise<SessionDay[]> {
  const sessions: Map<string, SessionDay> = new Map()

  const sessionDirs = [
    join(storagePath, 'progress', 'sessions'),
    join(storagePath, 'memory', 'sessions')
  ]

  for (const dir of sessionDirs) {
    // Check for monthly folders
    const months = await safeReadDir(dir)

    for (const month of months) {
      const monthPath = join(dir, month)
      const files = await safeReadDir(monthPath)

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue

        const date = file.replace('.jsonl', '')
        const content = await safeReadFile(join(monthPath, file))
        const events = parseTimeline(content)

        if (!sessions.has(date)) {
          sessions.set(date, {
            date,
            events: [],
            tasksStarted: 0,
            tasksCompleted: 0,
            featuresShipped: 0
          })
        }

        const day = sessions.get(date)!
        day.events.push(...events)
        day.tasksStarted += events.filter(e => e.type === 'task_start').length
        day.tasksCompleted += events.filter(e => e.type === 'task_complete').length
        day.featuresShipped += events.filter(e =>
          e.type === 'ship' || e.type === 'feature_ship' || e.type === 'feature_shipped'
        ).length
      }
    }

    // Also check root session files
    const rootFiles = await safeReadDir(dir)
    for (const file of rootFiles) {
      if (!file.endsWith('.jsonl')) continue

      const date = file.replace('.jsonl', '')
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const content = await safeReadFile(join(dir, file))
        const events = parseTimeline(content)

        if (!sessions.has(date)) {
          sessions.set(date, {
            date,
            events: [],
            tasksStarted: 0,
            tasksCompleted: 0,
            featuresShipped: 0
          })
        }

        const day = sessions.get(date)!
        day.events.push(...events)
        day.tasksStarted += events.filter(e => e.type === 'task_start').length
        day.tasksCompleted += events.filter(e => e.type === 'task_complete').length
        day.featuresShipped += events.filter(e =>
          e.type === 'ship' || e.type === 'feature_ship' || e.type === 'feature_shipped'
        ).length
      }
    }
  }

  // Sort by date descending
  return Array.from(sessions.values()).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

// Parse agents - Full agent details
export async function parseAgents(storagePath: string): Promise<Agent[]> {
  const agents: Agent[] = []
  const agentsDir = join(storagePath, 'agents')

  const files = await safeReadDir(agentsDir)

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const name = file.replace('.md', '')
    const content = await safeReadFile(join(agentsDir, file))

    const agent: Agent = { name }

    // Parse role
    const roleMatch = content.match(/(?:Role|Description)\*?\*?:\s*([^\n]+)/i)
    if (roleMatch) agent.role = roleMatch[1].trim()

    // Parse responsibilities
    const respSection = content.match(/##\s*Responsibilities([\s\S]*?)(?=##|$)/i)
    if (respSection) {
      const items = respSection[1].match(/^[-*]\s+(.+)$/gm)
      if (items) {
        agent.responsibilities = items.map(i => i.replace(/^[-*]\s+/, '').trim())
      }
    }

    // Parse when to use
    const whenSection = content.match(/##\s*When to Use([\s\S]*?)(?=##|$)/i)
    if (whenSection) {
      const items = whenSection[1].match(/^[-*]\s+(.+)$/gm)
      if (items) {
        agent.whenToUse = items.map(i => i.replace(/^[-*]\s+/, '').trim())
      }
    }

    agents.push(agent)
  }

  return agents
}

// Parse repo-summary.md - Full analysis
export function parseAnalysis(content: string): AnalysisData {
  const defaults: AnalysisData = { fileCount: 0, commitCount: 0, stack: 'Unknown' }
  if (!content) return defaults

  const fileMatch = content.match(/(\d+)\s*files/i)
  const commitMatch = content.match(/(?:Total Commits|Commits)\*?\*?:\s*(\d+)/i) || content.match(/(\d+)\s*commits/i)
  const stackMatch = content.match(/(?:Runtime|Tech Stack)[^:]*:\s*([^\n]+)/i)

  // Extract tech stack array
  const techStackSection = content.match(/##\s*(?:Tech Stack|Dependencies)([\s\S]*?)(?=##|$)/i)
  const techStack: string[] = []
  if (techStackSection) {
    const items = techStackSection[1].match(/[-*]\s+([^:\n]+)/g)
    if (items) {
      techStack.push(...items.map(i => i.replace(/^[-*]\s+/, '').trim()))
    }
  }

  // Extract structure
  const structureSection = content.match(/##\s*(?:Project )?Structure([\s\S]*?)(?=##|$)/i)

  // Extract architecture
  const archSection = content.match(/##\s*Architecture([\s\S]*?)(?=##|$)/i)

  return {
    fileCount: fileMatch ? parseInt(fileMatch[1]) : 0,
    commitCount: commitMatch ? parseInt(commitMatch[1]) : 0,
    stack: stackMatch ? stackMatch[1].trim().replace(/^[-*]\s*/, '') : 'Unknown',
    techStack: techStack.length > 0 ? techStack : undefined,
    structure: structureSection?.[1]?.trim(),
    architecture: archSection?.[1]?.trim()
  }
}

// Parse patterns.md - Code patterns
export function parsePatterns(content: string): CodePatterns | undefined {
  if (!content) return undefined

  const patterns: CodePatterns = {}

  // Module system
  const moduleSection = content.match(/##\s*Module System([\s\S]*?)(?=##|$)/i)
  if (moduleSection) {
    const items = moduleSection[1].match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)
    if (items) {
      patterns.moduleSystem = {}
      for (const item of items) {
        const match = item.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/)
        if (match && !match[1].includes('Pattern')) {
          patterns.moduleSystem[match[1].trim()] = match[2].trim()
        }
      }
    }
  }

  // Naming conventions
  const namingSection = content.match(/##\s*Naming Conventions([\s\S]*?)(?=##|$)/i)
  if (namingSection) {
    const items = namingSection[1].match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)
    if (items) {
      patterns.namingConventions = {}
      for (const item of items) {
        const match = item.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/)
        if (match && !match[1].includes('Element')) {
          patterns.namingConventions[match[1].trim()] = match[2].trim()
        }
      }
    }
  }

  return Object.keys(patterns).length > 0 ? patterns : undefined
}

// ============================================
// MAIN EXPORT
// ============================================

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const storagePath = getStoragePath(projectId)

  // Read all files in parallel
  const [
    nowContent,
    nextContent,
    metricsContent,
    shippedContent,
    ideasContent,
    roadmapContent,
    timelineContent,
    summaryContent,
    patternsContent,
    agents,
    sessions
  ] = await Promise.all([
    safeReadFile(join(storagePath, 'core', 'now.md')),
    safeReadFile(join(storagePath, 'core', 'next.md')),
    safeReadFile(join(storagePath, 'progress', 'metrics.md')),
    safeReadFile(join(storagePath, 'progress', 'shipped.md')),
    safeReadFile(join(storagePath, 'planning', 'ideas.md')),
    safeReadFile(join(storagePath, 'planning', 'roadmap.md')),
    safeReadFile(join(storagePath, 'memory', 'context.jsonl')),
    safeReadFile(join(storagePath, 'analysis', 'repo-summary.md')),
    safeReadFile(join(storagePath, 'analysis', 'patterns.md')),
    parseAgents(storagePath),
    parseSessions(storagePath)
  ])

  const timeline = parseTimeline(timelineContent)
  const ideas = parseIdeas(ideasContent)
  const roadmap = parseRoadmap(roadmapContent)

  // Calculate summary stats from timeline
  const taskStarts = timeline.filter(e => e.type === 'task_start')
  const taskCompletes = timeline.filter(e => e.type === 'task_complete')
  const ships = timeline.filter(e => ['ship', 'feature_ship', 'feature_shipped'].includes(e.type))
  const bugFixes = timeline.filter(e => e.type === 'bug_fix')
  const cleanups = timeline.filter(e => e.type === 'cleanup')

  const firstEvent = timeline[timeline.length - 1]
  const lastEvent = timeline[0]

  // Calculate active days
  const uniqueDays = new Set(timeline.map(e => e.ts?.split('T')[0]).filter(Boolean))

  return {
    currentTask: parseNow(nowContent),
    metrics: parseMetrics(metricsContent),
    shipped: parseShipped(shippedContent),
    queue: parseQueue(nextContent),
    ideas,
    roadmap,
    agents,
    timeline: timeline.slice(0, 100), // Last 100 events
    sessions: sessions.slice(0, 30), // Last 30 days
    analysis: parseAnalysis(summaryContent),
    patterns: parsePatterns(patternsContent),
    summary: {
      totalEvents: timeline.length,
      firstActivity: firstEvent?.ts,
      lastActivity: lastEvent?.ts,
      activeDays: uniqueDays.size,
      totalTasksEver: taskStarts.length,
      totalShipsEver: ships.length,
      totalBugsFixed: bugFixes.length,
      totalCleanups: cleanups.length
    }
  }
}

// ============================================
// RAW FILES - Return markdown files as-is for rendering
// ============================================

export interface RawProjectFiles {
  shipped: string    // progress/shipped.md
  roadmap: string    // planning/roadmap.md
  ideas: string      // planning/ideas.md
  queue: string      // core/next.md
  now: string        // core/now.md
  context: string    // core/context.md
  timeline: string   // memory/context.jsonl (raw for custom rendering)
  agents: { name: string; content: string }[]  // agents/*.md
}

export async function getRawProjectFiles(projectId: string): Promise<RawProjectFiles> {
  const storagePath = join(homedir(), '.prjct-cli', 'projects', projectId)

  // Read all files in parallel
  const [
    shipped,
    roadmap,
    ideas,
    queue,
    now,
    context,
    timeline,
    agentFiles
  ] = await Promise.all([
    safeReadFile(join(storagePath, 'progress', 'shipped.md')),
    safeReadFile(join(storagePath, 'planning', 'roadmap.md')),
    safeReadFile(join(storagePath, 'planning', 'ideas.md')),
    safeReadFile(join(storagePath, 'core', 'next.md')),
    safeReadFile(join(storagePath, 'core', 'now.md')),
    safeReadFile(join(storagePath, 'core', 'context.md')),
    safeReadFile(join(storagePath, 'memory', 'context.jsonl')),
    readAgentsRaw(join(storagePath, 'agents'))
  ])

  return {
    shipped,
    roadmap,
    ideas,
    queue,
    now,
    context,
    timeline,
    agents: agentFiles
  }
}

async function readAgentsRaw(agentsDir: string): Promise<{ name: string; content: string }[]> {
  try {
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    const agents = await Promise.all(
      mdFiles.map(async (file) => ({
        name: file.replace('.md', ''),
        content: await safeReadFile(join(agentsDir, file))
      }))
    )

    return agents.filter(a => a.content.trim())
  } catch {
    return []
  }
}
