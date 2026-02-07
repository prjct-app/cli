/**
 * Citation utilities for context source tracking
 *
 * Generates HTML comments indicating where each section's data came from.
 * Source types: detected (from files), user-defined (from config), inferred (from heuristics)
 *
 * @see PRJ-113
 */

import type { ContextSources, SourceInfo } from '../types/citations'

export type { ContextSources, SourceInfo, SourceType } from '../types/citations'

/**
 * Generate an HTML citation comment
 *
 * @example cite({ file: 'package.json', type: 'detected' })
 * // => '<!-- source: package.json, detected -->'
 */
export function cite(source: SourceInfo): string {
  return `<!-- source: ${source.file}, ${source.type} -->`
}

/**
 * Create default sources (all unknown) - used as fallback
 */
export function defaultSources(): ContextSources {
  const unknown: SourceInfo = { file: 'unknown', type: 'detected' }
  return {
    name: { ...unknown },
    version: { ...unknown },
    ecosystem: { ...unknown },
    languages: { ...unknown },
    frameworks: { ...unknown },
    commands: { ...unknown },
    projectType: { ...unknown },
    git: { file: 'git', type: 'detected' },
  }
}
