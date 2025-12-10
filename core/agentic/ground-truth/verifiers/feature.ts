/**
 * Feature Command Verifier
 * Verify feature can be added
 */

import fs from 'fs/promises'
import type { Context, VerificationResult } from '../types'
import { escapeRegex } from '../utils'

export async function verifyFeature(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check next.md capacity
  const nextPath = context.paths.next
  try {
    const nextContent = await fs.readFile(nextPath, 'utf-8')
    actual.nextExists = true
    const tasks = nextContent.match(/- \[[ x]\]/g) || []
    actual.taskCount = tasks.length
    actual.pendingTasks = (nextContent.match(/- \[ \]/g) || []).length

    if ((actual.taskCount as number) >= 90) {
      warnings.push(`Queue nearly full (${actual.taskCount}/100 tasks)`)
      recommendations.push('Complete some tasks before adding more')
    }
  } catch {
    actual.nextExists = false
    actual.taskCount = 0
  }

  // 2. Check roadmap.md for duplicate features
  const roadmapPath = context.paths.roadmap
  try {
    const roadmapContent = await fs.readFile(roadmapPath, 'utf-8')
    actual.roadmapExists = true

    const featureName = context.params.description || context.params.feature
    if (featureName) {
      const featurePattern = new RegExp(escapeRegex(featureName), 'i')
      if (featurePattern.test(roadmapContent)) {
        warnings.push(`Feature "${featureName}" may already exist in roadmap`)
        recommendations.push('Check roadmap for duplicates with /p:roadmap')
      }
    }
  } catch {
    actual.roadmapExists = false
  }

  // 3. Check if there's an active task (should complete first?)
  const nowPath = context.paths.now
  try {
    const nowContent = await fs.readFile(nowPath, 'utf-8')
    actual.hasActiveTask = nowContent.trim().length > 0 && !nowContent.includes('No current task')

    if (actual.hasActiveTask) {
      recommendations.push('Consider completing current task first with /p:done')
    }
  } catch {
    actual.hasActiveTask = false
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
