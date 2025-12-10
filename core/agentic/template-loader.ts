/**
 * Template Loader
 * Loads and parses command templates with frontmatter.
 *
 * @module agentic/template-loader
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'

interface Frontmatter {
  name?: string
  description?: string
  'allowed-tools'?: string[]
  [key: string]: string | string[] | undefined
}

interface ParsedTemplate {
  frontmatter: Frontmatter
  content: string
}

/**
 * Loads command templates from templates/commands/ with caching.
 * Parses YAML-like frontmatter for metadata extraction.
 */
class TemplateLoader {
  templatesDir: string
  cache: Map<string, ParsedTemplate>

  constructor() {
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'commands')
    this.cache = new Map()
  }

  /**
   * Load template with frontmatter
   */
  async load(commandName: string): Promise<ParsedTemplate> {
    // Check cache first
    if (this.cache.has(commandName)) {
      return this.cache.get(commandName)!
    }

    const templatePath = path.join(this.templatesDir, `${commandName}.md`)

    try {
      const rawContent = await fs.readFile(templatePath, 'utf-8')
      const parsed = this.parseFrontmatter(rawContent)

      // Cache result
      this.cache.set(commandName, parsed)

      return parsed
    } catch {
      throw new Error(`Template not found: ${commandName}.md`)
    }
  }

  /**
   * Parse frontmatter from markdown
   */
  parseFrontmatter(content: string): ParsedTemplate {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
      return {
        frontmatter: {},
        content: content.trim(),
      }
    }

    const [, frontmatterText, mainContent] = match
    const frontmatter: Frontmatter = {}

    // Parse frontmatter lines
    frontmatterText.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim()

        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key.trim()] = value
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim())
        } else {
          // Remove quotes if present
          frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '')
        }
      }
    })

    return {
      frontmatter,
      content: mainContent.trim(),
    }
  }

  /**
   * Get allowed tools for a command
   */
  async getAllowedTools(commandName: string): Promise<string[]> {
    const template = await this.load(commandName)
    return template.frontmatter['allowed-tools'] || []
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

const templateLoader = new TemplateLoader()
export default templateLoader
export { TemplateLoader }
