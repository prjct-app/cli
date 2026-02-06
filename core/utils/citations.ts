/**
 * Citation utilities for context source tracking
 *
 * Generates HTML comments indicating where each section's data came from.
 * Source types: detected (from files), user-defined (from config), inferred (from heuristics)
 *
 * @see PRJ-113
 */

export type SourceType = 'detected' | 'user-defined' | 'inferred'

export interface SourceInfo {
  file: string
  type: SourceType
}

export interface ContextSources {
  name: SourceInfo
  version: SourceInfo
  ecosystem: SourceInfo
  languages: SourceInfo
  frameworks: SourceInfo
  commands: SourceInfo
  projectType: SourceInfo
  git: SourceInfo
}

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
