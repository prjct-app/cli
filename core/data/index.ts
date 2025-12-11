/**
 * Data Module
 *
 * MD-First Architecture: MD files are the source of truth.
 * JSON managers are deprecated in favor of MD managers.
 */

// Base (legacy JSON)
export { BaseManager, ArrayManager } from './base-manager'

// MD-First Base
export { MdBaseManager, MdArrayManager } from './md-base-manager'

// MD-First Managers (NEW - use these!)
export { mdStateManager } from './md-state-manager'
export { mdQueueManager } from './md-queue-manager'

// Legacy JSON Managers (deprecated - for backwards compatibility only)
export { stateManager, default as stateManagerDefault } from './state-manager'
export { projectManager, default as projectManagerDefault } from './project-manager'
export { agentsManager, default as agentsManagerDefault } from './agents-manager'
export { ideasManager, default as ideasManagerDefault } from './ideas-manager'
export { roadmapManager, default as roadmapManagerDefault } from './roadmap-manager'
export { shippedManager, default as shippedManagerDefault } from './shipped-manager'
export { analysisManager, default as analysisManagerDefault } from './analysis-manager'
export { outcomesManager, default as outcomesManagerDefault } from './outcomes-manager'

// MD-First managers (preferred)
export const mdManagers = {
  state: require('./md-state-manager').mdStateManager,
  queue: require('./md-queue-manager').mdQueueManager
}

// Legacy JSON managers (deprecated)
export const dataManagers = {
  state: require('./state-manager').stateManager,
  project: require('./project-manager').projectManager,
  agents: require('./agents-manager').agentsManager,
  ideas: require('./ideas-manager').ideasManager,
  roadmap: require('./roadmap-manager').roadmapManager,
  shipped: require('./shipped-manager').shippedManager,
  analysis: require('./analysis-manager').analysisManager,
  outcomes: require('./outcomes-manager').outcomesManager
}

export default mdManagers
