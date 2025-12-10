/**
 * State Module
 *
 * Unified project state management.
 * Single source of truth replacing scattered file reads.
 *
 * @example
 * ```typescript
 * import stateManager from './state'
 *
 * // Read state
 * const state = await stateManager.read(projectId)
 *
 * // Update state
 * await stateManager.startTask(projectId, { id: 'task_1', description: 'auth' })
 * await stateManager.completeTask(projectId, '2h 15m')
 * ```
 */

import stateManager from './manager'

export { StateManager } from './manager'
export { stateManager }
export default stateManager
export * from './types'
