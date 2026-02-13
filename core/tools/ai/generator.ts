/**
 * AI Tools Context Generator
 *
 * Generates optimized context files for each AI coding tool.
 * Each tool gets context in its preferred format.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getErrorMessage } from '../../types/fs'
import { mergePreservedSections, validatePreserveBlocks } from '../../utils/preserve-sections'
import { getFormatter, type ProjectContext } from './formatters'
import {
  AI_TOOLS,
  type AIToolConfig,
  DEFAULT_AI_TOOLS,
  getAIToolConfig,
  getGlobalConfigPath,
} from './registry'

export interface GenerateResult {
  toolId: string
  outputFile: string
  outputPath: string
  success: boolean
  error?: string
}

/**
 * Merge new content with existing file using marker replacement
 * Allows multiple prjct-managed sections to coexist (e.g., global commands + project context)
 */
function mergeWithMarkers(newContent: string, existingContent: string, toolId: string): string {
  // Determine marker names based on tool
  // For Claude: Use project-specific markers to coexist with global commands
  const startMarker =
    toolId === 'claude'
      ? '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
      : '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
  const endMarker =
    toolId === 'claude'
      ? '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'
      : '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

  // Check if markers exist in existing file
  const hasMarkers = existingContent.includes(startMarker) && existingContent.includes(endMarker)

  if (!hasMarkers) {
    // No markers - append new content at the end
    return `${existingContent.trimEnd()}\n\n${newContent}`
  }

  // Markers exist - replace content between markers
  const beforeMarker = existingContent.substring(0, existingContent.indexOf(startMarker))
  const afterMarker = existingContent.substring(
    existingContent.indexOf(endMarker) + endMarker.length
  )

  // Extract project section from new content (should include markers)
  let projectSection = newContent
  if (newContent.includes(startMarker)) {
    projectSection = newContent.substring(
      newContent.indexOf(startMarker),
      newContent.indexOf(endMarker) + endMarker.length
    )
  }

  return beforeMarker + projectSection + afterMarker
}

/**
 * Generate context files for specified AI tools
 */
export async function generateAIToolContexts(
  context: ProjectContext,
  globalPath: string,
  repoPath: string,
  toolIds: string[] = DEFAULT_AI_TOOLS
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = []

  for (const toolId of toolIds) {
    const config = getAIToolConfig(toolId)
    if (!config) {
      results.push({
        toolId,
        outputFile: '',
        outputPath: '',
        success: false,
        error: `Unknown tool: ${toolId}`,
      })
      continue
    }

    const result = await generateForTool(context, config, globalPath, repoPath)
    results.push(result)
  }

  return results
}

/**
 * Generate context for a single AI tool
 */
async function generateForTool(
  context: ProjectContext,
  config: AIToolConfig,
  globalPath: string,
  repoPath: string
): Promise<GenerateResult> {
  const formatter = getFormatter(config.id)
  if (!formatter) {
    return {
      toolId: config.id,
      outputFile: config.outputFile,
      outputPath: '',
      success: false,
      error: `No formatter for: ${config.id}`,
    }
  }

  try {
    // Generate content
    let content = formatter(context, config)

    // Determine output path
    let outputPath: string
    if (config.outputPath === 'repo') {
      outputPath = path.join(repoPath, config.outputFile)
    } else {
      // NUEVO: Usar ruta global REAL donde la herramienta lee
      const globalConfigPath = getGlobalConfigPath(config.id)
      if (globalConfigPath) {
        outputPath = globalConfigPath
      } else {
        // Fallback: storage interno (si no sabemos dónde va)
        outputPath = path.join(globalPath, 'context', config.outputFile)
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true })

    // Read existing file to merge with markers or preserve user customizations
    try {
      const existingContent = await fs.readFile(outputPath, 'utf-8')

      // For global tools (like Claude), use marker-replacement to coexist with global config
      if (config.outputPath === 'global') {
        content = mergeWithMarkers(content, existingContent, config.id)
      } else {
        // For repo-specific tools, use standard preserved sections
        const validation = validatePreserveBlocks(existingContent)
        if (!validation.valid) {
          console.warn(`⚠️  ${config.outputFile} has invalid preserve blocks:`)
          for (const error of validation.errors) {
            console.warn(`   ${error}`)
          }
        }
        content = mergePreservedSections(content, existingContent)
      }
    } catch {
      // File doesn't exist yet - use generated content as-is
    }

    // Write file
    await fs.writeFile(outputPath, content, 'utf-8')

    return {
      toolId: config.id,
      outputFile: config.outputFile,
      outputPath,
      success: true,
    }
  } catch (error) {
    return {
      toolId: config.id,
      outputFile: config.outputFile,
      outputPath: '',
      success: false,
      error: getErrorMessage(error),
    }
  }
}

/**
 * Get list of files that would be generated
 */
export function getOutputFiles(
  toolIds: string[] = DEFAULT_AI_TOOLS
): { toolId: string; file: string; location: 'repo' | 'global' }[] {
  return toolIds
    .map((id) => {
      const config = AI_TOOLS[id]
      if (!config) return null
      return {
        toolId: id,
        file: config.outputFile,
        location: config.outputPath,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}
