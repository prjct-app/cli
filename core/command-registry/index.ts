/**
 * Command Registry - Single Source of Truth
 *
 * All prjct commands are defined here with metadata.
 * This registry is used by:
 * - bin/prjct (terminal CLI)
 * - website/Commands.tsx (documentation site)
 * - CLAUDE.md (AI assistant instructions)
 * - scripts/validate-commands.js (validation)
 *
 * @version 0.9.0 - Simplified commands with pause/resume and intelligent idea development
 */

export { default } from './command-registry'
export type { Command, CategoryInfo, Categories, RegistryStats, ValidationResult } from './types'
export { COMMANDS } from './commands'
export { CATEGORIES } from './categories'
