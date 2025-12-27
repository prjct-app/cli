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

const cache = new Map<string, ParsedTemplate>()
const cacheOrder: string[] = []

// ============ Cache Helpers ============

function updateLruOrder(key: string): void {
  const index = cacheOrder.indexOf(key)
  if (index > -1) cacheOrder.splice(index, 1)
  cacheOrder.push(key)
}

function evictLru(): void {
  while (cache.size >= MAX_CACHE_SIZE && cacheOrder.length > 0) {
    const oldest = cacheOrder.shift()
    if (oldest) cache.delete(oldest)
  }
}

// ============ Parsing Functions ============

export function parseFrontmatter(content: string): ParsedTemplate {
  const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: {}, content: content.trim() }
  }

  const [, frontmatterText, mainContent] = match
  const frontmatter: Frontmatter = {}

  frontmatterText.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim()

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key.trim()] = value.slice(1, -1).split(',').map((v) => v.trim())
      } else {
        // Remove quotes if present
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    }
  })

  return { frontmatter, content: mainContent.trim() }
}

// ============ Main Functions ============

export async function load(commandName: string): Promise<ParsedTemplate> {
  // Check cache first
  if (cache.has(commandName)) {
    updateLruOrder(commandName)
    return cache.get(commandName)!
  }

  const templatePath = path.join(TEMPLATES_DIR, `${commandName}.md`)

  try {
    const rawContent = await fs.readFile(templatePath, 'utf-8')
    const parsed = parseFrontmatter(rawContent)

    // Evict LRU if needed before adding
    evictLru()

    // Cache result
    cache.set(commandName, parsed)
    cacheOrder.push(commandName)

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
  cacheOrder.length = 0
}

// ============ Default Export (backwards compat) ============

export default {
  load,
  parseFrontmatter,
  getAllowedTools,
  clearCache
}
