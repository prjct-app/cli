/**
 * JSON Loader
 *
 * Loads project data directly from JSON files in data/ directory.
 * JSON is source of truth, MD is generated for Claude.
 *
 * New Architecture:
 *   ~/.prjct-cli/projects/{projectId}/
 *   └── data/           # JSON source of truth
 *       ├── state.json   # Current task
 *       ├── queue.json   # Task queue
 *       ├── ideas.json   # Ideas
 *       ├── roadmap.json # Features
 *       ├── shipped.json # Shipped items
 *       ├── metrics.json # Stats
 *       └── project.json # Metadata
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

// ============================================
// TYPES - Match enriched schemas from migration.server.ts
// ============================================

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'feature' | 'bug' | 'improvement' | 'chore'
export type TaskSection = 'active' | 'backlog' | 'previously_active'

// Duration object for parsed time strings like "13h 38m"
export interface Duration {
  hours: number
  minutes: number
  totalMinutes: number
}

// Code metrics from "Files: 4 | +160/-31 | Commits: 0"
export interface CodeMetrics {
  filesChanged?: number | null
  linesAdded?: number | null
  linesRemoved?: number | null
  commits?: number | null
}

// Git commit information
export interface CommitInfo {
  hash?: string
  message?: string
  branch?: string
}

export interface CurrentTask {
  id: string
  description: string
  startedAt: string
  sessionId: string
  featureId?: string
}

export interface PreviousTask {
  id: string
  description: string
  status: 'paused'
  startedAt: string
  pausedAt: string
}

export interface StateJson {
  currentTask: CurrentTask | null
  previousTask?: PreviousTask | null
  lastUpdated: string
}

export interface QueueTask {
  id: string
  description: string
  priority: Priority
  type: TaskType
  featureId?: string
  originFeature?: string
  completed: boolean
  completedAt?: string
  createdAt: string
  section: TaskSection
  // ZERO DATA LOSS fields
  agent?: string              // "fe", "be", "fe + be"
  groupName?: string          // "Sales Reports", "Stock Audits"
  groupId?: string            // For grouping related tasks
}

export interface QueueJson {
  tasks: QueueTask[]
  lastUpdated: string
}

export type IdeaPriority = 'low' | 'medium' | 'high'
export type IdeaStatus = 'pending' | 'converted' | 'completed' | 'archived'

export interface ImpactEffort {
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
}

// Tech stack definition for idea specs
export interface TechStack {
  frontend?: string
  backend?: string
  payments?: string
  ai?: string
  deploy?: string
  other?: string[]
}

// Module definition for complex ideas
export interface IdeaModule {
  name: string
  description: string
}

// Role definition
export interface IdeaRole {
  name: string
  description?: string
}

export interface IdeaSchema {
  id: string
  text: string
  details?: string
  priority: IdeaPriority
  status: IdeaStatus
  tags: string[]
  addedAt: string
  completedAt?: string
  convertedTo?: string
  // Source documentation
  source?: string
  sourceFiles?: string[]
  // Enriched fields from MD
  painPoints?: string[]
  solutions?: string[]
  filesAffected?: string[]
  impactEffort?: ImpactEffort
  implementationNotes?: string
  // Technical spec fields for ZERO DATA LOSS
  stack?: TechStack
  modules?: IdeaModule[]
  roles?: IdeaRole[]
  risks?: string[]
  risksCount?: number
}

export interface IdeasJson {
  ideas: IdeaSchema[]
  lastUpdated: string
}

export type FeatureStatus = 'planned' | 'active' | 'completed' | 'shipped'
export type FeatureImpact = 'low' | 'medium' | 'high'
export type FeatureType = 'feature' | 'breaking_change' | 'refactor' | 'infrastructure'

export interface FeatureTask {
  id: string
  description: string
  completed: boolean
  completedAt?: string
}

export interface RoadmapPhase {
  id: string
  name: string
  status: 'completed' | 'active' | 'planned'
  completedAt?: string
}

export interface RoadmapStrategy {
  goal: string
  phases: RoadmapPhase[]
  successMetrics?: string[]
}

// Duration for completed sprints/features
export interface FeatureDuration {
  hours: number
  minutes: number
  totalMinutes: number
  display?: string
}

export interface FeatureSchema {
  id: string
  name: string
  description?: string
  date: string
  status: FeatureStatus
  impact: FeatureImpact
  effort?: string
  progress: number
  // Enriched fields from MD
  type?: FeatureType
  roi?: number  // 1-5 from star count
  why?: string[]
  technicalNotes?: string[]
  compatibility?: string
  phase?: string
  tasks: FeatureTask[]
  createdAt: string
  shippedAt?: string
  version?: string
  // ZERO DATA LOSS - additional fields
  duration?: FeatureDuration
  taskCount?: number
  agent?: string
  sprintName?: string
  completedDate?: string
}

export interface RoadmapJson {
  strategy?: RoadmapStrategy | null
  features: FeatureSchema[]
  backlog: string[]
  lastUpdated: string
}

export type ShipType = 'feature' | 'fix' | 'improvement' | 'refactor'
export type CheckStatus = 'pass' | 'warning' | 'fail' | 'skipped'

export interface ShipChange {
  description: string
  type?: 'added' | 'changed' | 'fixed' | 'removed'
}

export interface QualityMetrics {
  lintStatus?: CheckStatus | null
  lintDetails?: string
  testStatus?: CheckStatus | null
  testDetails?: string
}

export type AgentType = 'fe' | 'be' | 'fe+be' | 'devops' | 'ai' | string

export interface ShippedItemSchema {
  id: string
  name: string
  version?: string | null
  type: ShipType
  // Agent who worked on this
  agent?: AgentType
  // Full description (narrative text, not just bullet points)
  description?: string
  // Changelog from bullet points
  changes: ShipChange[]
  // Code snippets if any
  codeSnippets?: string[]
  // Git commit info
  commit?: CommitInfo
  // Enriched fields from MD
  codeMetrics?: CodeMetrics
  qualityMetrics?: QualityMetrics
  quantitativeImpact?: string
  duration?: Duration
  tasksCompleted?: number | null
  shippedAt: string
  featureId?: string
}

export interface ShippedJson {
  items: ShippedItemSchema[]
  lastUpdated: string
}

export interface RecentActivity {
  timestamp: string
  action: 'started' | 'completed' | 'shipped' | 'paused'
  description: string
  duration?: { hours: number; minutes: number }
  codeChanges?: CodeMetrics
}

export interface MetricsJson {
  currentSprint: {
    tasksStarted: number
    tasksCompleted: number
    inProgress: number
  }
  allTime: {
    featuresShipped: number
    tasksCompleted: number
    totalTimeTracked: Duration
    daysActive: number
  }
  velocity: {
    featuresPerWeek: number
    tasksPerDay: number
  }
  recentActivity: RecentActivity[]
  lastUpdated: string
}

export interface ProjectJson {
  projectId: string
  name: string
  repoPath: string
  description?: string
  version?: string
  techStack: string[]
  fileCount: number
  commitCount: number
  createdAt: string
  lastSync: string
}

export interface AgentJson {
  name: string
  description: string
  skills: string[]
  patterns: string[]
  filesOwned: string[]
  successRate?: number
  tasksCompleted?: number
  bestFor: string[]
  avoidFor: string[]
}

export interface AnalysisJson {
  projectId: string
  languages: string[]
  frameworks: string[]
  packageManager?: string
  sourceDir?: string
  testDir?: string
  configFiles: string[]
  fileCount: number
  patterns: Array<{ name: string; description: string; location?: string }>
  antiPatterns: Array<{ issue: string; file: string; suggestion: string }>
  analyzedAt: string
}

export interface OutcomeJson {
  id: string
  taskId: string
  description: string
  estimatedDuration?: string
  actualDuration: string
  completedAsPlanned: boolean
  qualityScore: 1 | 2 | 3 | 4 | 5
  blockers: string[]
  agentUsed?: string
  completedAt: string
}

// ============================================
// HELPERS
// ============================================

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function getDataPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId, 'data')
}

function getProjectPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId)
}

// ============================================
// LOADERS - Read from data/ directory
// ============================================

export async function loadState(projectId: string): Promise<StateJson | null> {
  const filePath = join(getDataPath(projectId), 'state.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<StateJson>(filePath, null as unknown as StateJson)
}

export async function loadQueue(projectId: string): Promise<QueueJson | null> {
  const filePath = join(getDataPath(projectId), 'queue.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<QueueJson>(filePath, null as unknown as QueueJson)
}

export async function loadIdeas(projectId: string): Promise<IdeasJson | null> {
  const filePath = join(getDataPath(projectId), 'ideas.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<IdeasJson>(filePath, null as unknown as IdeasJson)
}

export async function loadRoadmap(projectId: string): Promise<RoadmapJson | null> {
  const filePath = join(getDataPath(projectId), 'roadmap.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<RoadmapJson>(filePath, null as unknown as RoadmapJson)
}

export async function loadShipped(projectId: string): Promise<ShippedJson | null> {
  const filePath = join(getDataPath(projectId), 'shipped.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<ShippedJson>(filePath, null as unknown as ShippedJson)
}

export async function loadMetrics(projectId: string): Promise<MetricsJson | null> {
  const filePath = join(getDataPath(projectId), 'metrics.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<MetricsJson>(filePath, null as unknown as MetricsJson)
}

export async function loadProject(projectId: string): Promise<ProjectJson | null> {
  // Try data/ first, then root for backwards compatibility
  let filePath = join(getDataPath(projectId), 'project.json')
  if (!await fileExists(filePath)) {
    filePath = join(getProjectPath(projectId), 'project.json')
  }
  if (!await fileExists(filePath)) return null
  return readJsonFile<ProjectJson>(filePath, null as unknown as ProjectJson)
}

export async function loadAgents(projectId: string): Promise<AgentJson[]> {
  const filePath = join(getDataPath(projectId), 'agents.json')
  return readJsonFile<AgentJson[]>(filePath, [])
}

export async function loadAnalysis(projectId: string): Promise<AnalysisJson | null> {
  const filePath = join(getDataPath(projectId), 'analysis.json')
  if (!await fileExists(filePath)) return null
  return readJsonFile<AnalysisJson>(filePath, null as unknown as AnalysisJson)
}

export async function loadOutcomes(projectId: string): Promise<OutcomeJson[]> {
  const filePath = join(getDataPath(projectId), 'outcomes.json')
  return readJsonFile<OutcomeJson[]>(filePath, [])
}

// ============================================
// UNIFIED LOADER
// ============================================

export interface UnifiedJsonData {
  state: StateJson | null
  queue: QueueJson | null
  project: ProjectJson | null
  agents: AgentJson[]
  ideas: IdeasJson | null
  roadmap: RoadmapJson | null
  shipped: ShippedJson | null
  metrics: MetricsJson | null
  analysis: AnalysisJson | null
  outcomes: OutcomeJson[]
  // Computed
  insights: ProjectInsights
  hasJsonData: boolean
}

export interface ProjectInsights {
  healthScore: number
  estimateAccuracy: number
  topBlockers: string[]
  patternsDetected: string[]
  recommendations: string[]
}

function computeInsights(data: {
  state: StateJson | null
  queue: QueueJson | null
  metrics: MetricsJson | null
  outcomes: OutcomeJson[]
  agents: AgentJson[]
  roadmap: RoadmapJson | null
}): ProjectInsights {
  let healthScore = 50

  // State-based scoring
  if (data.state?.currentTask) {
    healthScore += 10
  }

  // Metrics-based scoring
  if (data.metrics) {
    healthScore += Math.min(10, (data.metrics.velocity?.tasksPerDay || 0) * 2)
    healthScore += Math.min(5, data.metrics.allTime?.daysActive || 0)
  }

  // Queue scoring
  if (data.queue) {
    const pendingTasks = data.queue.tasks.filter(t => !t.completed).length
    if (pendingTasks > 15) healthScore -= 5
    if (pendingTasks < 5 && pendingTasks > 0) healthScore += 5
  }

  // Outcomes-based scoring
  const outcomes = data.outcomes
  let estimateAccuracy = 0
  const topBlockers: string[] = []
  const patternsDetected: string[] = []

  if (outcomes.length > 0) {
    const avgQuality = outcomes.reduce((sum, o) => sum + o.qualityScore, 0) / outcomes.length
    healthScore += Math.round(avgQuality * 2)

    const completedAsPlanned = outcomes.filter(o => o.completedAsPlanned).length
    estimateAccuracy = Math.round((completedAsPlanned / outcomes.length) * 100)
    healthScore += Math.round(estimateAccuracy * 0.1)

    // Count blockers
    const blockerCounts = new Map<string, number>()
    for (const o of outcomes) {
      for (const b of o.blockers) {
        blockerCounts.set(b, (blockerCounts.get(b) || 0) + 1)
      }
    }
    topBlockers.push(
      ...Array.from(blockerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([b]) => b)
    )

    // Detect patterns
    const underestimated = outcomes.filter(o => !o.completedAsPlanned).length
    if (underestimated / outcomes.length > 0.6) {
      patternsDetected.push('Tasks often take longer than estimated')
    }
  }

  // Agents-based scoring
  if (data.agents.length > 0) {
    const avgSuccess = data.agents
      .filter(a => a.successRate !== undefined)
      .reduce((sum, a) => sum + (a.successRate || 0), 0)
    if (avgSuccess > 0) {
      healthScore += Math.round(avgSuccess * 0.1 / data.agents.length)
    }
  }

  // Roadmap progress
  if (data.roadmap && data.roadmap.features.length > 0) {
    const completed = data.roadmap.features.filter(f => f.status === 'completed' || f.status === 'shipped').length
    const progress = Math.round((completed / data.roadmap.features.length) * 100)
    if (progress > 50) healthScore += 5
  }

  healthScore = Math.max(0, Math.min(100, healthScore))

  // Recommendations
  const recommendations: string[] = []
  if (!data.state?.currentTask) {
    recommendations.push('Start a task with /p:now')
  }
  if (data.queue && data.queue.tasks.filter(t => !t.completed).length > 10) {
    recommendations.push('Queue is large - prioritize tasks')
  }
  if (estimateAccuracy < 50 && outcomes.length > 5) {
    recommendations.push('Add buffer to estimates')
  }
  if (data.agents.length === 0) {
    recommendations.push('Run /p:sync to generate agents')
  }

  return {
    healthScore,
    estimateAccuracy,
    topBlockers,
    patternsDetected,
    recommendations: recommendations.slice(0, 4)
  }
}

export async function loadUnifiedJsonData(projectId: string): Promise<UnifiedJsonData> {
  const [state, queue, project, agents, ideas, roadmap, shipped, metrics, analysis, outcomes] = await Promise.all([
    loadState(projectId),
    loadQueue(projectId),
    loadProject(projectId),
    loadAgents(projectId),
    loadIdeas(projectId),
    loadRoadmap(projectId),
    loadShipped(projectId),
    loadMetrics(projectId),
    loadAnalysis(projectId),
    loadOutcomes(projectId)
  ])

  const insights = computeInsights({ state, queue, metrics, outcomes, agents, roadmap })

  // Check if we have any JSON data
  const hasJsonData = state !== null || project !== null || queue !== null

  return {
    state,
    queue,
    project,
    agents,
    ideas,
    roadmap,
    shipped,
    metrics,
    analysis,
    outcomes,
    insights,
    hasJsonData
  }
}

export async function hasJsonState(projectId: string): Promise<boolean> {
  const statePath = join(getDataPath(projectId), 'state.json')
  const projectPath = join(getDataPath(projectId), 'project.json')

  const [hasState, hasProject] = await Promise.all([
    fileExists(statePath),
    fileExists(projectPath)
  ])

  return hasState || hasProject
}
