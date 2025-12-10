/**
 * Command Registry
 * Re-exports from command-registry/index.ts for backwards compatibility.
 */

import registry from './command-registry/index'
export default registry
export type { Command, CategoryInfo, Categories, RegistryStats, ValidationResult } from './command-registry/index'
export { COMMANDS, CATEGORIES } from './command-registry/index'
