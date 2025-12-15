/**
 * Data Module
 *
 * MD-First Architecture: MD files are the source of truth.
 */

// MD managers
import { mdStateManager } from './md-state-manager'
import { mdQueueManager } from './md-queue-manager'
import { mdShippedManager } from './md-shipped-manager'
import { mdIdeasManager } from './md-ideas-manager'

// Base classes
export { MdBaseManager, MdArrayManager } from './md-base-manager'

// MD managers
export { mdStateManager, mdQueueManager, mdShippedManager, mdIdeasManager }

// MD managers object
export const mdManagers = {
  state: mdStateManager,
  queue: mdQueueManager,
  shipped: mdShippedManager,
  ideas: mdIdeasManager
}

export default mdManagers
