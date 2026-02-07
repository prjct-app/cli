/**
 * Citation Types
 * Types for context source tracking.
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
