/**
 * Analysis Schema
 *
 * Defines the structure for analysis.json - repository analysis.
 */

export interface CodePattern {
  name: string
  description: string
  location?: string
}

export interface AntiPattern {
  issue: string
  file: string
  suggestion: string
}

export interface AnalysisSchema {
  projectId: string
  languages: string[]
  frameworks: string[]
  packageManager?: string
  sourceDir?: string
  testDir?: string
  configFiles: string[]
  fileCount: number
  patterns: CodePattern[]
  antiPatterns: AntiPattern[]
  analyzedAt: string // ISO8601
}

export const DEFAULT_ANALYSIS: Omit<AnalysisSchema, 'projectId'> = {
  languages: [],
  frameworks: [],
  configFiles: [],
  fileCount: 0,
  patterns: [],
  antiPatterns: [],
  analyzedAt: new Date().toISOString(),
}
