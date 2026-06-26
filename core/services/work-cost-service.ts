import prjctDb from '../storage/database'
import type { SqliteBindings } from '../storage/database/sqlite-compat'
import { publishCRUD } from '../sync/publish-helper'

interface CountRow {
  value: number
}

interface CostTaskRow {
  id: string
  description: string
  status: string
  started_at: string | null
  completed_at: string | null
  shipped_at: string | null
  tokens_in: number | null
  tokens_out: number | null
}

interface EventRow {
  type: string
  data: string
  timestamp: string
}

interface PerfAggregateRow {
  samples: number
  total: number | null
  average: number | null
}

export interface WorkCostTask {
  id: string
  description: string
  status: string
  tokensIn: number
  tokensOut: number
  tokensTotal: number
  minutes: number | null
}

export interface DeclaredTokenMention {
  tokens: number
  sourceType: string
  occurredAt: string
  summary: string
}

export interface HistoricalRescue {
  inferredWorkCycles: number
  taskTableCycles: number
  eventWorkStarts: number
  eventStatusChanges: number
  eventShips: number
  syncRuns: number
  memoryEvents: number
  postEditEvents: number
  declaredTokenMentions: number
  declaredTokensTotal: number
  topDeclaredTokenMentions: DeclaredTokenMention[]
}

export interface WorkCostSnapshot {
  id: string
  windowDays: number
  generatedAt: string
  workCycles: number
  knownTokenCycles: number
  tokensIn: number
  tokensOut: number
  tokensTotal: number
  tokenCoveragePercent: number
  measuredSessions: number
  surfacedContext: number
  usefulContext: number
  contextZoneEvents: number
  compactions: number
  commandSamples: number
  commandMs: number
  avgStartupMs: number | null
  mostExpensive: WorkCostTask[]
  historicalRescue: HistoricalRescue
  gaps: string[]
}

export function buildWorkCostSnapshot(projectId: string, days: number): WorkCostSnapshot {
  const since = sinceIso(days)
  const now = new Date().toISOString()
  const taskRows = query<CostTaskRow>(
    projectId,
    `SELECT id, description, status, started_at, completed_at, shipped_at, tokens_in, tokens_out
     FROM tasks
     WHERE COALESCE(completed_at, shipped_at, started_at) >= ?
     ORDER BY COALESCE(completed_at, shipped_at, started_at) DESC`,
    since
  )
  const measuredTasks = taskRows
    .map(toCostTask)
    .filter((task): task is WorkCostTask => task !== null)
    .sort((a, b) => b.tokensTotal - a.tokensTotal)

  const eventWorkStarts = eventCount(projectId, 'memory.task_started', since)
  const eventStatusChanges = eventCount(projectId, 'memory.status.changed', since)
  const eventShips = eventCount(projectId, 'memory.feature_shipped', since)
  const syncRuns = eventCount(projectId, 'sync', since)
  const memoryEvents = count(
    projectId,
    'SELECT COUNT(*) AS value FROM events WHERE type >= ? AND type < ? AND timestamp >= ?',
    'memory.',
    'memory/',
    since
  )
  const postEditEvents = eventCount(projectId, 'memory.post_edit', since)
  const measuredSessions = count(
    projectId,
    'SELECT COUNT(*) AS value FROM agent_sessions WHERE started_at >= ?',
    since
  )
  const surfacedContext = count(
    projectId,
    'SELECT COUNT(*) AS value FROM memory_surface_log WHERE created_at >= ?',
    since
  )
  const usefulContext = count(
    projectId,
    'SELECT COUNT(*) AS value FROM memory_usefulness WHERE score > 0 AND last_used_at >= ?',
    since
  )
  const contextZoneEvents = count(
    projectId,
    'SELECT COUNT(*) AS value FROM context_zone_events WHERE timestamp >= ?',
    since
  )
  const compactions = count(
    projectId,
    'SELECT COUNT(*) AS value FROM context_compactions WHERE timestamp >= ?',
    since
  )
  const command = aggregatePerf(projectId, 'command_duration', since)
  const startup = aggregatePerf(projectId, 'startup_time', since)
  const declared = declaredTokenMentions(projectId, since)
  const tokensIn = measuredTasks.reduce((sum, task) => sum + task.tokensIn, 0)
  const tokensOut = measuredTasks.reduce((sum, task) => sum + task.tokensOut, 0)
  const inferredWorkCycles = Math.max(taskRows.length, eventWorkStarts, eventShips)

  const gaps: string[] = []
  if (inferredWorkCycles === 0) {
    gaps.push('No work cycles were found in tasks or historical events for this window.')
  } else if (taskRows.length === 0) {
    gaps.push('Work history was rescued from events, but normalized task rows are missing.')
  }
  if (taskRows.length > 0 && measuredTasks.length === 0) {
    gaps.push(
      'Work cycles exist, but none have exact token totals. Capture exact or estimated usage at task close.'
    )
  }
  if (measuredSessions === 0) {
    gaps.push(
      'No agent sessions were recorded. Session-level model/runtime/cost cannot be attributed yet.'
    )
  }
  if (surfacedContext === 0) {
    gaps.push(
      'No surfaced context was logged in this window, so reuse and re-exploration waste cannot be proven.'
    )
  }

  return {
    id: `work-cost-${days}d`,
    windowDays: days,
    generatedAt: now,
    workCycles: inferredWorkCycles,
    knownTokenCycles: measuredTasks.length,
    tokensIn,
    tokensOut,
    tokensTotal: tokensIn + tokensOut,
    tokenCoveragePercent:
      inferredWorkCycles === 0 ? 0 : Math.round((measuredTasks.length / inferredWorkCycles) * 100),
    measuredSessions,
    surfacedContext,
    usefulContext,
    contextZoneEvents,
    compactions,
    commandSamples: command.samples,
    commandMs: Math.round(command.total ?? 0),
    avgStartupMs: startup.average === null ? null : Math.round(startup.average),
    mostExpensive: measuredTasks.slice(0, 8),
    historicalRescue: {
      inferredWorkCycles,
      taskTableCycles: taskRows.length,
      eventWorkStarts,
      eventStatusChanges,
      eventShips,
      syncRuns,
      memoryEvents,
      postEditEvents,
      declaredTokenMentions: declared.length,
      declaredTokensTotal: declared.reduce((sum, item) => sum + item.tokens, 0),
      topDeclaredTokenMentions: declared.slice(0, 5),
    },
    gaps,
  }
}

