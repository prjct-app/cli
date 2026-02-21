/**
 * NestedContextResolver - Discovers and resolves nested PRJCT.md and AGENTS.md files in monorepos
 *
 * Responsible for:
 * - Finding all PRJCT.md and AGENTS.md files in a monorepo
 * - Building a hierarchy of context (root → packages)
 * - Resolving inheritance between parent and child contexts/agents
 *
 * Pattern from OpenAI Codex AGENTS.md: "Scope = directory tree. Deeper files take precedence."
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager, {
  type MonorepoInfo,
  type MonorepoPackage,
} from '../infrastructure/path-manager'
import type {
  AgentDefinition,
  ContextSection,
  NestedAgents,
  NestedContext,
  ResolvedAgents,
  ResolvedContext,
} from '../types/services.js'
import * as fileHelper from '../utils/file-helper'

// ============================================================================
// NESTED CONTEXT RESOLVER
// ============================================================================

export class NestedContextResolver {
  private rootPath: string
  private monoInfo: MonorepoInfo | null = null

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath)
  }

  /**
   * Initialize the resolver with monorepo detection
   */
  async initialize(): Promise<void> {
    this.monoInfo = await pathManager.detectMonorepo(this.rootPath)
  }

  /**
   * Discover all PRJCT.md files in the project/monorepo
   */
  async discoverContextFiles(): Promise<NestedContext[]> {
    const contexts: NestedContext[] = []

    // Always check root
    const rootPrjctPath = path.join(this.rootPath, 'PRJCT.md')
    if (await fileHelper.fileExists(rootPrjctPath)) {
      const rootContext = await this.loadContext(rootPrjctPath, null)
      contexts.push(rootContext)
    }

    // If monorepo, check each package
    if (this.monoInfo?.isMonorepo) {
      for (const pkg of this.monoInfo.packages) {
        const pkgPrjctPath = path.join(pkg.path, 'PRJCT.md')
        if (await fileHelper.fileExists(pkgPrjctPath)) {
          const parentContext = contexts.find((c) => c.depth === 0) || null
          const pkgContext = await this.loadContext(pkgPrjctPath, parentContext, pkg)
          contexts.push(pkgContext)

          if (parentContext) {
            parentContext.children.push(pkgContext)
          }
        }
      }
    }

    // Also scan for any PRJCT.md in subdirectories (non-package)
    const additionalContexts = await this.scanForNestedContexts(this.rootPath, contexts)
    contexts.push(...additionalContexts)

    return contexts
  }

  /**
   * Load a single PRJCT.md file into a NestedContext
   */
  private async loadContext(
    filePath: string,
    parent: NestedContext | null,
    pkg: MonorepoPackage | null = null
  ): Promise<NestedContext> {
    const content = await fs.readFile(filePath, 'utf-8')
    const relativePath = path.relative(this.rootPath, filePath)
    const depth = relativePath.split(path.sep).length - 1

    return {
      path: filePath,
      relativePath,
      depth,
      parent,
      children: [],
      content,
      sections: this.parseSections(content),
      package: pkg,
    }
  }

  /**
   * Parse PRJCT.md content into sections
   */
  private parseSections(content: string): ContextSection[] {
    const sections: ContextSection[] = []
    const lines = content.split('\n')

    let currentSection: ContextSection | null = null
    let currentContent: string[] = []

    for (const line of lines) {
      // Check for section header (## or ###)
      const headerMatch = line.match(/^##\s+(.+)$/)
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim()
          sections.push(currentSection)
        }

        // Check for override marker
        const sectionName = headerMatch[1]
        const override = sectionName.includes('@override') || sectionName.includes('(override)')

        currentSection = {
          name: sectionName.replace(/@override|\(override\)/gi, '').trim(),
          content: '',
          override,
        }
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim()
      sections.push(currentSection)
    }

    return sections
  }

  /**
   * Scan for additional nested PRJCT.md files not in packages
   */
  private async scanForNestedContexts(
    dir: string,
    existing: NestedContext[]
  ): Promise<NestedContext[]> {
    const found: NestedContext[] = []
    const existingPaths = new Set(existing.map((c) => c.path))

    const scan = async (currentDir: string, depth: number): Promise<void> => {
      // Limit depth to avoid infinite recursion
      if (depth > 5) return

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true })

        for (const entry of entries) {
          // Skip common non-project directories
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'coverage'
          ) {
            continue
          }

          if (entry.isDirectory()) {
            const subDir = path.join(currentDir, entry.name)
            const prjctPath = path.join(subDir, 'PRJCT.md')

            if ((await fileHelper.fileExists(prjctPath)) && !existingPaths.has(prjctPath)) {
              // Find parent context (closest ancestor with PRJCT.md)
              const parent = this.findParentContext(prjctPath, existing.concat(found))
              const context = await this.loadContext(prjctPath, parent)
              found.push(context)
              existingPaths.add(prjctPath)

              if (parent) {
                parent.children.push(context)
              }
            }

            // Continue scanning subdirectories
            await scan(subDir, depth + 1)
          }
        }
      } catch {
        // Permission denied or other error, skip
      }
    }

    await scan(dir, 0)
    return found
  }

  /**
   * Find the parent context for a given path
   */
  private findParentContext(filePath: string, contexts: NestedContext[]): NestedContext | null {
    const fileDir = path.dirname(filePath)

    // Sort by depth descending to find closest parent
    const sorted = [...contexts].sort((a, b) => b.depth - a.depth)

    for (const ctx of sorted) {
      const ctxDir = path.dirname(ctx.path)
      if (fileDir.startsWith(ctxDir) && fileDir !== ctxDir) {
        return ctx
      }
    }

    return null
  }

  /**
   * Resolve context for a specific path by merging parent contexts
   * Deeper files take precedence (can override parent sections)
   */
  async resolveContextForPath(targetPath: string): Promise<ResolvedContext> {
    const contexts = await this.discoverContextFiles()

    // Find the most specific context for this path
    const targetDir = path.resolve(targetPath)
    let bestMatch: NestedContext | null = null

    for (const ctx of contexts) {
      const ctxDir = path.dirname(ctx.path)
      if (targetDir.startsWith(ctxDir)) {
        if (!bestMatch || ctx.depth > bestMatch.depth) {
          bestMatch = ctx
        }
      }
    }

    if (!bestMatch) {
      return {
        content: '',
        sources: [],
        overrides: [],
      }
    }

    // Build inheritance chain (from root to leaf)
    const chain: NestedContext[] = []
    let current: NestedContext | null = bestMatch
    while (current) {
      chain.unshift(current)
      current = current.parent
    }

    // Merge sections following inheritance
    return this.mergeContextChain(chain)
  }

  /**
   * Merge a chain of contexts following inheritance rules
   */
  private mergeContextChain(chain: NestedContext[]): ResolvedContext {
    const mergedSections = new Map<string, string>()
    const sources: string[] = []
    const overrides: string[] = []

    for (const ctx of chain) {
      sources.push(ctx.relativePath)

      for (const section of ctx.sections) {
        if (section.override || !mergedSections.has(section.name)) {
          mergedSections.set(section.name, section.content)
          if (section.override) {
            overrides.push(`${ctx.relativePath}:${section.name}`)
          }
        } else {
          // Append to existing section
          const existing = mergedSections.get(section.name) || ''
          mergedSections.set(section.name, `${existing}\n\n${section.content}`)
        }
      }
    }

    // Rebuild content from merged sections
    const parts: string[] = []
    for (const [name, content] of mergedSections) {
      parts.push(`## ${name}\n\n${content}`)
    }

    return {
      content: parts.join('\n\n---\n\n'),
      sources,
      overrides,
    }
  }

  /**
   * Get context for a specific monorepo package
   */
  async getPackageContext(packageName: string): Promise<ResolvedContext | null> {
    if (!this.monoInfo?.isMonorepo) {
      return null
    }

    const pkg = this.monoInfo.packages.find((p) => p.name === packageName)
    if (!pkg) {
      return null
    }

    return this.resolveContextForPath(pkg.path)
  }

  /**
   * Get all package contexts in the monorepo
   */
  async getAllPackageContexts(): Promise<Map<string, ResolvedContext>> {
    const results = new Map<string, ResolvedContext>()

    if (!this.monoInfo?.isMonorepo) {
      return results
    }

    for (const pkg of this.monoInfo.packages) {
      const ctx = await this.resolveContextForPath(pkg.path)
      results.set(pkg.name, ctx)
    }

    return results
  }

  // ==========================================================================
  // AGENTS.md DISCOVERY AND RESOLUTION
  // ==========================================================================

  /**
   * Discover all AGENTS.md files in the project/monorepo
   */
  async discoverAgentFiles(): Promise<NestedAgents[]> {
    const agentFiles: NestedAgents[] = []

    // Always check root
    const rootAgentsPath = path.join(this.rootPath, 'AGENTS.md')
    if (await fileHelper.fileExists(rootAgentsPath)) {
      const rootAgents = await this.loadAgents(rootAgentsPath, null)
      agentFiles.push(rootAgents)
    }

    // If monorepo, check each package
    if (this.monoInfo?.isMonorepo) {
      for (const pkg of this.monoInfo.packages) {
        const pkgAgentsPath = path.join(pkg.path, 'AGENTS.md')
        if (await fileHelper.fileExists(pkgAgentsPath)) {
          const parentAgents = agentFiles.find((a) => a.depth === 0) || null
          const pkgAgents = await this.loadAgents(pkgAgentsPath, parentAgents, pkg)
          agentFiles.push(pkgAgents)

          if (parentAgents) {
            parentAgents.children.push(pkgAgents)
          }
        }
      }
    }

    // Also scan for any AGENTS.md in subdirectories (non-package)
    const additionalAgents = await this.scanForNestedAgents(this.rootPath, agentFiles)
    agentFiles.push(...additionalAgents)

    return agentFiles
  }

  /**
   * Load a single AGENTS.md file into a NestedAgents structure
   */
  private async loadAgents(
    filePath: string,
    parent: NestedAgents | null,
    pkg: MonorepoPackage | null = null
  ): Promise<NestedAgents> {
    const content = await fs.readFile(filePath, 'utf-8')
    const relativePath = path.relative(this.rootPath, filePath)
    const depth = relativePath.split(path.sep).length - 1

    return {
      path: filePath,
      relativePath,
      depth,
      parent,
      children: [],
      content,
      agents: this.parseAgents(content),
      package: pkg,
    }
  }

  /**
   * Parse AGENTS.md content into agent definitions
   *
   * Expected format:
   * ## AgentName @override?
   *
   * Description text here.
   *
   * ### Triggers
   * - trigger phrase 1
   * - trigger phrase 2
   *
   * ### Rules
   * - rule 1
   * - rule 2
   *
   * ### Patterns
   * ```typescript
   * // code pattern
   * ```
   */
  private parseAgents(content: string): AgentDefinition[] {
    const agents: AgentDefinition[] = []
    const lines = content.split('\n')

    let currentAgent: AgentDefinition | null = null
    let currentSubsection: string | null = null
    let currentContent: string[] = []

    const saveCurrentContent = () => {
      if (!currentAgent) return

      if (currentSubsection) {
        const contentStr = currentContent.join('\n').trim()
        switch (currentSubsection.toLowerCase()) {
          case 'triggers':
            currentAgent.triggers = this.parseListItems(contentStr)
            break
          case 'rules':
            currentAgent.rules = this.parseListItems(contentStr)
            break
          case 'patterns':
            currentAgent.patterns = this.parseCodeBlocks(contentStr)
            break
          case 'examples':
            currentAgent.examples = this.parseListItems(contentStr)
            break
          case 'domain':
            currentAgent.domain = contentStr
            break
        }
      } else {
        // This is the description
        const desc = currentContent.join('\n').trim()
        if (desc && !currentAgent.description) {
          currentAgent.description = desc
        }
      }
      currentContent = []
    }

    for (const line of lines) {
      // Check for agent header (## AgentName)
      const agentMatch = line.match(/^##\s+([^#].+)$/)
      if (agentMatch) {
        // Save previous agent
        if (currentAgent) {
          saveCurrentContent()
          agents.push(currentAgent)
        }

        // Check for override marker
        const agentName = agentMatch[1]
        const override = agentName.includes('@override') || agentName.includes('(override)')

        currentAgent = {
          name: agentName.replace(/@override|\(override\)/gi, '').trim(),
          description: '',
          override,
        }
        currentSubsection = null
        currentContent = []
        continue
      }

      // Check for subsection header (### Triggers, ### Rules, etc.)
      const subsectionMatch = line.match(/^###\s+(.+)$/)
      if (subsectionMatch && currentAgent) {
        saveCurrentContent()
        currentSubsection = subsectionMatch[1].trim()
        currentContent = []
        continue
      }

      // Accumulate content
      if (currentAgent) {
        currentContent.push(line)
      }
    }

    // Save last agent
    if (currentAgent) {
      saveCurrentContent()
      agents.push(currentAgent)
    }

    return agents
  }

  /**
   * Parse list items from content (lines starting with - or *)
   */
  private parseListItems(content: string): string[] {
    return content
      .split('\n')
      .filter((line) => line.match(/^\s*[-*]\s+/))
      .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
      .filter((item) => item.length > 0)
  }

  /**
   * Parse code blocks from content
   */
  private parseCodeBlocks(content: string): string[] {
    const blocks: string[] = []
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim())
    }

    // If no code blocks, treat entire content as a pattern
    if (blocks.length === 0 && content.trim()) {
      blocks.push(content.trim())
    }

    return blocks
  }

  /**
   * Scan for additional nested AGENTS.md files not in packages
   */
  private async scanForNestedAgents(
    dir: string,
    existing: NestedAgents[]
  ): Promise<NestedAgents[]> {
    const found: NestedAgents[] = []
    const existingPaths = new Set(existing.map((a) => a.path))

    const scan = async (currentDir: string, depth: number): Promise<void> => {
      // Limit depth to avoid infinite recursion
      if (depth > 5) return

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true })

        for (const entry of entries) {
          // Skip common non-project directories
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'coverage'
          ) {
            continue
          }

          if (entry.isDirectory()) {
            const subDir = path.join(currentDir, entry.name)
            const agentsPath = path.join(subDir, 'AGENTS.md')

            if ((await fileHelper.fileExists(agentsPath)) && !existingPaths.has(agentsPath)) {
              // Find parent agents file (closest ancestor with AGENTS.md)
              const parent = this.findParentAgents(agentsPath, existing.concat(found))
              const agents = await this.loadAgents(agentsPath, parent)
              found.push(agents)
              existingPaths.add(agentsPath)

              if (parent) {
                parent.children.push(agents)
              }
            }

            // Continue scanning subdirectories
            await scan(subDir, depth + 1)
          }
        }
      } catch {
        // Permission denied or other error, skip
      }
    }

    await scan(dir, 0)
    return found
  }

  /**
   * Find the parent agents file for a given path
   */
  private findParentAgents(filePath: string, agentFiles: NestedAgents[]): NestedAgents | null {
    const fileDir = path.dirname(filePath)

    // Sort by depth descending to find closest parent
    const sorted = [...agentFiles].sort((a, b) => b.depth - a.depth)

    for (const agents of sorted) {
      const agentsDir = path.dirname(agents.path)
      if (fileDir.startsWith(agentsDir) && fileDir !== agentsDir) {
        return agents
      }
    }

    return null
  }

  /**
   * Resolve agents for a specific path by merging parent agent definitions
   * Deeper files take precedence (can override parent agents)
   */
  async resolveAgentsForPath(targetPath: string): Promise<ResolvedAgents> {
    const agentFiles = await this.discoverAgentFiles()

    // Find the most specific agents file for this path
    const targetDir = path.resolve(targetPath)
    let bestMatch: NestedAgents | null = null

    for (const agents of agentFiles) {
      const agentsDir = path.dirname(agents.path)
      if (targetDir.startsWith(agentsDir)) {
        if (!bestMatch || agents.depth > bestMatch.depth) {
          bestMatch = agents
        }
      }
    }

    if (!bestMatch) {
      return {
        agents: [],
        sources: [],
        overrides: [],
      }
    }

    // Build inheritance chain (from root to leaf)
    const chain: NestedAgents[] = []
    let current: NestedAgents | null = bestMatch
    while (current) {
      chain.unshift(current)
      current = current.parent
    }

    // Merge agents following inheritance
    return this.mergeAgentsChain(chain)
  }

  /**
   * Merge a chain of agent files following inheritance rules
   */
  private mergeAgentsChain(chain: NestedAgents[]): ResolvedAgents {
    const mergedAgents = new Map<string, AgentDefinition>()
    const sources: string[] = []
    const overrides: string[] = []

    for (const agentFile of chain) {
      sources.push(agentFile.relativePath)

      for (const agent of agentFile.agents) {
        const existing = mergedAgents.get(agent.name)

        if (agent.override || !existing) {
          // Override or new agent
          mergedAgents.set(agent.name, { ...agent })
          if (agent.override && existing) {
            overrides.push(`${agentFile.relativePath}:${agent.name}`)
          }
        } else {
          // Merge with existing agent
          const merged: AgentDefinition = { ...existing }

          // Append arrays
          if (agent.triggers) {
            merged.triggers = [...(existing.triggers || []), ...agent.triggers]
          }
          if (agent.rules) {
            merged.rules = [...(existing.rules || []), ...agent.rules]
          }
          if (agent.patterns) {
            merged.patterns = [...(existing.patterns || []), ...agent.patterns]
          }
          if (agent.examples) {
            merged.examples = [...(existing.examples || []), ...agent.examples]
          }

          // Override scalar values if provided
          if (agent.description) {
            merged.description = `${existing.description}\n\n${agent.description}`
          }
          if (agent.domain) {
            merged.domain = agent.domain
          }

          mergedAgents.set(agent.name, merged)
        }
      }
    }

    return {
      agents: Array.from(mergedAgents.values()),
      sources,
      overrides,
    }
  }

  /**
   * Get agents for a specific monorepo package
   */
  async getPackageAgents(packageName: string): Promise<ResolvedAgents | null> {
    if (!this.monoInfo?.isMonorepo) {
      return null
    }

    const pkg = this.monoInfo.packages.find((p) => p.name === packageName)
    if (!pkg) {
      return null
    }

    return this.resolveAgentsForPath(pkg.path)
  }

  /**
   * Get all package agents in the monorepo
   */
  async getAllPackageAgents(): Promise<Map<string, ResolvedAgents>> {
    const results = new Map<string, ResolvedAgents>()

    if (!this.monoInfo?.isMonorepo) {
      return results
    }

    for (const pkg of this.monoInfo.packages) {
      const agents = await this.resolveAgentsForPath(pkg.path)
      results.set(pkg.name, agents)
    }

    return results
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default NestedContextResolver
