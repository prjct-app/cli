/**
 * Architecture Generator - Coordinates architecture generation
 * AGENTIC: Claude generates content via templates/architect/*.md
 * This file only provides structure - real content from Claude
 */

import fs from 'node:fs/promises'
import path from 'node:path'

interface ArchitectureContext {
  [key: string]: unknown
}

interface Architecture {
  id: string
  idea: string
  createdAt: string
  phases: Record<string, unknown>
  _agenticNote: string
}

class ArchitectureGenerator {
  defaultPhases: string[]

  constructor() {
    // AGENTIC: Phases determined by Claude via templates/architect/phases.md
    this.defaultPhases = [
      'discovery',
      'user-flows',
      'domain-modeling',
      'api-design',
      'architecture',
      'data-design',
      'tech-stack',
      'roadmap',
    ]
  }

  /**
   * Generate architecture skeleton
   * AGENTIC: Claude fills in content using templates
   */
  async generateArchitecture(
    idea: string,
    _context: ArchitectureContext = {}
  ): Promise<Architecture> {
    // Return skeleton - Claude generates actual content via templates
    return {
      id: `arch-${Date.now()}`,
      idea,
      createdAt: new Date().toISOString(),
      phases: {},
      // AGENTIC: Claude populates phases using templates/architect/*.md
      _agenticNote:
        'Use templates/architect/phases.md to determine needed phases, then templates/architect/discovery.md etc for content',
    }
  }

  /**
   * Get template path for a phase
   */
  getPhaseTemplate(phase: string): string | null {
    const templateMap: Record<string, string> = {
      discovery: 'templates/architect/discovery.md',
      'user-flows': 'templates/design/flow.md',
      'domain-modeling': 'templates/design/database.md',
      'api-design': 'templates/design/api.md',
      architecture: 'templates/design/architecture.md',
      'data-design': 'templates/design/database.md',
      'tech-stack': 'templates/design/architecture.md',
      roadmap: 'templates/commands/feature.md',
    }
    return templateMap[phase] || null
  }

  /**
   * Save architecture to files
   * AGENTIC: Format determined by Claude based on content
   */
  async saveArchitecture(architecture: Architecture, projectPath: string): Promise<string> {
    const archPath = path.join(projectPath, 'planning', 'architectures', architecture.id)
    await fs.mkdir(archPath, { recursive: true })

    // Save summary
    await fs.writeFile(path.join(archPath, 'summary.json'), JSON.stringify(architecture, null, 2))

    // AGENTIC: Claude generates and saves phase files directly
    return archPath
  }

  /**
   * SQL type mapping utility
   */
  sqlType(type: string): string {
    const typeMap: Record<string, string> = {
      uuid: 'UUID',
      string: 'VARCHAR(255)',
      text: 'TEXT',
      int: 'INTEGER',
      timestamp: 'TIMESTAMP',
      boolean: 'BOOLEAN',
      json: 'JSONB',
    }
    return typeMap[type] || 'TEXT'
  }
}

export default ArchitectureGenerator
