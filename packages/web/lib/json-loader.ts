/**
 * JSON Loader
 *
 * Loads project data directly from JSON files.
 * No parsing of markdown - just read JSON.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

// Re-export types that match core/schemas
export interface CurrentTask {
  id: string
  description: string
  startedAt: string
  agent?: string
  featureId?: string
  estimatedDuration?: string
  pausedAt?: string
  pauseReason?: string
}

export interface QueuedTask {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  featureId?: string
  estimatedDuration?: string
  createdAt: string
  blockedReason?: string
  tags?: string[]
}

export interface Stats {
  tasksToday: number
  tasksThisWeek: number
  streak: number
  velocity: string
  avgDuration: string
}

export interface RecentActivity {
  type: 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'
  description: string
  timestamp: string
  duration?: string
}

export interface StateJson {
  projectId: string
  currentTask: CurrentTask | null
  queue: QueuedTask[]
  stats: Stats
  recentActivity: RecentActivity[]
  lastSync: string
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

export interface IdeaJson {
  id: string
  content: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'archived' | 'converted'
  tags: string[]
  createdAt: string
  archivedAt?: string
}

export interface FeatureTask {
  description: string
  completed: boolean
}

export interface FeatureJson {
  id: string
  name: string
  description?: string
  status: 'planned' | 'in_progress' | 'completed' | 'shipped'
  impact: 'low' | 'medium' | 'high'
  effort?: string
  tasks: FeatureTask[]
  createdAt: string
  completedAt?: string
}

export interface ShippedItemJson {
  id: string
  description: string
  featureId?: string
  duration: string
  shippedAt: string
  commitHash?: string
}

export interface CodePattern {
  name: string
  description: string
  location?: string
}

export interface AntiPattern {
  issue: string
  file: string
  suggestion: string
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
  patterns: CodePattern[]
  antiPatterns: AntiPattern[]
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

async function readJsonFile<T>(path: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(path, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

function getProjectPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId)
}

// ============================================
// LOADERS
// ============================================

export async function loadState(projectId: string): Promise<StateJson | null> {
  const path = join(getProjectPath(projectId), 'state.json')
  if (!await fileExists(path)) return null
  return readJsonFile<StateJson>(path, null as unknown as StateJson)
}

export async function loadProject(projectId: string): Promise<ProjectJson | null> {
  const path = join(getProjectPath(projectId), 'project.json')
  if (!await fileExists(path)) return null
  return readJsonFile<ProjectJson>(path, null as unknown as ProjectJson)
}

export async function loadAgents(projectId: string): Promise<AgentJson[]> {
  const path = join(getProjectPath(projectId), 'agents.json')
  return readJsonFile<AgentJson[]>(path, [])
}

export async function loadIdeas(projectId: string): Promise<IdeaJson[]> {
  const path = join(getProjectPath(projectId), 'ideas.json')
  return readJsonFile<IdeaJson[]>(path, [])
}

export async function loadRoadmap(projectId: string): Promise<FeatureJson[]> {
  const path = join(getProjectPath(projectId), 'roadmap.json')
  return readJsonFile<FeatureJson[]>(path, [])
}

export async function loadShipped(projectId: string): Promise<ShippedItemJson[]> {
  const path = join(getProjectPath(projectId), 'shipped.json')
  return readJsonFile<ShippedItemJson[]>(path, [])
}

export async function loadAnalysis(projectId: string): Promise<AnalysisJson | null> {
  const path = join(getProjectPath(projectId), 'analysis.json')
  if (!await fileExists(path)) return null
  return readJsonFile<AnalysisJson>(path, null as unknown as AnalysisJson)
}

export async function loadOutcomes(projectId: string): Promise<OutcomeJson[]> {
  const path = join(getProjectPath(projectId), 'outcomes.json')
  return readJsonFile<OutcomeJson[]>(path, [])
}

// ============================================
// UNIFIED LOADER
// ============================================

export interface UnifiedJsonData {
  state: StateJson | null
  project: ProjectJson | null
  agents: AgentJson[]
  ideas: IdeaJson[]
  roadmap: FeatureJson[]
  shipped: ShippedItemJson[]
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
  outcomes: OutcomeJson[]
  agents: AgentJson[]
  roadmap: FeatureJson[]
}): ProjectInsights {
  let healthScore = 50

  // State-based scoring
  if (data.state) {
    if (data.state.currentTask) healthScore += 10
    healthScore += Math.min(15, data.state.stats.streak * 3)
    healthScore += Math.min(10, data.state.stats.tasksToday * 2)
    if (data.state.queue.length > 15) healthScore -= 5
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
  if (data.roadmap.length > 0) {
    const completed = data.roadmap.filter(f => f.status === 'completed' || f.status === 'shipped').length
    const progress = Math.round((completed / data.roadmap.length) * 100)
    if (progress > 50) healthScore += 5
  }

  healthScore = Math.max(0, Math.min(100, healthScore))

  // Recommendations
  const recommendations: string[] = []
  if (!data.state?.currentTask) {
    recommendations.push('Start a task with /p:now')
  }
  if (data.state && data.state.queue.length > 10) {
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
  const [state, project, agents, ideas, roadmap, shipped, analysis, outcomes] = await Promise.all([
    loadState(projectId),
    loadProject(projectId),
    loadAgents(projectId),
    loadIdeas(projectId),
    loadRoadmap(projectId),
    loadShipped(projectId),
    loadAnalysis(projectId),
    loadOutcomes(projectId)
  ])

  const insights = computeInsights({ state, outcomes, agents, roadmap })

  // Check if we have any JSON data (not just empty arrays)
  const hasJsonData = state !== null || project !== null || agents.length > 0

  return {
    state,
    project,
    agents,
    ideas,
    roadmap,
    shipped,
    analysis,
    outcomes,
    insights,
    hasJsonData
  }
}

export async function hasJsonState(projectId: string): Promise<boolean> {
  const statePath = join(getProjectPath(projectId), 'state.json')
  const projectPath = join(getProjectPath(projectId), 'project.json')

  const [hasState, hasProject] = await Promise.all([
    fileExists(statePath),
    fileExists(projectPath)
  ])

  return hasState || hasProject
}
