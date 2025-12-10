/**
 * Done Command Verifier
 * Verify task is actually complete-able
 */

import fs from 'fs/promises'
import path from 'path'
import type { Context, VerificationResult } from '../types'
import { formatDuration } from '../utils'

export async function verifyDone(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Verify now.md exists and has real content
  const nowPath = context.paths.now
  try {
    const nowContent = await fs.readFile(nowPath, 'utf-8')
    actual.nowExists = true
    actual.nowContent = nowContent.trim()
    actual.nowLength = nowContent.length

    // Check for placeholder content
    if (nowContent.includes('No current task') || nowContent.match(/^#\s*NOW\s*$/m)) {
      warnings.push('now.md appears to be empty or placeholder')
      recommendations.push('Start a task first with /p:now "task"')
    }

    // Check for task metadata (started time)
    const startedMatch = nowContent.match(/Started:\s*(.+)/i)
    if (startedMatch) {
      actual.startedAt = startedMatch[1]
      // Calculate duration
      const startTime = new Date(startedMatch[1])
      if (!isNaN(startTime.getTime())) {
        actual.durationMs = Date.now() - startTime.getTime()
        actual.durationFormatted = formatDuration(actual.durationMs as number)
      }
    }
  } catch {
    actual.nowExists = false
    warnings.push('now.md does not exist')
    recommendations.push('Create a task with /p:now "task"')
  }

  // 2. Verify next.md for auto-start
  const nextPath = context.paths.next
  try {
    const nextContent = await fs.readFile(nextPath, 'utf-8')
    actual.nextExists = true
    const tasks = nextContent.match(/- \[ \]/g) || []
    actual.pendingTasks = tasks.length
  } catch {
    actual.nextExists = false
    actual.pendingTasks = 0
  }

  // 3. Verify metrics.md is writable
  const metricsPath = context.paths.metrics
  try {
    await fs.access(path.dirname(metricsPath), fs.constants.W_OK)
    actual.metricsWritable = true
  } catch {
    actual.metricsWritable = false
    warnings.push('Cannot write to metrics directory')
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
