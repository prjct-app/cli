/**
 * Task Stack Parser
 * Parsing utilities for now.md files
 */

import type { ParsedNowFile } from './types'

/**
 * Parse legacy now.md format
 */
export function parseNowFile(content: string): ParsedNowFile {
  const result: ParsedNowFile = {
    description: '',
    started: null,
    agent: null,
    complexity: null,
    dev: null,
  }

  // Check for frontmatter
  if (content.startsWith('---')) {
    const frontmatterEnd = content.indexOf('---', 3)
    if (frontmatterEnd > 0) {
      const frontmatter = content.substring(3, frontmatterEnd)
      const lines = frontmatter.split('\n')

      for (const line of lines) {
        if (line.includes('task:')) {
          result.description = line.split('task:')[1].trim().replace(/['"]/g, '')
        }
        if (line.includes('started:')) {
          result.started = line.split('started:')[1].trim()
        }
        if (line.includes('agent:')) {
          result.agent = line.split('agent:')[1].trim()
        }
        if (line.includes('complexity:')) {
          result.complexity = line.split('complexity:')[1].trim()
        }
        if (line.includes('dev:')) {
          result.dev = line.split('dev:')[1].trim()
        }
      }

      // Get description from content if not in frontmatter
      if (!result.description) {
        const contentBody = content.substring(frontmatterEnd + 3).trim()
        const firstLine = contentBody.split('\n')[0]
        if (firstLine && !firstLine.startsWith('#')) {
          result.description = firstLine.replace(/^[*-]\s*/, '').trim()
        }
      }
    }
  } else {
    // No frontmatter, try to extract task from content
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
        result.description = line.replace(/^[*-]\s*/, '').trim()
        break
      }
    }
  }

  return result
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return `${seconds}s`
  }
}
