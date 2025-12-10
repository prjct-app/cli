/**
 * Agentic Commands Handler for prjct CLI
 *
 * Re-exports from modular commands/ directory.
 * See commands/index.ts for implementation.
 */

import instance, { PrjctCommands } from './commands/index'

export default instance
export { PrjctCommands }
