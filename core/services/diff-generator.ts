/**
 * Diff Generator for Sync Preview
 *
 * Generates human-readable diffs between old and new context files.
 * Shows what will change before sync applies.
 *
 * @see PRJ-125
 * @module services/diff-generator
 */

import chalk from 'chalk'

// =============================================================================
// Types
// =============================================================================

export interface DiffSection {
  name: string
  type: 'added' | 'modified' | 'removed' | 'unchanged'
  before?: string
  after?: string
  lineCount: number
}

export interface PreservedInfo {
  name: string
  lineCount: number
}

export interface SyncDiff {
  hasChanges: boolean
  added: DiffSection[]
  modified: DiffSection[]
  removed: DiffSection[]
  preserved: PreservedInfo[]
  tokensBefore: number
  tokensAfter: number
  tokenDelta: number
}

export interface DiffOptions {
  showFullDiff?: boolean
  colorize?: boolean
}

// =============================================================================
// Constants
// =============================================================================

const CHARS_PER_TOKEN = 4

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for content
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN)
}

// =============================================================================
// Section Parsing
// =============================================================================

interface ParsedSection {
  name: string
  content: string
  startLine: number
  endLine: number
}

/**
 * Parse markdown into sections based on headers
 */
export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split('\n')
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/)

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endLine = i - 1
        sections.push(currentSection)
      }

      // Start new section
      currentSection = {
        name: headerMatch[2].trim(),
        content: line,
        startLine: i,
        endLine: i,
      }
    } else if (currentSection) {
      currentSection.content += `\n${line}`
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1
    sections.push(currentSection)
  }

  return sections
}

/**
 * Check if content is within a preserve block
 */
function isPreservedSection(content: string): boolean {
  return content.includes('<!-- prjct:preserve')
}

// =============================================================================
// Diff Generation
// =============================================================================

/**
 * Generate diff between old and new content
 */
export function generateSyncDiff(oldContent: string, newContent: string): SyncDiff {
  const oldSections = parseMarkdownSections(oldContent)
  const newSections = parseMarkdownSections(newContent)

  const diff: SyncDiff = {
    hasChanges: false,
    added: [],
    modified: [],
    removed: [],
    preserved: [],
    tokensBefore: estimateTokens(oldContent),
    tokensAfter: estimateTokens(newContent),
    tokenDelta: 0,
  }

  diff.tokenDelta = diff.tokensAfter - diff.tokensBefore

  // Create maps for quick lookup
  const oldMap = new Map(oldSections.map((s) => [s.name.toLowerCase(), s]))
  const newMap = new Map(newSections.map((s) => [s.name.toLowerCase(), s]))

  // Find preserved sections in old content
  for (const section of oldSections) {
    if (isPreservedSection(section.content)) {
      diff.preserved.push({
        name: section.name,
        lineCount: section.content.split('\n').length,
      })
    }
  }

  // Find added and modified sections
  for (const newSection of newSections) {
    const key = newSection.name.toLowerCase()
    const oldSection = oldMap.get(key)

    if (!oldSection) {
      // New section
      diff.added.push({
        name: newSection.name,
        type: 'added',
        after: newSection.content,
        lineCount: newSection.content.split('\n').length,
      })
      diff.hasChanges = true
    } else if (oldSection.content.trim() !== newSection.content.trim()) {
      // Modified section (skip if preserved)
      if (!isPreservedSection(oldSection.content)) {
        diff.modified.push({
          name: newSection.name,
          type: 'modified',
          before: oldSection.content,
          after: newSection.content,
          lineCount: newSection.content.split('\n').length,
        })
        diff.hasChanges = true
      }
    }
  }

  // Find removed sections
  for (const oldSection of oldSections) {
    const key = oldSection.name.toLowerCase()
    if (!newMap.has(key) && !isPreservedSection(oldSection.content)) {
      diff.removed.push({
        name: oldSection.name,
        type: 'removed',
        before: oldSection.content,
        lineCount: oldSection.content.split('\n').length,
      })
      diff.hasChanges = true
    }
  }

  return diff
}

// =============================================================================
// Diff Formatting
// =============================================================================

/**
 * Format diff for terminal display
 */
