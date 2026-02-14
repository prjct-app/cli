/**
 * Section Updater - Multi-project CLAUDE.md manager
 *
 * Manages multiple project sections in a single CLAUDE.md file.
 * Each project gets its own section identified by projectId.
 * Preserves global prjct rules and other projects' sections.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

interface ProjectSection {
  projectId: string
  startIndex: number
  endIndex: number
  content: string
}

/**
 * Extract projectId from a project section
 */
function extractProjectId(sectionContent: string): string | null {
  const match = sectionContent.match(/<!-- projectId: ([a-f0-9-]+) -->/)
  return match ? match[1] : null
}

/**
 * Find all project sections in the file
 */
function findProjectSections(content: string): ProjectSection[] {
  const sections: ProjectSection[] = []
  const startMarker = '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
  const endMarker = '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'

  let searchStart = 0
  while (true) {
    const startIndex = content.indexOf(startMarker, searchStart)
    if (startIndex === -1) break

    const endIndex = content.indexOf(endMarker, startIndex)
    if (endIndex === -1) {
      // Malformed section - missing end marker
      console.warn('⚠️  Found project section without end marker, skipping...')
      break
    }

    const sectionContent = content.substring(startIndex, endIndex + endMarker.length)
    const projectId = extractProjectId(sectionContent)

    if (projectId) {
      sections.push({
        projectId,
        startIndex,
        endIndex: endIndex + endMarker.length,
        content: sectionContent,
      })
    }

    searchStart = endIndex + endMarker.length
  }

  return sections
}

/**
 * Extract the global prjct rules section (if exists)
 * This section should be preserved and never removed
 */
function extractGlobalSection(content: string): string | null {
  const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
  const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

  const startIndex = content.indexOf(startMarker)
  const endIndex = content.indexOf(endMarker)

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return content.substring(startIndex, endIndex + endMarker.length)
  }

  return null
}

/**
 * Update or add a project section in CLAUDE.md
 *
 * @param filePath - Path to CLAUDE.md (usually ~/.claude/CLAUDE.md)
 * @param projectId - Unique project identifier
 * @param newContent - New content for this project (must include markers and projectId comment)
 */
export async function updateProjectSection(
  filePath: string,
  projectId: string,
  newContent: string
): Promise<void> {
  // Validate that newContent has the correct markers and projectId
  if (!newContent.includes('<!-- prjct-project:start')) {
    throw new Error('New content must include project section markers')
  }

  const contentProjectId = extractProjectId(newContent)
  if (contentProjectId !== projectId) {
    throw new Error(`ProjectId mismatch: expected ${projectId}, got ${contentProjectId || 'none'}`)
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  // Read existing file (or start with empty)
  let existingContent = ''
  try {
    existingContent = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    // File doesn't exist - that's OK for first sync
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  // If file is empty or doesn't exist, just write the new content
  if (!existingContent.trim()) {
    await writeFileAtomic(filePath, newContent)
    return
  }

  // Extract global section (preserve it)
  const globalSection = extractGlobalSection(existingContent)

  // Find all existing project sections
  const existingSections = findProjectSections(existingContent)

  // Check if this projectId already has a section
  const existingSectionIndex = existingSections.findIndex((s) => s.projectId === projectId)

  let updatedSections: ProjectSection[]
  if (existingSectionIndex !== -1) {
    // Update existing section
    updatedSections = [...existingSections]
    updatedSections[existingSectionIndex] = {
      projectId,
      startIndex: 0, // Will be recalculated
      endIndex: 0, // Will be recalculated
      content: newContent,
    }
  } else {
    // Add new section
    updatedSections = [
      ...existingSections,
      {
        projectId,
        startIndex: 0,
        endIndex: 0,
        content: newContent,
      },
    ]
  }

  // Rebuild file content
  let rebuiltContent = ''

  // 1. Add global section first (if exists)
  if (globalSection) {
    rebuiltContent += globalSection + '\n\n'
  }

  // 2. Add all project sections
  for (const section of updatedSections) {
    rebuiltContent += section.content
    // Add spacing between sections for readability
    if (section !== updatedSections[updatedSections.length - 1]) {
      rebuiltContent += '\n\n'
    }
  }

  // Write atomically (temp file + rename for safety)
  await writeFileAtomic(filePath, rebuiltContent)
}

/**
 * Remove a project section from CLAUDE.md
 * Useful for cleanup when a project is deleted
 */
export async function removeProjectSection(filePath: string, projectId: string): Promise<void> {
  let existingContent = ''
  try {
    existingContent = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    // File doesn't exist - nothing to remove
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }

  // Extract global section (preserve it)
  const globalSection = extractGlobalSection(existingContent)

  // Find all existing project sections
  const existingSections = findProjectSections(existingContent)

  // Filter out the section to remove
  const remainingSections = existingSections.filter((s) => s.projectId !== projectId)

  if (remainingSections.length === existingSections.length) {
    // Section wasn't found - nothing to do
    return
  }

  // Rebuild file content
  let rebuiltContent = ''

  // 1. Add global section first (if exists)
  if (globalSection) {
    rebuiltContent += globalSection + '\n\n'
  }

  // 2. Add remaining project sections
  for (const section of remainingSections) {
    rebuiltContent += section.content
    if (section !== remainingSections[remainingSections.length - 1]) {
      rebuiltContent += '\n\n'
    }
  }

  // If no content left, just write empty file
  if (!rebuiltContent.trim()) {
    await fs.writeFile(filePath, '', 'utf-8')
    return
  }

  await writeFileAtomic(filePath, rebuiltContent)
}

/**
 * List all project IDs currently in CLAUDE.md
 */
export async function listProjectSections(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const sections = findProjectSections(content)
    return sections.map((s) => s.projectId)
  } catch (error) {
    // File doesn't exist
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Write file atomically using temp file + rename pattern
 * Prevents corruption if write fails midway
 */
async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8')

    // Atomic rename
    await fs.rename(tempPath, filePath)
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}
