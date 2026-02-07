/**
 * Stack Detection Types
 * Types for project technology stack detection.
 */

export interface StackDetection {
  hasFrontend: boolean
  hasBackend: boolean
  hasDatabase: boolean
  hasDocker: boolean
  hasTesting: boolean
  frontendType: 'web' | 'mobile' | 'both' | null
  frameworks: string[]
}

export interface StackPackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
