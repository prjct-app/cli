/**
 * Sync Command Verifier
 * Verify sync can proceed
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { Context, VerificationResult } from '../types'

export async function verifySync(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if project is initialized
  const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
  try {
    const configContent = await fs.readFile(configPath, 'utf-8')
    actual.hasConfig = true
    actual.config = JSON.parse(configContent)
  } catch {
    actual.hasConfig = false
    warnings.push('Project not initialized')
    recommendations.push('Run /p:init first')
    return { verified: false, actual, warnings, recommendations }
  }

  // 2. Check if global storage exists
  const projectId = (actual.config as { projectId?: string })?.projectId
  const globalProjectPath = path.join(os.homedir(), '.prjct-cli/projects', projectId || '')
  try {
    await fs.access(globalProjectPath)
    actual.globalStorageExists = true
  } catch {
    actual.globalStorageExists = false
    warnings.push('Global storage missing')
    recommendations.push('Run /p:init to recreate')
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
