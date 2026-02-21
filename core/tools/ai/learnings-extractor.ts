/**
 * Learnings Extractor
 *
 * Extracts learnings from SQLite database to inject into AI tool context.
 * Provides progressive context that improves as the project evolves.
 */

import { prjctDb } from '../../storage/database'
import type { ProjectLearnings } from '../../types/context-tools'

/**
 * Extrae learnings desde SQLite
 */
export async function extractLearningsFromDB(projectId: string): Promise<ProjectLearnings> {
  try {
    const db = prjctDb.getDb(projectId)

    // Query tareas completadas (últimas 10)
    const tasks = db
      .prepare(`
      SELECT description, completed_at, branch
      FROM tasks
      WHERE status = 'done' OR status = 'shipped'
      ORDER BY completed_at DESC
      LIMIT 10
    `)
      .all() as Array<{
      description: string
      completed_at: string | null
      branch: string | null
    }>

    // Query bugs resueltos (últimos 5)
    // Asumiendo que hay tareas tipo 'bug' o descripción incluye 'fix', 'bug'
    const bugs = db
      .prepare(`
      SELECT description, completed_at as resolution
      FROM tasks
      WHERE (type = 'bug' OR description LIKE '%fix%' OR description LIKE '%bug%')
      AND (status = 'done' OR status = 'shipped')
      ORDER BY completed_at DESC
      LIMIT 5
    `)
      .all() as Array<{
      description: string
      resolution: string | null
    }>

    // Query features shipped
    const features = db
      .prepare(`
      SELECT name, description, version
      FROM shipped_features
      ORDER BY shipped_at DESC
      LIMIT 5
    `)
      .all() as Array<{
      name: string
      description: string | null
      version: string
    }>

    return {
      completedTasks: tasks.map((t) => ({
        description: t.description,
        completedAt: t.completed_at || 'unknown',
        branch: t.branch,
      })),
      resolvedBugs: bugs.map((b) => ({
        description: b.description,
        resolution: b.resolution || 'completed',
      })),
      shippedFeatures: features.map((f) => ({
        name: f.name,
        description: f.description || '',
        version: f.version,
      })),
      patterns: [], // TODO: extraer de analysis
    }
  } catch (_error) {
    // Si la base de datos no existe o hay error, retornar vacío
    return {
      completedTasks: [],
      resolvedBugs: [],
      shippedFeatures: [],
      patterns: [],
    }
  }
}
