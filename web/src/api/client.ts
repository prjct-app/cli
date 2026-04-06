const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface ProjectSummary {
  id: string
  name: string
  path: string | null
  stack: string | null
  branch: string | null
  fileCount: number | null
  lastSync: string | null
  version: string | null
  currentTask?: { id: string; description: string; startedAt: string; branch?: string; duration?: string; type?: string } | null
  pausedTask?: { description: string } | null
  stats: { queueCount: number; ideasCount: number; shippedCount: number; tasksToday: number; tasksThisWeek: number }
}

export interface Task {
  id?: string
  description: string
  status?: string
  startedAt?: string
  branch?: string
  linearId?: string
  type?: string
  estimatedPoints?: number
  subtasks?: { description: string; status: string }[]
  currentSubtaskIndex?: number
  duration?: string
}

export interface TaskHistory {
  taskId: string
  title: string
  classification: string
  startedAt: string
  completedAt: string
  subtaskCount: number
  branchName?: string
  prUrl?: string
  outcome?: string
  tokensIn?: number
  tokensOut?: number
}

export interface QueueTask {
  id: string
  description: string
  body?: string
  priority: string
  type: string
  section: string
  completed: boolean
  createdAt: string
  featureId?: string
  featureName?: string
}

export interface TaskComment {
  id: string
  taskId: string
  author: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Idea {
  id: string
  text: string
  status: string
  priority: string
  tags: string[]
  addedAt: string
  details?: string
}

export interface ShippedItem {
  id: string
  name: string
  version?: string
  type?: string
  shippedAt: string
  description?: string
  duration?: string
  codeMetrics?: { filesChanged?: number; linesAdded?: number; linesRemoved?: number }
}

export interface Feature {
  id: string
  name: string
  status: string
  progress: number
  description?: string
}

export interface Analysis {
  architecture?: { style: string; insights: string[]; domains: string[] }
  patterns?: { name: string; description: string; confidence: number }[]
  antiPatterns?: { issue: string; suggestion: string; severity: string }[]
  techDebt?: { description: string; effort: string; priority: string }[]
  stack?: { languages: string[]; frameworks: string[] }
  conventions?: { category: string; rule: string }[]
  analyzedAt?: string
}

export interface ProjectFull {
  id: string
  name: string
  path?: string
  description?: string
  techStack?: string[]
  state: {
    currentTask: Task | null
    previousTask?: Task | null
    pausedTasks?: Task[]
    taskHistory?: TaskHistory[]
    lastUpdated: string
  }
  queue: { tasks: QueueTask[]; lastUpdated: string }
  ideas: { ideas: Idea[]; lastUpdated: string }
  shipped: { shipped: ShippedItem[]; lastUpdated: string }
  roadmap: { features: Feature[] } | null
  analysis?: Analysis | null
  stats: { tasksToday: number; tasksThisWeek: number; queueCount: number; ideasCount: number; shippedCount: number }
}

export interface Workflow {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  isBuiltin: boolean
  enabled: boolean
  metadata: Record<string, unknown> | null
}

export interface WorkflowRule {
  id: number
  type: 'hook' | 'gate' | 'step' | 'instruction'
  command: string
  position: string
  action: string
  description: string | null
  enabled: boolean
  timeoutMs: number
  createdAt: string
  sortOrder: number
}

export interface SerializedEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

// ─── Analytics types ───

export interface MetricsSummary {
  totalTokensSaved: number
  estimatedCostSaved: number
  compressionRate: number
  syncCount: number
  avgSyncDuration: number
  topAgents: { agentName: string; usageCount: number; tokensSaved: number }[]
  last30DaysTokens: number
  trend: number
  dailyStats: { date: string; tokensSaved: number; syncs: number; avgCompressionRate: number; totalDuration: number }[]
}

export interface VelocityMetrics {
  sprints: { sprintNumber: number; startDate: string; endDate: string; pointsCompleted: number; tasksCompleted: number; avgVariance: number; estimationAccuracy: number }[]
  averageVelocity: number
  velocityTrend: string
  estimationAccuracy: number
  overEstimated: { category: string; avgVariance: number; taskCount: number }[]
  underEstimated: { category: string; avgVariance: number; taskCount: number }[]
  lastUpdated: string
}

export interface ContextHealth {
  summary: { smartPercent: number; warningPercent: number; dumbPercent: number; compactions: number } | null
  transitions: { from: string; to: string; usagePercent: number; timestamp: string; action: string | null }[]
}

export interface ProjectEvent {
  id: number
  type: string
  timestamp: string
  [key: string]: unknown
}

export interface MemoryEntry {
  id: number
  key: string
  value: string
  category?: string
  updated_at: string
  [key: string]: unknown
}

export interface SessionEntry {
  id: string | number
  started_at: string
  ended_at?: string
  duration_ms?: number
  [key: string]: unknown
}

export interface ArchiveEntry {
  id: number
  entity_type: string
  entity_id: string
  entity_data: string
  summary?: string
  archived_at: string
  reason?: string
}

export interface GlobalStats {
  totalProjects: number
  activeProjects: number
  totalTasks: number
  totalIdeas: number
  totalShipped: number
  timestamp: string
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) { if (v !== undefined) p.set(k, String(v)) }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  projects: () => request<{ projects: ProjectSummary[] }>('/projects').then((r) => r.projects),
  project: (id: string) => request<ProjectFull>(`/projects/${id}/full`),
  completeTask: (id: string) => request(`/projects/${id}/task/complete`, { method: 'POST' }),
  pauseTask: (id: string, reason?: string) => request(`/projects/${id}/task/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resumeTask: (id: string) => request(`/projects/${id}/task/resume`, { method: 'POST' }),
  updateTask: (id: string, updates: Partial<Task>) => request(`/projects/${id}/task`, { method: 'PATCH', body: JSON.stringify(updates) }),
  addQueueTask: (id: string, task: { description: string; priority?: string; type?: string; section?: string }) => request(`/projects/${id}/queue`, { method: 'POST', body: JSON.stringify(task) }),
  updateQueueTask: (id: string, taskId: string, updates: { priority?: string; section?: string; description?: string; body?: string; type?: string }) => request(`/projects/${id}/queue/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  getQueueTask: (id: string, taskId: string) => request<{ task: QueueTask; comments: TaskComment[] }>(`/projects/${id}/queue/${taskId}`),
  addComment: (id: string, taskId: string, content: string) => request<{ comment: TaskComment }>(`/projects/${id}/queue/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  updateComment: (id: string, taskId: string, commentId: string, content: string) => request(`/projects/${id}/queue/${taskId}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  deleteComment: (id: string, taskId: string, commentId: string) => request(`/projects/${id}/queue/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
  deleteQueueTask: (id: string, taskId: string) => request(`/projects/${id}/queue/${taskId}`, { method: 'DELETE' }),
  startQueueTask: (id: string, taskId: string) => request(`/projects/${id}/queue/start`, { method: 'POST', body: JSON.stringify({ taskId }) }),
  addIdea: (id: string, text: string, priority?: string) => request(`/projects/${id}/ideas`, { method: 'POST', body: JSON.stringify({ text, priority }) }),
  updateIdea: (id: string, ideaId: string, updates: { priority?: string; tags?: string[] }) => request(`/projects/${id}/ideas/${ideaId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteIdea: (id: string, ideaId: string) => request(`/projects/${id}/ideas/${ideaId}`, { method: 'DELETE' }),
  archiveIdea: (id: string, ideaId: string) => request(`/projects/${id}/ideas/${ideaId}/archive`, { method: 'POST' }),
  renameProject: (id: string, name: string) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  updateProject: (id: string, updates: { name?: string; description?: string; stack?: string; techStack?: string[]; repoPath?: string }) =>
    request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteProject: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
  // Workflow graph (visual edges)
  getWorkflowGraph: (id: string) => request<{ edges: SerializedEdge[] }>(`/projects/${id}/workflow-graph`),
  saveWorkflowGraph: (id: string, edges: SerializedEdge[]) => request(`/projects/${id}/workflow-graph`, { method: 'PUT', body: JSON.stringify({ edges }) }),
  // Workflows
  workflows: (id: string) => request<{ workflows: Workflow[]; rules: WorkflowRule[] }>(`/projects/${id}/workflows`),
  toggleWorkflow: (id: string, name: string, enabled: boolean) =>
    request(`/projects/${id}/workflows/${name}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  addWorkflowRule: (id: string, rule: Omit<WorkflowRule, 'id' | 'createdAt' | 'sortOrder'>) =>
    request<{ id: number }>(`/projects/${id}/workflow-rules`, { method: 'POST', body: JSON.stringify(rule) }),
  updateWorkflowRule: (id: string, ruleId: number, updates: Partial<WorkflowRule>) =>
    request(`/projects/${id}/workflow-rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteWorkflowRule: (id: string, ruleId: number) =>
    request(`/projects/${id}/workflow-rules/${ruleId}`, { method: 'DELETE' }),
  // ─── Analytics ───
  metrics: (id: string) => request<MetricsSummary>(`/projects/${id}/metrics`),
  velocity: (id: string) => request<VelocityMetrics>(`/projects/${id}/velocity`),
  contextHealth: (id: string) => request<ContextHealth>(`/projects/${id}/context-health`),
  contextFeedback: (id: string) => request<{ feedback: Record<string, unknown>[] }>(`/projects/${id}/context-feedback`),
  analysisFull: (id: string) => request<{ analysis: Analysis | null; history: { id: number; commitHash: string | null; status: string; analyzedAt: string; patternCount: number }[] }>(`/projects/${id}/analysis/full`),
  projectIndex: (id: string) => request<{ index: Record<string, unknown> | null; domains: Record<string, unknown> | null; scores: Record<string, unknown>[]; categories: Record<string, unknown> | null }>(`/projects/${id}/index`),
  stateFull: (id: string) => request<{ currentTask: Task | null; previousTask: Task | null; pausedTasks: Task[]; taskHistory: TaskHistory[]; lastUpdated: string }>(`/projects/${id}/state/full`),
  projectConfig: (id: string) => request<Record<string, unknown>>(`/projects/${id}/config`),
  roadmapFull: (id: string) => request<{ features: Feature[]; backlog: Feature[]; lastUpdated?: string }>(`/projects/${id}/roadmap`),
  // ─── Activity ───
  events: (id: string, opts?: { limit?: number; offset?: number; type?: string }) =>
    request<{ events: ProjectEvent[]; total: number; limit: number; offset: number }>(`/projects/${id}/events${qs(opts as Record<string, string | number | undefined>)}`),
  memory: (id: string) => request<{ items: MemoryEntry[] }>(`/projects/${id}/memory`),
  sessions: (id: string) => request<{ sessions: SessionEntry[]; agentSessions: SessionEntry[] }>(`/projects/${id}/sessions`),
  // ─── External ───
  issues: (id: string) => request<{ issues: Record<string, unknown>[] }>(`/projects/${id}/issues`),
  tasks: (id: string) => request<{ tasks: TaskHistory[]; subtasks: Record<string, unknown>[] }>(`/projects/${id}/tasks`),
  archives: (id: string, opts?: { type?: string; limit?: number }) =>
    request<{ items: ArchiveEntry[]; stats: { total: number; byType: Record<string, number> } }>(`/projects/${id}/archives${qs(opts as Record<string, string | number | undefined>)}`),
  // ─── Global ───
  globalStats: () => request<GlobalStats>('/stats/global'),
}
