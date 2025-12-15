/**
 * Template Loader
 * Loads and parses command templates with frontmatter.
 *
 * @module agentic/template-loader
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import { TemplateError } from '../errors'

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
 * Uses LRU cache with size limit to prevent memory leaks.
 */
class TemplateLoader {
  templatesDir: string
  cache: Map<string, ParsedTemplate>
  cacheOrder: string[] // Track access order for LRU eviction
  maxCacheSize: number

  constructor() {
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'commands')
    this.cache = new Map()
    this.cacheOrder = []
    this.maxCacheSize = 50 // More than enough for all commands
  }

  /**
   * Update LRU order - move key to end (most recently used)
   */
  private updateLruOrder(key: string): void {
    const index = this.cacheOrder.indexOf(key)
    if (index > -1) {
      this.cacheOrder.splice(index, 1)
    }
    this.cacheOrder.push(key)
  }

  /**
   * Evict least recently used entry if cache exceeds max size
   */
  private evictLru(): void {
    while (this.cache.size >= this.maxCacheSize && this.cacheOrder.length > 0) {
      const oldest = this.cacheOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
      }
    }
  }

  /**
   * Load template with frontmatter
   */
  async load(commandName: string): Promise<ParsedTemplate> {
    // Check cache first
    if (this.cache.has(commandName)) {
      this.updateLruOrder(commandName)
      return this.cache.get(commandName)!
    }

    const templatePath = path.join(this.templatesDir, `${commandName}.md`)

    try {
      const rawContent = await fs.readFile(templatePath, 'utf-8')
      const parsed = this.parseFrontmatter(rawContent)

      // Evict LRU if needed before adding
      this.evictLru()

      // Cache result
      this.cache.set(commandName, parsed)
      this.cacheOrder.push(commandName)

      return parsed
    } catch {
      throw TemplateError.notFound(commandName)
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