export async function publishWorkCostSnapshots(
  projectId: string,
  windows: number[] = [7, 30, 90]
): Promise<WorkCostSnapshot[]> {
  const snapshots = windows.map((days) => buildWorkCostSnapshot(projectId, days))
  for (const snapshot of snapshots) {
    await publishCRUD({
      projectId,
      entityType: 'work_cost_snapshots',
      entityId: snapshot.id,
      eventType: 'upsert',
      data: snapshot,
    })
  }
  return snapshots
}

function toCostTask(row: CostTaskRow): WorkCostTask | null {
  const tokensIn = nullableNumber(row.tokens_in) ?? 0
  const tokensOut = nullableNumber(row.tokens_out) ?? 0
  const tokensTotal = tokensIn + tokensOut
  if (tokensTotal <= 0) return null
  return {
    id: row.id,
    description: row.description,
    status: row.status,
    tokensIn,
    tokensOut,
    tokensTotal,
    minutes: durationMinutes(row.started_at, row.completed_at ?? row.shipped_at),
  }
}

function declaredTokenMentions(projectId: string, since: string): DeclaredTokenMention[] {
  const rows = query<EventRow>(
    projectId,
    `SELECT type, data, timestamp
     FROM events
     WHERE timestamp >= ?
       AND type >= ?
       AND type < ?
       AND json_valid(data)
       AND json_extract(data, '$.content') LIKE '%token%'
     ORDER BY timestamp DESC
     LIMIT 200`,
    since,
    'memory.remember.',
    'memory.remember/'
  )
  const mentions: DeclaredTokenMention[] = []
  for (const row of rows) {
    let content = ''
    try {
      const parsed = JSON.parse(row.data) as { content?: unknown }
      if (typeof parsed.content === 'string') content = parsed.content
    } catch {
      continue
    }
    const tokens = extractTokenCounts(content)
    for (const tokenCount of tokens) {
      mentions.push({
        tokens: tokenCount,
        sourceType: row.type,
        occurredAt: row.timestamp,
        summary: summarize(content),
      })
    }
  }
  return mentions.sort((a, b) => b.tokens - a.tokens)
}

function extractTokenCounts(content: string): number[] {
  const counts: number[] = []
  const re = /\b(\d+(?:\.\d+)?)\s*([kKmM])?\s*(?:tokens?|tok)\b/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const value = Number.parseFloat(match[1] ?? '0')
    const suffix = match[2]?.toLowerCase()
    if (!Number.isFinite(value) || value <= 0) continue
    const multiplier = suffix === 'm' ? 1_000_000 : suffix === 'k' ? 1_000 : 1
    counts.push(Math.round(value * multiplier))
  }
  return counts
}

function summarize(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.length <= 140 ? normalized : `${normalized.slice(0, 137)}...`
}

function eventCount(projectId: string, type: string, since: string): number {
  return count(
    projectId,
    'SELECT COUNT(*) AS value FROM events WHERE type = ? AND timestamp >= ?',
    type,
    since
  )
}

function aggregatePerf(projectId: string, metric: string, since: string): PerfAggregateRow {
  return (
    query<PerfAggregateRow>(
      projectId,
      `SELECT COUNT(*) AS samples, COALESCE(SUM(value), 0) AS total, AVG(value) AS average
       FROM perf_samples
       WHERE metric = ? AND timestamp >= ?`,
      metric,
      since
    )[0] ?? { samples: 0, total: 0, average: null }
  )
}

function count(projectId: string, sql: string, ...params: SqliteBindings[]): number {
  try {
    return Number(prjctDb.get<CountRow>(projectId, sql, ...params)?.value ?? 0)
  } catch {
    return 0
  }
}

function query<T>(projectId: string, sql: string, ...params: SqliteBindings[]): T[] {
  try {
    return prjctDb.query<T>(projectId, sql, ...params)
  } catch {
    return []
  }
}

function sinceIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  if (!start || !end) return null
  const started = Date.parse(start)
  const ended = Date.parse(end)
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return null
  return Math.round((ended - started) / 60_000)
}
