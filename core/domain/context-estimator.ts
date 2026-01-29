/**
 * ContextEstimator - Pre-filter files before building context
 *
 * Estimates which files are needed based on task analysis
 * BEFORE building full context - saves I/O
 *
 * @version 1.0.0
 */

import { glob } from 'glob'
import log from '../utils/logger'

interface TaskAnalysis {
  primaryDomain: string
  projectTechnologies?: ProjectTech
  semantic?: SemanticAnalysis
}

interface ProjectTech {
  extensions?: Record<string, number>
  directories?: string[]
  [key: string]: unknown
}

interface SemanticAnalysis {
  requiresMultipleAgents?: boolean
  agents?: string[]
  [key: string]: unknown
}

interface FilePatterns {
  include: string[]
  extensions: string[]
  exclude: string[]
}

class ContextEstimator {
  /**
   * Estimate which files are needed for a task
   */
  async estimateFiles(taskAnalysis: TaskAnalysis, projectPath: string): Promise<string[]> {
    const domain = taskAnalysis.primaryDomain
    const projectTech = taskAnalysis.projectTechnologies || {}
    const semantic = taskAnalysis.semantic || {}

    // Get patterns for this domain
    const patterns = this.getPatternsForDomain(domain, projectTech)

    // Expand with semantic understanding
    if (semantic.requiresMultipleAgents && semantic.agents) {
      // Multi-agent task - combine patterns
      const allPatterns = semantic.agents.reduce(
        (acc, agentDomain) => {
          const agentPatterns = this.getPatternsForDomain(agentDomain, projectTech)
          return {
            include: [...acc.include, ...agentPatterns.include],
            extensions: [...acc.extensions, ...agentPatterns.extensions],
          }
        },
        { include: [] as string[], extensions: [] as string[] }
      )

      patterns.include = [...new Set(allPatterns.include)]
      patterns.extensions = [...new Set(allPatterns.extensions)]
    }

    // Find files matching patterns
    const files = await this.findMatchingFiles(projectPath, patterns)

    // Limit to reasonable number
    const maxFiles = 200
    return files.slice(0, maxFiles)
  }

  /**
   * Get file patterns for a domain
   *
   * 100% AGENTIC: Uses REAL project data, not hardcoded patterns.
   * No domain-specific assumptions or language→extension mapping.
   */
  getPatternsForDomain(_domain: string, projectData: ProjectTech): FilePatterns {
    const patterns: FilePatterns = {
      include: [],
      extensions: [],
      exclude: ['node_modules', 'dist', 'build', '.git', '.next', 'target', 'vendor', 'coverage'],
    }

    // Use REAL extensions from project (if provided in projectData)
    if (projectData?.extensions) {
      // projectData.extensions is {'.js': 45, '.ts': 23, ...}
      patterns.extensions = Object.keys(projectData.extensions)
        .filter((ext) => ext.startsWith('.'))
        .slice(0, 15) // Top 15 extensions
    }

    // Use REAL directories from project (if provided in projectData)
    if (projectData?.directories) {
      patterns.include = projectData.directories.filter((dir) => !patterns.exclude.includes(dir))
    }

    // If no real data available, use minimal universal fallback
    if (patterns.extensions.length === 0) {
      patterns.extensions = ['*'] // All files
    }

    if (patterns.include.length === 0) {
      patterns.include = ['.'] // Root directory
    }

    // NO domain-specific hardcoding
    // Claude decides what files matter based on actual analysis

    return patterns
  }

  /**
   * Find files matching patterns
   */
  async findMatchingFiles(projectPath: string, patterns: FilePatterns): Promise<string[]> {
    const files: string[] = []

    try {
      // Build glob patterns
      const globPatterns: string[] = []

      // Add include patterns
      for (const include of patterns.include) {
        for (const ext of patterns.extensions) {
          globPatterns.push(`${include}/**/*${ext}`)
          globPatterns.push(`**/${include}/**/*${ext}`)
        }
      }

      // Also search root level
      for (const ext of patterns.extensions) {
        globPatterns.push(`*${ext}`)
      }

      // Execute glob searches
      for (const pattern of globPatterns) {
        try {
          const matches = await glob(pattern, {
            cwd: projectPath,
            ignore: patterns.exclude.map((ex) => `**/${ex}/**`),
            nodir: true,
            follow: false,
          })

          if (Array.isArray(matches)) {
            files.push(...matches)
          }
        } catch (_error) {
          // Skip invalid patterns
        }
      }

      // Remove duplicates and sort
      return [...new Set(files)].sort()
    } catch (error) {
      log.error('Error finding files:', (error as Error).message)
      return []
    }
  }

  /**
   * Estimate context size (number of files)
   */
  async estimateContextSize(taskAnalysis: TaskAnalysis, projectPath: string): Promise<number> {
    const files = await this.estimateFiles(taskAnalysis, projectPath)
    return files.length
  }
}

export default ContextEstimator
