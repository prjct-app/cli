/**
 * Data Module
 *
 * JSON file managers for all project data types.
 */

// Base
export { BaseManager, ArrayManager } from './base-manager'

// Managers
export { stateManager, default as stateManagerDefault } from './state-manager'
export { projectManager, default as projectManagerDefault } from './project-manager'
export { agentsManager, default as agentsManagerDefault } from './agents-manager'
export { ideasManager, default as ideasManagerDefault } from './ideas-manager'
export { roadmapManager, default as roadmapManagerDefault } from './roadmap-manager'
export { shippedManager, default as shippedManagerDefault } from './shipped-manager'
export { analysisManager, default as analysisManagerDefault } from './analysis-manager'
export { outcomesManager, default as outcomesManagerDefault } from './outcomes-manager'

// Convenience object with all managers
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

export default dataManagers
