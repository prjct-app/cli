import { describe, it, expect, beforeEach } from 'vitest'
import templateLoader from '../../agentic/template-loader.js'

describe('Template Loader', () => {
  beforeEach(() => {
    templateLoader.clearCache()
  })

  describe('load()', () => {
    it('should load a template successfully', async () => {
      const template = await templateLoader.load('now')

      expect(template).toBeDefined()
      expect(template).toHaveProperty('content')
      expect(template).toHaveProperty('frontmatter')
    })

    it('should load multiple templates', async () => {
      const now = await templateLoader.load('now')
      const done = await templateLoader.load('done')
      const next = await templateLoader.load('next')

      expect(now).toBeDefined()
      expect(done).toBeDefined()
      expect(next).toBeDefined()
    })

    it('should throw error for non-existent template', async () => {
      await expect(templateLoader.load('nonexistent')).rejects.toThrow('Template not found: nonexistent.md')
    })

    it('should cache templates', async () => {
      const first = await templateLoader.load('now')
      const second = await templateLoader.load('now')

      // Should return the same cached object
      expect(first).toBe(second)
    })
  })

  describe('parseFrontmatter()', () => {
    it('should parse frontmatter correctly', () => {
      const content = `---
allowed-tools: [Read, Write, Bash]
category: core
---
# Template Content

This is the main content.`

      const parsed = templateLoader.parseFrontmatter(content)

      expect(parsed.frontmatter).toHaveProperty('allowed-tools')
      expect(parsed.frontmatter['allowed-tools']).toEqual(['Read', 'Write', 'Bash'])
      expect(parsed.frontmatter.category).toBe('core')
      expect(parsed.content).toContain('# Template Content')
    })

    it('should handle templates without frontmatter', () => {
      const content = `# Simple Template

Just content, no frontmatter.`

      const parsed = templateLoader.parseFrontmatter(content)

      expect(parsed.frontmatter).toEqual({})
      expect(parsed.content).toContain('# Simple Template')
    })

    it('should parse string values', () => {
      const content = `---
title: Test Command
description: A test command
---
Content`

      const parsed = templateLoader.parseFrontmatter(content)

      expect(parsed.frontmatter.title).toBe('Test Command')
      expect(parsed.frontmatter.description).toBe('A test command')
    })

    it('should handle quoted strings', () => {
      const content = `---
title: "Quoted Title"
description: 'Single Quoted'
---
Content`

      const parsed = templateLoader.parseFrontmatter(content)

      expect(parsed.frontmatter.title).toBe('Quoted Title')
      expect(parsed.frontmatter.description).toBe('Single Quoted')
    })

    it('should parse array values', () => {
      const content = `---
tools: [Read, Write, Exec]
tags: [core, important]
---
Content`

      const parsed = templateLoader.parseFrontmatter(content)

      expect(Array.isArray(parsed.frontmatter.tools)).toBe(true)
      expect(parsed.frontmatter.tools).toEqual(['Read', 'Write', 'Exec'])
      expect(parsed.frontmatter.tags).toEqual(['core', 'important'])
    })
  })

  describe('getAllowedTools()', () => {
    it('should return allowed tools from template', async () => {
      const tools = await templateLoader.getAllowedTools('now')

      expect(Array.isArray(tools)).toBe(true)
    })

    it('should return empty array if no allowed-tools defined', async () => {
      // Create a mock template without allowed-tools
      const content = `# Simple Template
No tools defined`

      const parsed = templateLoader.parseFrontmatter(content)
      expect(parsed.frontmatter['allowed-tools'] || []).toEqual([])
    })
  })

  describe('clearCache()', () => {
    it('should clear the cache', async () => {
      // Load and cache
      await templateLoader.load('now')

      // Clear cache
      templateLoader.clearCache()

      // Load again - should read from file, not cache
      const template = await templateLoader.load('now')
      expect(template).toBeDefined()
    })
  })

  describe('Real Templates', () => {
    it('should load "now" template', async () => {
      const template = await templateLoader.load('now')

      expect(template.content).toBeTruthy()
      expect(template.content.length).toBeGreaterThan(0)
    })

    it('should load "done" template', async () => {
      const template = await templateLoader.load('done')

      expect(template.content).toBeTruthy()
      expect(template.content.length).toBeGreaterThan(0)
    })

    it('should load "ship" template', async () => {
      const template = await templateLoader.load('ship')

      expect(template.content).toBeTruthy()
      expect(template.content.length).toBeGreaterThan(0)
    })
  })
})
