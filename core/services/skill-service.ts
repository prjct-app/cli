/**
 * Skill Service
 *
 * Manages discoverable skills from SKILL.md files.
 * Skills are reusable prompts/instructions with metadata.
 *
 * Skill sources (in priority order):
 * 1. Project: .prjct/skills/*.md
 * 2. Provider: ~/.claude/skills/* or ~/.gemini/skills/* (SKILL.md format)
 * 3. Global: ~/.prjct-cli/skills/*.md
 * 4. Built-in: templates/skills/*.md
 *
 * Note: Claude Code and Gemini CLI use identical SKILL.md format,
 * so skills are compatible between both providers.
 *
 * @version 1.1.0
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

import type { SkillMetadata, Skill, SkillSearchResult } from '../types'
import type { AIProviderName } from '../types/provider'

/**
 * Parse YAML-like frontmatter from markdown
 */
function parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { metadata: {}, body: content }
  }

  const [, frontmatter, body] = match
  const metadata: Record<string, unknown> = {}

  // Simple YAML parsing (key: value)
  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      let value: unknown = line.slice(colonIndex + 1).trim()

      // Handle arrays [item1, item2]
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''))
      }
      // Remove quotes
      else if (typeof value === 'string' && (value.startsWith('"') || value.startsWith("'"))) {
        value = value.slice(1, -1)
      }

      metadata[key] = value
    }
  }

  return { metadata, body: body.trim() }
}

/**
 * Convert filename to skill ID
 * For SKILL.md files, uses the parent directory name
 */
function fileToSkillId(filePath: string): string {
  const basename = path.basename(filePath, '.md')

  // For SKILL.md files (provider format), use parent directory name
  if (basename.toUpperCase() === 'SKILL') {
    const dirName = path.basename(path.dirname(filePath))
    return dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  return basename.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

class SkillService {
  private skills: Map<string, Skill> = new Map()
  private loaded = false

  /**
   * Get all skill directories in order of priority
   */
  private getSkillDirs(projectPath?: string, provider?: AIProviderName): Array<{ dir: string; source: Skill['source']; isProviderSkill?: boolean }> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
    const dirs: Array<{ dir: string; source: Skill['source']; isProviderSkill?: boolean }> = []

    // Project skills (highest priority)
    if (projectPath) {
      dirs.push({ dir: path.join(projectPath, '.prjct', 'skills'), source: 'project' })
    }

    // Provider skills (Claude or Gemini)
    // Both use SKILL.md format, so skills are compatible
    if (provider) {
      const providerDir = provider === 'gemini' ? '.gemini' : '.claude'
      dirs.push({ dir: path.join(homeDir, providerDir, 'skills'), source: 'global', isProviderSkill: true })
    } else {
      // Check both providers if no specific one is set
      dirs.push({ dir: path.join(homeDir, '.claude', 'skills'), source: 'global', isProviderSkill: true })
      dirs.push({ dir: path.join(homeDir, '.gemini', 'skills'), source: 'global', isProviderSkill: true })
    }

    // prjct global skills
    dirs.push({ dir: path.join(homeDir, '.prjct-cli', 'skills'), source: 'global' })

    // Built-in skills (lowest priority)
    dirs.push({ dir: path.join(__dirname, '..', '..', 'templates', 'skills'), source: 'builtin' })

    return dirs
  }

  /**
   * Load a single skill from file
   */
  private async loadSkill(filePath: string, source: Skill['source']): Promise<Skill | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { metadata, body } = parseFrontmatter(content)

      const id = fileToSkillId(filePath)
      const name = (metadata.name as string) || id

      return {
        id,
        name,
        description: (metadata.description as string) || '',
        content: body,
        source,
        filePath,
        metadata: {
          name,
          description: metadata.description as string,
          agent: metadata.agent as string,
          tags: metadata.tags as string[],
          version: metadata.version as string,
        },
      }
    } catch (_error) {
      // File read or parse error - expected for missing skills
      return null
    }
  }

  /**
   * Load all skills from all sources
   */
  async loadSkills(projectPath?: string, provider?: AIProviderName): Promise<void> {
    this.skills.clear()
    const dirs = this.getSkillDirs(projectPath, provider)

    for (const { dir, source, isProviderSkill } of dirs) {
      try {
        if (isProviderSkill) {
          // Provider skills use SKILL.md in subdirectories
          // e.g., ~/.claude/skills/my-skill/SKILL.md
          const skillDirs = await glob('*/SKILL.md', { cwd: dir, absolute: true })
          for (const file of skillDirs) {
            const skill = await this.loadSkill(file, source)
            if (skill && !this.skills.has(skill.id)) {
              this.skills.set(skill.id, skill)
            }
          }
        } else {
          // Regular .md files in directory
          const files = await glob('*.md', { cwd: dir, absolute: true })
          for (const file of files) {
            const skill = await this.loadSkill(file, source)
            if (skill && !this.skills.has(skill.id)) {
              // Don't override higher priority skills
              this.skills.set(skill.id, skill)
            }
          }
        }
      } catch (_error) {
        // Directory doesn't exist - expected for new installs
      }
    }

    this.loaded = true
  }

  /**
   * Get all loaded skills
   */
  async getAll(projectPath?: string): Promise<Skill[]> {
    if (!this.loaded) {
      await this.loadSkills(projectPath)
    }
    return Array.from(this.skills.values())
  }

  /**
   * Get a skill by ID
   */
  async get(id: string, projectPath?: string): Promise<Skill | null> {
    if (!this.loaded) {
      await this.loadSkills(projectPath)
    }
    return this.skills.get(id) || null
  }

  /**
   * Search skills by query
   */
  async search(query: string, projectPath?: string): Promise<SkillSearchResult[]> {
    const skills = await this.getAll(projectPath)
    const queryLower = query.toLowerCase()

    const results: SkillSearchResult[] = []

    for (const skill of skills) {
      let relevance = 0

      // Name match (highest weight)
      if (skill.name.toLowerCase().includes(queryLower)) {
        relevance += 10
      }
      if (skill.id.includes(queryLower)) {
        relevance += 8
      }

      // Description match
      if (skill.description.toLowerCase().includes(queryLower)) {
        relevance += 5
      }

      // Tag match
      if (skill.metadata.tags?.some(t => t.toLowerCase().includes(queryLower))) {
        relevance += 3
      }

      // Content match (lowest weight)
      if (skill.content.toLowerCase().includes(queryLower)) {
        relevance += 1
      }

      if (relevance > 0) {
        results.push({ skill, relevance })
      }
    }

    // Sort by relevance descending
    return results.sort((a, b) => b.relevance - a.relevance)
  }

  /**
   * List skills grouped by source
   */
  async listBySource(projectPath?: string): Promise<Record<Skill['source'], Skill[]>> {
    const skills = await this.getAll(projectPath)

    const grouped: Record<Skill['source'], Skill[]> = {
      project: [],
      global: [],
      builtin: [],
    }

    for (const skill of skills) {
      grouped[skill.source].push(skill)
    }

    return grouped
  }

  /**
   * Force reload skills
   */
  async reload(projectPath?: string): Promise<void> {
    this.loaded = false
    await this.loadSkills(projectPath)
  }

  /**
   * Get skill count
   */
  async count(projectPath?: string): Promise<number> {
    const skills = await this.getAll(projectPath)
    return skills.length
  }
}

// Singleton instance
const skillService = new SkillService()
export default skillService

// Export class for testing
export { SkillService }
