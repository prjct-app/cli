/**
 * Template Loader
 * Loads and parses command templates with frontmatter.
 *
 * @module agentic/template-loader
 */

import fs from 'fs/promises'
import path from 'path'
import { TemplateError } from '../errors'
import type { Frontmatter, ParsedTemplate } from '../types'

// ============ Module State (LRU Cache) ============

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates', 'commands')
const MAX_CACHE_SIZE = 50

// Use single Map for O(1) LRU operations (ES6 Maps maintain insertion order)
const cache = new Map<string, ParsedTemplate>()

// ============ Cache Helpers ============

function setWithLru(key: string, value: ParsedTemplate): void {
  // Delete first to move to end when re-adding (most recently used)
  cache.delete(key)
  cache.set(key, value)

  // Evict oldest (first item) if over limit
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

function getWithLru(key: string): ParsedTemplate | undefined {
  const value = cache.get(key)
  if (value !== undefined) {
    // Move to end (most recently used)
    cache.delete(key)
    cache.set(key, value)
  }
  return value
}

// ============ Parsing Functions ============

/**
 * Parse tool-permissions YAML block
 * Handles nested structure like:
 * tool-permissions:
 *   bash:
 *     allow: ["git *"]
 *     deny: ["rm -rf"]
 */
function parseToolPermissions(lines: string[], startIndex: number): {
  permissions: Record<string, { allow?: string[]; ask?: string[]; deny?: string[] }>
  endIndex: number
} {
  const permissions: Record<string, { allow?: string[]; ask?: string[]; deny?: string[] }> = {}
  let i = startIndex
  let currentTool: string | null = null

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // End if we hit a new top-level key (no leading spaces)
    if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      break
    }

    // Tool name (2 spaces indent)
    const toolMatch = line.match(/^ {2}(\w+):$/)
    if (toolMatch) {
      currentTool = toolMatch[1]
      permissions[currentTool] = {}
      i++
      continue
    }

    // Permission array (4 spaces indent)
    const permMatch = line.match(/^ {4}(allow|ask|deny):\s*\[(.+)\]/)
    if (permMatch && currentTool) {
      const [, permType, arrayContent] = permMatch
      permissions[currentTool][permType as 'allow' | 'ask' | 'deny'] = arrayContent
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
      i++
      continue
    }

    // Skip empty lines within block
    if (trimmed === '') {
      i++
      continue
    }

    i++
  }

  return { permissions, endIndex: i }
}

export function parseFrontmatter(content: string): ParsedTemplate {
  const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: {}, content: content.trim() }
  }

  const [, frontmatterText, mainContent] = match
  const frontmatter: Frontmatter = {}
  const lines = frontmatterText.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const [key, ...valueParts] = line.split(':')

    if (!key || line.startsWith(' ') || line.startsWith('\t')) {
      continue
    }

    const keyTrimmed = key.trim()
    const value = valueParts.join(':').trim()

    // Handle tool-permissions nested block
    if (keyTrimmed === 'tool-permissions' && value === '') {
      const { permissions, endIndex } = parseToolPermissions(lines, i + 1)
      frontmatter['tool-permissions'] = permissions
      i = endIndex - 1
      continue
    }

    // Parse arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[keyTrimmed] = value.slice(1, -1).split(',').map((v) => v.trim())
    } else if (value) {
      // Remove quotes if present
      frontmatter[keyTrimmed] = value.replace(/^["']|["']$/g, '')
    }
  }

  return { frontmatter, content: mainContent.trim() }
}

// ============ Main Functions ============

export async function load(commandName: string): Promise<ParsedTemplate> {
  // Check cache first with LRU update
  const cached = getWithLru(commandName)
  if (cached) {
    return cached
  }

  const templatePath = path.join(TEMPLATES_DIR, `${commandName}.md`)

  try {
    const rawContent = await fs.readFile(templatePath, 'utf-8')
    const parsed = parseFrontmatter(rawContent)

    // Cache with LRU management
    setWithLru(commandName, parsed)

    return parsed
  } catch {
    throw TemplateError.notFound(commandName)
  }
}

export async function getAllowedTools(commandName: string): Promise<string[]> {
  const template = await load(commandName)
  return template.frontmatter['allowed-tools'] || []
}

export function clearCache(): void {
  cache.clear()
}

// ============ Default Export (backwards compat) ============

export default {
  load,
  parseFrontmatter,
  getAllowedTools,
  clearCache
}
