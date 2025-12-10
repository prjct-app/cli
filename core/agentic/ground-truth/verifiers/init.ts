/**
 * Init Command Verifier
 * Verify project can be initialized
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { Context, VerificationResult } from '../types'

export async function verifyInit(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if already initialized
  const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
  try {
    const configContent = await fs.readFile(configPath, 'utf-8')
    actual.alreadyInitialized = true
    actual.existingConfig = JSON.parse(configContent)
    warnings.push('Project already initialized')
    recommendations.push('Use /p:analyze to refresh analysis or delete .prjct/ to reinitialize')
  } catch {
    actual.alreadyInitialized = false
  }

  // 2. Check if global storage path is writable
  const globalPath = path.join(os.homedir(), '.prjct-cli')
  try {
    await fs.access(globalPath, fs.constants.W_OK)
    actual.globalPathWritable = true
  } catch {
    try {
      // Try to create it
      await fs.mkdir(globalPath, { recursive: true })
      actual.globalPathWritable = true
      actual.globalPathCreated = true
    } catch {
      actual.globalPathWritable = false
      warnings.push('Cannot write to ~/.prjct-cli')
      recommendations.push('Check directory permissions')
    }
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
