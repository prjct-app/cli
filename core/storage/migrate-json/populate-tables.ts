/**
 * Populates normalized tables from kv_store documents during the
 * one-time JSON → SQLite migration.
 *
 * Each populate* function maps one document key (state, queue, ideas,
 * shipped, metrics, analysis, categories-cache) into its table.
 */

import { prjctDb } from '../database'
import { toNum, toStr } from './_helpers'

export function populateNormalized(projectId: string, key: string, data: unknown): void {
  switch (key) {
    case 'state':
      populateTasksFromState(projectId, data as Record<string, unknown>)
      break
    case 'queue':
      populateQueueTasks(projectId, data as Record<string, unknown>)
      break
    case 'ideas':
      populateIdeas(projectId, data as Record<string, unknown>)
      break
    case 'shipped':
      populateShippedFeatures(projectId, data as Record<string, unknown>)
      break
    case 'metrics':
      populateMetricsDaily(projectId, data as Record<string, unknown>)
      break
    case 'analysis':
      populateAnalysis(projectId, data as Record<string, unknown>)
      break
  }
}

function populateTasksFromState(projectId: string, state: Record<string, unknown>): void {
  const db = prjctDb.getDb(projectId)

  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO tasks
    (id, description, type, status, parent_description, branch, linear_id,
     linear_uuid, session_id, feature_id, started_at, completed_at,
     shipped_at, paused_at, pause_reason, pr_url, expected_value, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSubtask = db.prepare(`
    INSERT OR REPLACE INTO subtasks
    (id, task_id, description, status, domain, agent, sort_order,
     depends_on, started_at, completed_at, output, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const migrateTask = (task: Record<string, unknown>, status?: string) => {
    if (!task || !task.id) return

    insertTask.run(
      toStr(task.id) ?? `task-${Date.now()}`,
      toStr(task.description ?? task.parentDescription) ?? '',
      toStr(task.type),
      toStr(status ?? task.status) ?? 'unknown',
      toStr(task.parentDescription),
      toStr(task.branch),
      toStr(task.linearId),
      toStr(task.linearUuid),
      toStr(task.sessionId),
      toStr(task.featureId),
      toStr(task.startedAt) ?? new Date().toISOString(),
      toStr(task.completedAt),
      toStr(task.shippedAt),
      toStr(task.pausedAt),
      toStr(task.pauseReason),
      toStr(task.prUrl),
      task.expectedValue ? JSON.stringify(task.expectedValue) : null,
      JSON.stringify(task)
    )

    const subtasks = task.subtasks as Array<Record<string, unknown>> | undefined
    if (subtasks && Array.isArray(subtasks)) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        insertSubtask.run(
          toStr(st.id) ?? `subtask-${i}`,
          toStr(task.id),
          toStr(st.description) ?? '',
          toStr(st.status) ?? 'pending',
          toStr(st.domain),
          toStr(st.agent),
          i,
          st.dependsOn ? JSON.stringify(st.dependsOn) : null,
          toStr(st.startedAt),
          toStr(st.completedAt),
          toStr(st.output),
          st.summary ? JSON.stringify(st.summary) : null
        )
      }
    }
  }

  if (state.currentTask) migrateTask(state.currentTask as Record<string, unknown>)
  if (state.previousTask) migrateTask(state.previousTask as Record<string, unknown>)

  const paused = state.pausedTasks as Array<Record<string, unknown>> | undefined
  if (paused && Array.isArray(paused)) {
    for (const task of paused) {
      migrateTask(task, 'paused')
    }
  }
}

function populateQueueTasks(projectId: string, data: Record<string, unknown>): void {
  const tasks = data.tasks as Array<Record<string, unknown>> | undefined
  if (!tasks || !Array.isArray(tasks)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO queue_tasks
    (id, description, type, priority, section, created_at, completed, completed_at,
     feature_id, feature_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const t of tasks) {
    stmt.run(
      toStr(t.id) ?? `queue-${Date.now()}`,
      toStr(t.description) ?? '',
      toStr(t.type),
      toStr(t.priority),
      toStr(t.section),
      toStr(t.createdAt) ?? new Date().toISOString(),
      t.completed ? 1 : 0,
      toStr(t.completedAt),
      toStr(t.featureId),
      toStr(t.featureName)
    )
  }
}

function populateIdeas(projectId: string, data: Record<string, unknown>): void {
  const ideas = data.ideas as Array<Record<string, unknown>> | undefined
  if (!ideas || !Array.isArray(ideas)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ideas
    (id, text, status, priority, tags, added_at, converted_to, details, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const idea of ideas) {
    stmt.run(
      toStr(idea.id) ?? `idea-${Date.now()}`,
      toStr(idea.text) ?? '',
      toStr(idea.status) ?? 'pending',
      toStr(idea.priority) ?? 'medium',
      idea.tags ? JSON.stringify(idea.tags) : null,
      toStr(idea.addedAt) ?? new Date().toISOString(),
      toStr(idea.convertedTo),
      toStr(idea.details),
      JSON.stringify(idea)
    )
  }
}

function populateShippedFeatures(projectId: string, data: Record<string, unknown>): void {
  const shipped = data.shipped as Array<Record<string, unknown>> | undefined
  if (!shipped || !Array.isArray(shipped)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO shipped_features
    (id, name, shipped_at, version, description, type, duration, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const feature of shipped) {
    stmt.run(
      toStr(feature.id) ?? `ship-${Date.now()}`,
      toStr(feature.name) ?? '',
      toStr(feature.shippedAt) ?? new Date().toISOString(),
      toStr(feature.version) ?? '0.0.0',
      toStr(feature.description),
      toStr(feature.type),
      toStr(feature.duration),
      JSON.stringify(feature)
    )
  }
}

function populateMetricsDaily(projectId: string, data: Record<string, unknown>): void {
  const dailyStats = data.dailyStats as Array<Record<string, unknown>> | undefined
  if (!dailyStats || !Array.isArray(dailyStats)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO metrics_daily
    (date, tokens_saved, syncs, avg_compression_rate, total_duration)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const day of dailyStats) {
    stmt.run(
      toStr(day.date) ?? new Date().toISOString().slice(0, 10),
      toNum(day.tokensSaved) ?? 0,
      toNum(day.syncs) ?? 0,
      toNum(day.avgCompressionRate) ?? 0,
      toNum(day.totalDuration) ?? 0
    )
  }
}

function populateAnalysis(projectId: string, data: Record<string, unknown>): void {
  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analysis
    (id, status, commit_hash, signature, sealed_at, analyzed_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const migrate = (analysis: Record<string, unknown>, id: string) => {
    if (!analysis) return
    stmt.run(
      id,
      toStr(analysis.status) ?? 'unknown',
      toStr(analysis.commitHash),
      toStr(analysis.signature),
      toStr(analysis.sealedAt),
      toStr(analysis.analyzedAt),
      JSON.stringify(analysis)
    )
  }

  if (data.draft) migrate(data.draft as Record<string, unknown>, 'draft')
  if (data.sealed) migrate(data.sealed as Record<string, unknown>, 'sealed')
}

export function populateIndexTables(projectId: string, key: string, data: unknown): void {
  if (key === 'categories-cache') {
    populateCategoriesIndex(projectId, data as Record<string, unknown>)
  }
}

function populateCategoriesIndex(projectId: string, cache: Record<string, unknown>): void {
  const fileCategories = cache.fileCategories as Array<Record<string, unknown>> | undefined
  if (!fileCategories || !Array.isArray(fileCategories)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO index_files
    (path, categories, domain, score, size, mtime, language)
    VALUES (?, ?, ?, COALESCE((SELECT score FROM index_files WHERE path = ?), 0), NULL, NULL, NULL)
  `)

  for (const fc of fileCategories) {
    const p = toStr(fc.path)
    if (!p) continue
    stmt.run(p, fc.categories ? JSON.stringify(fc.categories) : null, toStr(fc.primaryDomain), p)
  }
}
