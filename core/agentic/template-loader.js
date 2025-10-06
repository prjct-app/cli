/**
 * Template Loader
 * Loads command templates with frontmatter parsing
 * Templates define what Claude should do - NO if/else logic
 */

const fs = require('fs').promises
const path = require('path')

class TemplateLoader {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'commands')
    this.cache = new Map()
    this.maxCacheSize = 50 // Limit cache to prevent memory leaks
  }

  /**
   * Load template with frontmatter
   * @param {string} commandName - Command name (e.g., 'now', 'done', 'ship')
   * @returns {Promise<{frontmatter: Object, content: string}>}
   */
  async load(commandName) {
    // Check cache first
    if (this.cache.has(commandName)) {
      return this.cache.get(commandName)
    }

    const templatePath = path.join(this.templatesDir, `${commandName}.md`)

    try {
      const rawContent = await fs.readFile(templatePath, 'utf-8')
      const parsed = this.parseFrontmatter(rawContent)

      // Implement LRU cache eviction to prevent memory leaks
      if (this.cache.size >= this.maxCacheSize) {
        // Remove oldest entry (first key in Map)
        const firstKey = this.cache.keys().next().value
        this.cache.delete(firstKey)
      }

      // Cache result
      this.cache.set(commandName, parsed)

      return parsed
    } catch (error) {
      throw new Error(`Template not found: ${commandName}.md`)
    }
  }

  /**
   * Parse frontmatter from markdown
   * @param {string} content - Raw markdown content
   * @returns {Object} Parsed template with frontmatter and content
   */
  parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
      return {
        frontmatter: {},
        content: content.trim(),
      }
    }

    const [, frontmatterText, mainContent] = match
    const frontmatter = {}

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
   * @param {string} commandName - Command name
   * @returns {Promise<string[]>}
   */
  async getAllowedTools(commandName) {
    const template = await this.load(commandName)
    return template.frontmatter['allowed-tools'] || []
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear()
  }
}

module.exports = new TemplateLoader()
