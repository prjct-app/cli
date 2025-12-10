/**
 * Now Command Verifier
 * Verify task can be set (anti-hallucination: warn if replacing)
 */

import fs from 'fs/promises'
import type { Context, VerificationResult } from '../types'

export async function verifyNow(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if there's already an active task
  const nowPath = context.paths.now
  try {
    const nowContent = await fs.readFile(nowPath, 'utf-8')
    actual.nowExists = true
    actual.nowContent = nowContent.trim()

    const hasRealTask =
      nowContent.trim().length > 0 && !nowContent.includes('No current task') && !nowContent.match(/^#\s*NOW\s*$/m)

    actual.hasActiveTask = hasRealTask

    // ANTI-HALLUCINATION: Warn if replacing existing task
    if (hasRealTask && context.params.task) {
      const taskPreview = nowContent.substring(0, 50).replace(/\n/g, ' ')
      warnings.push(`Replacing existing task: "${taskPreview}..."`)
      recommendations.push('Use /p:done first to track completion')
    }
  } catch {
    actual.nowExists = false
    actual.hasActiveTask = false
  }

  // 2. Check next.md for available tasks
  const nextPath = context.paths.next
  try {
    const nextContent = await fs.readFile(nextPath, 'utf-8')
    const pendingTasks = (nextContent.match(/- \[ \]/g) || []).length
    actual.pendingTasks = pendingTasks

    if (!context.params.task && pendingTasks > 0) {
      recommendations.push(`${pendingTasks} tasks available in queue`)
    }
  } catch {
    actual.pendingTasks = 0
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
