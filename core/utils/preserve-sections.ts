/**
 * Preserve Sections Utility
 *
 * Extracts and merges user-preserved sections in generated markdown files.
 * Allows users to add custom content that survives regeneration.
 *
 * Usage:
 *   <!-- prjct:preserve -->
 *   ## My Custom Rules
 *   - Custom rule 1
 *   - Custom rule 2
 *   <!-- prjct:end-preserve -->
 */

import fs from 'fs/promises'

const PRESERVE_START = '<!-- prjct:preserve -->'
const PRESERVE_END = '<!-- prjct:end-preserve -->'

export interface PreservedSection {
  content: string
  startIndex: number
  endIndex: number
}

/**
 * Extract all preserved sections from content
 */
export function extractPreservedSections(content: string): PreservedSection[] {
  const sections: PreservedSection[] = []
  let searchIndex = 0

  while (searchIndex < content.length) {
    const startIndex = content.indexOf(PRESERVE_START, searchIndex)
    if (startIndex === -1) break

    const endIndex = content.indexOf(PRESERVE_END, startIndex)
    if (endIndex === -1) {
      // Unclosed preserve section - include everything after start marker
      sections.push({
        content: content.slice(startIndex),
        startIndex,
        endIndex: content.length,
      })
      break
    }

    // Include both markers in the preserved content
    sections.push({
      content: content.slice(startIndex, endIndex + PRESERVE_END.length),
      startIndex,
      endIndex: endIndex + PRESERVE_END.length,
    })

    searchIndex = endIndex + PRESERVE_END.length
  }

  return sections
}

/**
 * Read existing file and extract preserved sections
 * Returns empty array if file doesn't exist
 */
export async function readPreservedSections(filePath: string): Promise<PreservedSection[]> {
  try {
    const existingContent = await fs.readFile(filePath, 'utf-8')
    return extractPreservedSections(existingContent)
  } catch {
    // File doesn't exist or can't be read - no preserved sections
    return []
  }
}

/**
 * Merge preserved sections into new content
 * Appends preserved sections at the end with a separator
 */
export function mergePreservedSections(
  newContent: string,
  preservedSections: PreservedSection[]
): string {
  if (preservedSections.length === 0) {
    return newContent
  }

  // Check if new content already has preserved sections (avoid duplicates)
  const existingInNew = extractPreservedSections(newContent)
  if (existingInNew.length > 0) {
    // New content already has preserved sections, don't duplicate
    return newContent
  }

  // Build merged content
  const preservedContent = preservedSections.map((s) => s.content).join('\n\n')

  return `${newContent.trimEnd()}

---

## User Customizations

${preservedContent}
`
}

/**
 * Write content to file, preserving any existing user customizations
 * This is the main function to use for write-through with preservation
 */
export async function writeWithPreservation(
  filePath: string,
  newContent: string
): Promise<{ preserved: number; written: boolean }> {
  // Read existing preserved sections
  const preservedSections = await readPreservedSections(filePath)

  // Merge preserved sections into new content
  const finalContent = mergePreservedSections(newContent, preservedSections)

  // Write the file
  await fs.writeFile(filePath, finalContent, 'utf-8')

  return {
    preserved: preservedSections.length,
    written: true,
  }
}

/**
 * Check if content has any preserved sections
 */
export function hasPreservedSections(content: string): boolean {
  return content.includes(PRESERVE_START)
}

/**
 * Validate preserved sections (check for unclosed markers)
 */
export function validatePreservedSections(content: string): {
  valid: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  let startCount = 0
  let endCount = 0
  let searchIndex = 0

  // Count start markers
  while (true) {
    const idx = content.indexOf(PRESERVE_START, searchIndex)
    if (idx === -1) break
    startCount++
    searchIndex = idx + PRESERVE_START.length
  }

  searchIndex = 0

  // Count end markers
  while (true) {
    const idx = content.indexOf(PRESERVE_END, searchIndex)
    if (idx === -1) break
    endCount++
    searchIndex = idx + PRESERVE_END.length
  }

  if (startCount > endCount) {
    warnings.push(
      `Found ${startCount} preserve start markers but only ${endCount} end markers. ` +
        `Some sections may not be properly closed.`
    )
  }

  if (endCount > startCount) {
    warnings.push(
      `Found ${endCount} preserve end markers but only ${startCount} start markers. ` +
        `Some end markers may be orphaned.`
    )
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

export default {
  extractPreservedSections,
  readPreservedSections,
  mergePreservedSections,
  writeWithPreservation,
  hasPreservedSections,
  validatePreservedSections,
  PRESERVE_START,
  PRESERVE_END,
}
