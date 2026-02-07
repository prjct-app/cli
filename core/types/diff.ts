/**
 * Diff Types
 * Types for sync diff and preserved sections.
 */

export interface DiffSection {
  name: string
  type: 'added' | 'modified' | 'removed' | 'unchanged'
  before?: string
  after?: string
  lineCount: number
}

export interface PreservedInfo {
  name: string
  lineCount: number
}

export interface SyncDiff {
  hasChanges: boolean
  added: DiffSection[]
  modified: DiffSection[]
  removed: DiffSection[]
  preserved: PreservedInfo[]
  tokensBefore: number
  tokensAfter: number
  tokenDelta: number
}

export interface DiffOptions {
  showFullDiff?: boolean
  colorize?: boolean
}

/** Parsed markdown section (header + content range) */
export interface ParsedMarkdownSection {
  name: string
  content: string
  startLine: number
  endLine: number
}
