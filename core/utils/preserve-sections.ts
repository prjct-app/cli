/**
 * Preserve Sections Utility
 *
 * Extracts and preserves user-customized sections during file regeneration.
 * Users can mark sections with preserve markers to survive sync.
 *
 * Usage in CLAUDE.md or other context files:
 * ```markdown
 * <!-- prjct:preserve -->
 * # My Custom Rules
 * - Always use tabs
 * - Prefer functional patterns
 * <!-- /prjct:preserve -->
 * ```
 *
 * @see PRJ-115
 * @module utils/preserve-sections
 */

import type { PreservedSection } from '../types/utils.js'

// Markers for preserved sections
const PRESERVE_START = '<!-- prjct:preserve -->'
const PRESERVE_END = '<!-- /prjct:preserve -->'
const PRESERVE_END_PATTERN = '<!-- /prjct:preserve -->'

// Named section markers (optional identifier) - create fresh regex each time
// Uses [\w-]+ to allow hyphens in section names (e.g., "custom-rules")
function createPreserveStartRegex(): RegExp {
  return /<!-- prjct:preserve(?::([\w-]+))? -->/g
}

/**
 * Extract all preserved sections from content
 */
export function extractPreservedSections(content: string): PreservedSection[] {
  const sections: PreservedSection[] = []
  const regex = createPreserveStartRegex()

  let match: RegExpExecArray | null
  let sectionIndex = 0

  while ((match = regex.exec(content)) !== null) {
    const startIndex = match.index
    const startTag = match[0]
    const sectionId = match[1] || `section-${sectionIndex++}`

    // Find the closing tag
    const endTagStart = content.indexOf(PRESERVE_END_PATTERN, startIndex + startTag.length)

    if (endTagStart === -1) {
      // No closing tag found - skip this section
      continue
    }

    const endIndex = endTagStart + PRESERVE_END_PATTERN.length

    // Extract the content between markers (including markers)
    const fullContent = content.substring(startIndex, endIndex)

    sections.push({
      id: sectionId,
      content: fullContent,
      startIndex,
      endIndex,
    })
  }

  return sections
}

/**
 * Extract the inner content of preserved sections (without markers)
 */
export function extractPreservedContent(content: string): string[] {
  const sections = extractPreservedSections(content)

  return sections.map((section) => {
    // Remove the markers to get just the inner content
    let inner = section.content
    inner = inner.replace(createPreserveStartRegex(), '').replace(PRESERVE_END_PATTERN, '')
    return inner.trim()
  })
}

/**
 * Check if content has any preserved sections
 */
export function hasPreservedSections(content: string): boolean {
  return content.includes(PRESERVE_START) || createPreserveStartRegex().test(content)
}

/**
 * Merge preserved sections from old content into new content
 *
 * Strategy:
 * 1. Extract preserved sections from old content
 * 2. Append them to the end of new content
 * 3. Ensure proper spacing
 *
 * @param newContent - Freshly generated content
 * @param oldContent - Previous content with user customizations
 * @returns Merged content with preserved sections
 */
export function mergePreservedSections(newContent: string, oldContent: string): string {
  const preservedSections = extractPreservedSections(oldContent)

  if (preservedSections.length === 0) {
    return newContent
  }

  // Build the merged content
  let merged = newContent.trimEnd()

  // Add separator before preserved sections
  merged += '\n\n---\n\n'
  merged += '## Your Customizations\n\n'
  merged += '_The sections below are preserved during sync. Edit freely._\n\n'

  // Append each preserved section
  for (const section of preservedSections) {
    merged += section.content
    merged += '\n\n'
  }

  return `${merged.trimEnd()}\n`
}

/**
 * Create an empty preserve block for users to customize
 */
export function createEmptyPreserveBlock(title?: string): string {
  const header = title ? `\n# ${title}\n` : '\n'
  return `${PRESERVE_START}${header}<!-- Add your custom instructions here -->\n${PRESERVE_END}`
}

/**
 * Wrap content in preserve markers
 */
export function wrapInPreserveMarkers(content: string, id?: string): string {
  const startTag = id ? `<!-- prjct:preserve:${id} -->` : PRESERVE_START
  return `${startTag}\n${content}\n${PRESERVE_END}`
}

/**
 * Remove all preserved sections from content
 * (Useful for getting the auto-generated portion only)
 */
export function stripPreservedSections(content: string): string {
  const sections = extractPreservedSections(content)

  if (sections.length === 0) {
    return content
  }

  // Remove sections in reverse order to preserve indices
  let result = content
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i]
    result = result.substring(0, section.startIndex) + result.substring(section.endIndex)
  }

  // Clean up any resulting double newlines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Validate that all preserve blocks are properly closed
 */
export function validatePreserveBlocks(content: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const startMatches = content.match(/<!-- prjct:preserve(?::\w+)? -->/g) || []
  const endMatches = content.match(/<!-- \/prjct:preserve -->/g) || []

  if (startMatches.length !== endMatches.length) {
    errors.push(
      `Mismatched preserve markers: ${startMatches.length} opening, ${endMatches.length} closing`
    )
  }

  // Check for nested blocks (not supported)
  let depth = 0
  let maxDepth = 0
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/<!-- prjct:preserve(?::\w+)? -->/.test(line)) {
      depth++
      maxDepth = Math.max(maxDepth, depth)
    }
    if (line.includes(PRESERVE_END_PATTERN)) {
      depth--
    }
    if (depth > 1) {
      errors.push(`Nested preserve blocks detected at line ${i + 1} (not supported)`)
    }
    if (depth < 0) {
      errors.push(`Unexpected closing marker at line ${i + 1}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
