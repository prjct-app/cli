/**
 * Analyze Command Verifier
 * Verify analysis can proceed
 */

import fs from 'fs/promises'
import path from 'path'
import type { Context, VerificationResult } from '../types'

export async function verifyAnalyze(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if project has recognizable structure
  const files = ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Gemfile', 'pom.xml']
  actual.detectedFiles = []

  for (const file of files) {
    try {
      await fs.access(path.join(context.projectPath, file))
      ;(actual.detectedFiles as string[]).push(file)
    } catch {
      // File doesn't exist
    }
  }

  if ((actual.detectedFiles as string[]).length === 0) {
    warnings.push('No recognizable project files detected')
    recommendations.push('Analysis may be limited without package.json or similar')
  }

  // 2. Check for source directories
  const srcDirs = ['src', 'lib', 'app', 'core', 'components']
  actual.detectedSrcDirs = []

  for (const dir of srcDirs) {
    try {
      const stat = await fs.stat(path.join(context.projectPath, dir))
      if (stat.isDirectory()) {
        ;(actual.detectedSrcDirs as string[]).push(dir)
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return {
    verified: true, // Analysis can always proceed, even with warnings
    actual,
    warnings,
    recommendations,
  }
}
