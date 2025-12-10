/**
 * Unified Loader
 *
 * Loads project data from the new unified state modules.
 * Provides faster access than parsing markdown files.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

/**
 * Project state from state.json
 */
export interface ProjectState {
  projectId: string
  currentTask: CurrentTask | null
  queue: QueuedTask[]
  activeFeature: ActiveFeature | null
  stats: PerformanceStats
  recentActivity: RecentActivity[]
  lastSync: string
  version: number
}

export interface CurrentTask {
  id: string
  description: string
  startedAt: string
  agent?: string
  agentConfidence?: number
  estimatedDuration?: string
  featureId?: string
  pausedAt?: string
  pauseReason?: string
}

export interface QueuedTask {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  featureId?: string
  estimatedDuration?: string
  tags?: string[]
  createdAt: string
  blockedReason?: string
}

export interface ActiveFeature {
  id: string
  name: string
  status: 'planned' | 'in_progress' | 'completed' | 'shipped'
  tasksCompleted: number
  tasksRemaining: number
  estimatedEffort?: string
  actualEffort?: string
  startedAt: string
}

export interface PerformanceStats {
  tasksToday: number
  tasksThisWeek: number
  avgDuration: string
  velocity: string
  estimateAccuracy: number
  streak: number
}

export interface RecentActivity {
  type: 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'
  description: string
  timestamp: string
  duration?: string
}

/**
 * Outcome summary from analyzer
 */
export interface OutcomeSummary {
  totalOutcomes: number
  avgQualityScore: number
  estimateAccuracy: number
  topBlockers: string[]
  topAgents: string[]
  patternsDetected: string[]
}

/**
 * Agent performance data
 */
export interface AgentPerformance {
  agentName: string
  taskType: string
  tasksCompleted: number
  successRate: number
  avgDuration: string
  estimateAccuracy: number
  improving: boolean
  lastUpdated: string
  bestFor: string[]
  avoidFor: string[]
}

/**
 * Insights computed from all data
 */
export interface ProjectInsights {
  healthScore: number
  estimateAccuracy: number
  topBlockers: string[]
  patternsDetected: string[]
  recommendations: string[]
}

/**
 * Unified response combining all data
 */
export interface UnifiedProjectData {
  state: ProjectState | null
  outcomes: OutcomeSummary | null
  agentPerformance: AgentPerformance[]
  insights: ProjectInsights
  // Legacy fallback data
  legacyFallback: boolean
}

const DEFAULT_STATE: ProjectState = {
  projectId: '',
  currentTask: null,
  queue: [],
  activeFeature: null,
  stats: {
    tasksToday: 0,
    tasksThisWeek: 0,
    avgDuration: '0h',
    velocity: '0',
    estimateAccuracy: 0,
    streak: 0,
  },
  recentActivity: [],
  lastSync: new Date().toISOString(),
  version: 1,
}

/**
 * Read state.json for a project
 */
async function readState(projectId: string): Promise<ProjectState | null> {
  const statePath = join(GLOBAL_STORAGE, projectId, 'core', 'state.json')
  try {
    const content = await fs.readFile(statePath, 'utf-8')
    return JSON.parse(content) as ProjectState
  } catch {
    return null
  }
}

/**
 * Read outcomes summary
 */
async function readOutcomes(projectId: string): Promise<OutcomeSummary | null> {
  const outcomesPath = join(GLOBAL_STORAGE, projectId, 'outcomes', 'outcomes.jsonl')
  try {
    const content = await fs.readFile(outcomesPath, 'utf-8')
    const outcomes = content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))

    if (outcomes.length === 0) return null

    // Calculate summary
    const avgQuality = outcomes.reduce((sum: number, o: { qualityScore: number }) =>
      sum + o.qualityScore, 0) / outcomes.length

    // Count accurate estimates (within 20%)
    const accurateCount = outcomes.filter((o: { variance: string; estimatedDuration: string }) => {
      if (!o.variance) return false
      const variance = parseVariance(o.variance)
      const estimated = parseDuration(o.estimatedDuration)
      if (estimated === 0) return false
      return Math.abs(variance) / estimated <= 0.2
    }).length

    // Count blockers
    const blockerCounts = new Map<string, number>()
    for (const outcome of outcomes) {
      for (const blocker of outcome.blockers || []) {
        blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1)
      }
    }
    const topBlockers = [...blockerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([blocker]) => blocker)

    // Count agents
    const agentCounts = new Map<string, number>()
    for (const outcome of outcomes) {
      if (outcome.agentUsed) {
        agentCounts.set(outcome.agentUsed, (agentCounts.get(outcome.agentUsed) || 0) + 1)
      }
    }
    const topAgents = [...agentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([agent]) => agent)

    // Detect patterns
    const patterns: string[] = []
    const underestimated = outcomes.filter((o: { variance: string }) => {
      const variance = parseVariance(o.variance)
      return variance > 0
    })
    if (underestimated.length / outcomes.length > 0.6) {
      patterns.push('Tasks consistently take longer than estimated')
    }

    return {
      totalOutcomes: outcomes.length,
      avgQualityScore: Math.round(avgQuality * 10) / 10,
      estimateAccuracy: Math.round((accurateCount / outcomes.length) * 100),
      topBlockers,
      topAgents,
      patternsDetected: patterns,
    }
  } catch {
    return null
  }
}

