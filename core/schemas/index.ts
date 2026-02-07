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

// Agents
export * from './agents'
// Analysis
export * from './analysis'
// Classification (LLM-based domain detection)
export * from './classification'
// Ideas
export * from './ideas'
// Issues (local cache of issue tracker issues)
export * from './issues'
// LLM output schemas (structured response validation)
export * from './llm-output'
// Model specification (AI provider model tracking)
export * from './model'
// Outcomes
export * from './outcomes'
// Permissions
export * from './permissions'
// Project metadata
export * from './project'
// Roadmap (features)
export * from './roadmap'
// Utilities (ID generators and path helpers)
export {
  GLOBAL_STORAGE,
  generateFeatureId,
  generateIdeaId,
  generateSessionId,
  generateShipId,
  generateTaskId,
  generateUUID,
  getProjectPath,
} from './schemas'
// Shipped items
export * from './shipped'
// State (current task + queue)
export * from './state'
