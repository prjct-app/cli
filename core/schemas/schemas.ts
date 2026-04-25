/**
 * Schemas Utilities — UUID generator (the only externally used helper).
 */

import crypto from 'node:crypto'

/**
 * Generate a standard UUID.
 * All IDs in the system use this format for PostgreSQL consistency.
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}
