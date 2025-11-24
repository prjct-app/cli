/**
 * ContextEstimator - Pre-filter files before building context
 * 
 * Estimates which files are needed based on task analysis
 * BEFORE building full context - saves I/O
 * 
 * @version 1.0.0
 */

const path = require('path')
const { glob } = require('glob')

class ContextEstimator {
  /**
   * Estimate which files are needed for a task
   * @param {Object} taskAnalysis - Task analysis result
   * @param {string} projectPath - Project path
   * @returns {Promise<Array<string>>} Estimated file paths
   */
  async estimateFiles(taskAnalysis, projectPath) {
    const domain = taskAnalysis.primaryDomain
    const projectTech = taskAnalysis.projectTechnologies || {}
    const semantic = taskAnalysis.semantic || {}

    // Get patterns for this domain
    const patterns = this.getPatternsForDomain(domain, projectTech)

    // Expand with semantic understanding
    if (semantic.requiresMultipleAgents && semantic.agents) {
      // Multi-agent task - combine patterns
      const allPatterns = semantic.agents.reduce((acc, agentDomain) => {
        const agentPatterns = this.getPatternsForDomain(agentDomain, projectTech)
        return {
          include: [...acc.include, ...agentPatterns.include],
          extensions: [...acc.extensions, ...agentPatterns.extensions]
        }
      }, { include: [], extensions: [] })

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
   */
  getPatternsForDomain(domain, projectTech) {
    const patterns = {
      include: [],
      extensions: [],
      exclude: ['node_modules', 'dist', 'build', '.git']
    }

    switch (domain) {
      case 'frontend':
        patterns.include = ['src', 'components', 'pages', 'views', 'app']
        patterns.extensions = ['.tsx', '.jsx', '.vue', '.svelte', '.css', '.scss', '.styled.js']
        
        // Add framework-specific patterns
        if (projectTech.frameworks) {
          if (projectTech.frameworks.some(f => f.toLowerCase().includes('next'))) {
            patterns.include.push('pages', 'app', 'components')
          }
          if (projectTech.frameworks.some(f => f.toLowerCase().includes('react'))) {
            patterns.extensions.push('.tsx', '.jsx')
          }
        }
        break

      case 'backend':
        patterns.include = ['src', 'lib', 'api', 'routes', 'controllers', 'services', 'app']
        patterns.extensions = ['.js', '.ts', '.py', '.rb', '.go', '.rs']
        
        // Framework-specific
        if (projectTech.frameworks) {
          if (projectTech.frameworks.some(f => f.toLowerCase().includes('express'))) {
            patterns.include.push('routes', 'middleware', 'controllers')
          }
          if (projectTech.frameworks.some(f => f.toLowerCase().includes('django'))) {
            patterns.include.push('views', 'urls', 'models')
          }
        }
        break

      case 'database':
        patterns.include = ['migrations', 'models', 'schemas', 'db', 'database']
        patterns.extensions = ['.sql', '.js', '.ts', '.rb', '.py']
        break

      case 'qa':
        patterns.include = ['tests', '__tests__', 'spec', 'test']
        patterns.extensions = ['.test.js', '.test.ts', '.spec.js', '.spec.ts']
        break

      case 'devops':
        patterns.include = ['.github', '.gitlab', 'docker', 'k8s', 'kubernetes', 'terraform']
        patterns.extensions = ['.yml', '.yaml', '.dockerfile', '.sh', '.tf']
        break

      default:
        // General - include common source directories
        patterns.include = ['src', 'lib', 'app']
        patterns.extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb']
    }

    return patterns
  }

  /**
   * Find files matching patterns
   */
  async findMatchingFiles(projectPath, patterns) {
    const files = []

    try {
      // Build glob patterns
      const globPatterns = []

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
            ignore: patterns.exclude.map(ex => `**/${ex}/**`),
            nodir: true,
            follow: false
          })

          if (Array.isArray(matches)) {
            files.push(...matches)
          }
        } catch (error) {
          // Skip invalid patterns
        }
      }

      // Remove duplicates and sort
      return [...new Set(files)].sort()
    } catch (error) {
      console.error('Error finding files:', error.message)
      return []
    }
  }

  /**
   * Estimate context size (number of files)
   */
  async estimateContextSize(taskAnalysis, projectPath) {
    const files = await this.estimateFiles(taskAnalysis, projectPath)
    return files.length
  }
}

module.exports = ContextEstimator