/**
 * Read agent performance data
 */
async function readAgentPerformance(projectId: string): Promise<AgentPerformance[]> {
  const perfPath = join(GLOBAL_STORAGE, projectId, 'analysis', 'agent-performance.json')
  try {
    const content = await fs.readFile(perfPath, 'utf-8')
    const data = JSON.parse(content)
    return data.agents || []
  } catch {
    return []
  }
}

/**
 * Compute insights from all data
 */
function computeInsights(
  state: ProjectState | null,
  outcomes: OutcomeSummary | null,
  agentPerformance: AgentPerformance[]
): ProjectInsights {
  let healthScore = 50 // Base score

  // Adjust for state
  if (state) {
    // Has current task = +10
    if (state.currentTask) healthScore += 10

    // Velocity bonus (max +20)
    const velocity = parseFloat(state.stats.velocity) || 0
    healthScore += Math.min(20, velocity * 5)

    // Streak bonus (max +15)
    healthScore += Math.min(15, state.stats.streak * 3)

    // Queue size penalty (too many = -5)
    if (state.queue.length > 15) healthScore -= 5
  }

  // Adjust for outcomes
  if (outcomes) {
    // Estimate accuracy bonus (max +15)
    healthScore += Math.round(outcomes.estimateAccuracy * 0.15)

    // Quality score bonus (max +10)
    healthScore += Math.round(outcomes.avgQualityScore * 2)

    // Blockers penalty
    healthScore -= outcomes.topBlockers.length * 2
  }

  // Adjust for agent performance
  if (agentPerformance.length > 0) {
    const avgSuccess = agentPerformance.reduce((sum, a) => sum + a.successRate, 0) / agentPerformance.length
    healthScore += Math.round(avgSuccess * 0.1)
  }

  // Clamp to 0-100
  healthScore = Math.max(0, Math.min(100, healthScore))

  // Build recommendations
  const recommendations: string[] = []

  if (!state?.currentTask) {
    recommendations.push('Start a task with /p:now to maintain momentum')
  }

  if (state && state.queue.length > 10) {
    recommendations.push('Queue is large - consider prioritizing or archiving tasks')
  }

  if (outcomes && outcomes.estimateAccuracy < 50) {
    recommendations.push('Estimate accuracy is low - try adding 30% buffer to estimates')
  }

  if (agentPerformance.length === 0) {
    recommendations.push('No agent performance data yet - track outcomes with /p:done')
  }

  const improving = agentPerformance.filter(a => a.improving)
  if (improving.length > 0) {
    recommendations.push(`${improving.map(a => a.agentName).join(', ')} improving - great progress!`)
  }

  return {
    healthScore,
    estimateAccuracy: outcomes?.estimateAccuracy || 0,
    topBlockers: outcomes?.topBlockers || [],
    patternsDetected: outcomes?.patternsDetected || [],
    recommendations: recommendations.slice(0, 4),
  }
}

/**
 * Parse variance string to minutes
 */
function parseVariance(variance: string): number {
  const match = variance.match(/^([+-])(\d+)([mh])$/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const value = parseInt(match[2], 10)
  const unit = match[3]

  return sign * (unit === 'h' ? value * 60 : value)
}

/**
 * Parse duration string to minutes
 */
function parseDuration(duration: string): number {
  let minutes = 0

  const hourMatch = duration.match(/(\d+)h/)
  if (hourMatch) {
    minutes += parseInt(hourMatch[1], 10) * 60
  }

  const minMatch = duration.match(/(\d+)m/)
  if (minMatch) {
    minutes += parseInt(minMatch[1], 10)
  }

  return minutes
}

/**
 * Load unified project data
 */
export async function loadUnifiedProjectData(projectId: string): Promise<UnifiedProjectData> {
  // Try to read from new unified state
  const [state, outcomes, agentPerformance] = await Promise.all([
    readState(projectId),
    readOutcomes(projectId),
    readAgentPerformance(projectId),
  ])

  // Compute insights
  const insights = computeInsights(state, outcomes, agentPerformance)

  return {
    state,
    outcomes,
    agentPerformance,
    insights,
    legacyFallback: state === null,
  }
}

/**
 * Check if unified state exists for a project
 */
export async function hasUnifiedState(projectId: string): Promise<boolean> {
  const statePath = join(GLOBAL_STORAGE, projectId, 'core', 'state.json')
  try {
    await fs.access(statePath)
    return true
  } catch {
    return false
  }
}
