/**
 * Schemas Module
 *
 * TypeScript types and defaults for all project data.
 * MD-First Architecture: Markdown files are the source of truth.
 *
 * Structure: ~/.prjct-cli/projects/{projectId}/
 *   - core/     (now.md, next.md, context.md)
 *   - progress/ (shipped.md, metrics.md)
 *   - planning/ (ideas.md, roadmap.md, tasks/)
 *   - analysis/ (repo-summary.md)
 *   - memory/   (context.jsonl, patterns.json)
 */

// State (current task + queue)
export * from './state'

// Project metadata
export * from './project'

// Agents
export * from './agents'

// Ideas
export * from './ideas'

// Roadmap (features)
export * from './roadmap'

// Shipped items
export * from './shipped'

// Analysis
export * from './analysis'

// Outcomes
export * from './outcomes'

// Utilities (ID generators and path helpers)
export {
  generateUUID,
  generateTaskId,
  generateFeatureId,
  generateIdeaId,
  generateShipId,
  generateSessionId,
  GLOBAL_STORAGE,
  getProjectPath
} from './schemas'