export function formatDiffPreview(diff: SyncDiff, options: DiffOptions = {}): string {
  const { colorize = true } = options
  const lines: string[] = []

  const green = colorize ? chalk.green : (s: string) => s
  const red = colorize ? chalk.red : (s: string) => s
  const yellow = colorize ? chalk.yellow : (s: string) => s
  const dim = colorize ? chalk.dim : (s: string) => s
  const bold = colorize ? chalk.bold : (s: string) => s

  if (!diff.hasChanges) {
    lines.push(dim('No changes detected (context is up to date)'))
    return lines.join('\n')
  }

  lines.push('')
  lines.push(bold('📋 Changes to context files:'))
  lines.push('')

  // Added sections
  if (diff.added.length > 0) {
    for (const section of diff.added) {
      lines.push(green(`+ │ + ${section.name} (new)`))
    }
  }

  // Modified sections
  if (diff.modified.length > 0) {
    for (const section of diff.modified) {
      lines.push(yellow(`~ │   ${section.name} (modified)`))
    }
  }

  // Removed sections
  if (diff.removed.length > 0) {
    for (const section of diff.removed) {
      lines.push(red(`- │ - ${section.name} (removed)`))
    }
  }

  // Preserved sections
  if (diff.preserved.length > 0) {
    lines.push('')
    lines.push(dim('  ## Your Customizations'))
    for (const section of diff.preserved) {
      lines.push(dim(`  │ ✓ ${section.name} (${section.lineCount} lines preserved)`))
    }
  }

  // Summary
  lines.push('')
  lines.push(dim('────────────────────────────────'))

  const summaryParts: string[] = []
  if (diff.added.length > 0) summaryParts.push(green(`+${diff.added.length} added`))
  if (diff.modified.length > 0) summaryParts.push(yellow(`~${diff.modified.length} modified`))
  if (diff.removed.length > 0) summaryParts.push(red(`-${diff.removed.length} removed`))

  lines.push(`Summary: ${summaryParts.join(', ') || 'no changes'}`)

  // Token delta
  const tokenSign = diff.tokenDelta >= 0 ? '+' : ''
  const tokenColor = diff.tokenDelta >= 0 ? green : red
  lines.push(
    `Tokens: ${diff.tokensBefore.toLocaleString()} → ${diff.tokensAfter.toLocaleString()} (${tokenColor(tokenSign + diff.tokenDelta.toLocaleString())})`
  )

  lines.push('')

  return lines.join('\n')
}

/**
 * Format full git-style diff
 */
export function formatFullDiff(diff: SyncDiff, options: DiffOptions = {}): string {
  const { colorize = true } = options
  const lines: string[] = []

  const green = colorize ? chalk.green : (s: string) => s
  const red = colorize ? chalk.red : (s: string) => s
  const cyan = colorize ? chalk.cyan : (s: string) => s
  const dim = colorize ? chalk.dim : (s: string) => s

  // Added sections
  for (const section of diff.added) {
    lines.push(cyan(`@@ +${section.name} @@`))
    if (section.after) {
      for (const line of section.after.split('\n')) {
        lines.push(green(`+ ${line}`))
      }
    }
    lines.push('')
  }

  // Modified sections
  for (const section of diff.modified) {
    lines.push(cyan(`@@ ${section.name} @@`))
    if (section.before) {
      for (const line of section.before.split('\n').slice(0, 5)) {
        lines.push(red(`- ${line}`))
      }
      if (section.before.split('\n').length > 5) {
        lines.push(dim(`  ... ${section.before.split('\n').length - 5} more lines`))
      }
    }
    if (section.after) {
      for (const line of section.after.split('\n').slice(0, 5)) {
        lines.push(green(`+ ${line}`))
      }
      if (section.after.split('\n').length > 5) {
        lines.push(dim(`  ... ${section.after.split('\n').length - 5} more lines`))
      }
    }
    lines.push('')
  }

  // Removed sections
  for (const section of diff.removed) {
    lines.push(cyan(`@@ -${section.name} @@`))
    if (section.before) {
      for (const line of section.before.split('\n').slice(0, 5)) {
        lines.push(red(`- ${line}`))
      }
      if (section.before.split('\n').length > 5) {
        lines.push(dim(`  ... ${section.before.split('\n').length - 5} more lines`))
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// =============================================================================
// Exports
// =============================================================================

export default {
  generateSyncDiff,
  formatDiffPreview,
  formatFullDiff,
  estimateTokens,
  parseMarkdownSections,
}
