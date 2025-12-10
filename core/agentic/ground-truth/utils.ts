/**
 * Ground Truth Utilities
 */

import type { VerificationResult } from './types'

/**
 * Format duration from milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Format verification warnings for display
 */
export function formatWarnings(result: VerificationResult): string | null {
  if (result.verified || result.warnings.length === 0) {
    return null
  }

  let output = '⚠️  Ground Truth Warnings:\n'
  result.warnings.forEach((w) => {
    output += `  • ${w}\n`
  })

  if (result.recommendations.length > 0) {
    output += '\nRecommendations:\n'
    result.recommendations.forEach((r) => {
      output += `  → ${r}\n`
    })
  }

  return output
}
