/**
 * Global Config Operations
 * Install/update global CLAUDE.md configuration and docs
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { GlobalConfigResult } from './types'

/**
 * Install documentation files to ~/.prjct-cli/docs/
 */
export async function installDocs(): Promise<{ success: boolean; error?: string }> {
  try {
    const docsDir = path.join(os.homedir(), '.prjct-cli', 'docs')
    const templateDocsDir = path.join(__dirname, '../../../templates/global/docs')

    // Ensure docs directory exists
    await fs.mkdir(docsDir, { recursive: true })

    // Read all doc files from template
    const docFiles = await fs.readdir(templateDocsDir)

    // Copy each doc file
    for (const file of docFiles) {
      if (file.endsWith('.md')) {
        const srcPath = path.join(templateDocsDir, file)
        const destPath = path.join(docsDir, file)
        const content = await fs.readFile(srcPath, 'utf-8')
        await fs.writeFile(destPath, content, 'utf-8')
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Install or update global CLAUDE.md configuration
 */
export async function installGlobalConfig(
  claudeConfigPath: string,
  detectClaude: () => Promise<boolean>
): Promise<GlobalConfigResult> {
  const claudeDetected = await detectClaude()

  if (!claudeDetected) {
    return {
      success: false,
      error: 'Claude not detected',
      action: 'skipped',
    }
  }

  try {
    // Ensure ~/.claude directory exists
    const claudeDir = path.join(os.homedir(), '.claude')
    await fs.mkdir(claudeDir, { recursive: true })

    const globalConfigPath = path.join(claudeDir, 'CLAUDE.md')
    const templatePath = path.join(__dirname, '../../../templates/global/CLAUDE.md')

    // Read template content
    const templateContent = await fs.readFile(templatePath, 'utf-8')

    // Check if global config already exists
    let existingContent = ''
    let fileExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      fileExists = true
    } catch {
      // File doesn't exist, will create new
      fileExists = false
    }

    if (!fileExists) {
      // Create new file with full template
      await fs.writeFile(globalConfigPath, templateContent, 'utf-8')
      return {
        success: true,
        action: 'created',
        path: globalConfigPath,
      }
    } else {
      // File exists - perform intelligent merge
      const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
      const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

      // Check if markers exist in existing file
      const hasMarkers =
        existingContent.includes(startMarker) && existingContent.includes(endMarker)

      if (!hasMarkers) {
        // No markers - append prjct section at the end
        const updatedContent = existingContent + '\n\n' + templateContent
        await fs.writeFile(globalConfigPath, updatedContent, 'utf-8')
        return {
          success: true,
          action: 'appended',
          path: globalConfigPath,
        }
      } else {
        // Markers exist - replace content between markers
        const beforeMarker = existingContent.substring(0, existingContent.indexOf(startMarker))
        const afterMarker = existingContent.substring(
          existingContent.indexOf(endMarker) + endMarker.length
        )

        // Extract prjct section from template
        const prjctSection = templateContent.substring(
          templateContent.indexOf(startMarker),
          templateContent.indexOf(endMarker) + endMarker.length
        )

        const updatedContent = beforeMarker + prjctSection + afterMarker
        await fs.writeFile(globalConfigPath, updatedContent, 'utf-8')
        return {
          success: true,
          action: 'updated',
          path: globalConfigPath,
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      action: 'failed',
    }
  }
}
