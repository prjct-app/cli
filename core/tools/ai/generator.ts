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
import { AI_TOOLS, type AIToolConfig, DEFAULT_AI_TOOLS, getAIToolConfig } from './registry'

export interface GenerateResult {
  toolId: string
  outputFile: string
  outputPath: string
  success: boolean
  error?: string
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
      outputPath = path.join(globalPath, 'context', config.outputFile)
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true })

    // Read existing file to preserve user customizations
    try {
      const existingContent = await fs.readFile(outputPath, 'utf-8')

      // Validate existing preserved blocks
      const validation = validatePreserveBlocks(existingContent)
      if (!validation.valid) {
        console.warn(`⚠️  ${config.outputFile} has invalid preserve blocks:`)
        for (const error of validation.errors) {
          console.warn(`   ${error}`)
        }
      }

      content = mergePreservedSections(content, existingContent)
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
