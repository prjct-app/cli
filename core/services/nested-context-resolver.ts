/**
 * NestedContextResolver - Discovers and resolves nested PRJCT.md files in monorepos
 *
 * Responsible for:
 * - Finding all PRJCT.md files in a monorepo
 * - Building a hierarchy of context (root → packages)
 * - Resolving inheritance between parent and child contexts
 *
 * Pattern from OpenAI Codex AGENTS.md: "Scope = directory tree. Deeper files take precedence."
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager, {
  type MonorepoInfo,
  type MonorepoPackage,
} from '../infrastructure/path-manager'
import * as fileHelper from '../utils/file-helper'

// ============================================================================
// TYPES
// ============================================================================

export interface NestedContext {
  /** Absolute path to the PRJCT.md file */
  path: string
  /** Relative path from monorepo root */
  relativePath: string
  /** Depth in the directory tree (0 = root) */
  depth: number
  /** Parent context (null for root) */
  parent: NestedContext | null
  /** Child contexts */
  children: NestedContext[]
  /** Raw content of the PRJCT.md file */
  content: string
  /** Parsed sections from the PRJCT.md */
  sections: ContextSection[]
  /** Associated package info (if in a monorepo package) */
  package: MonorepoPackage | null
}

export interface ContextSection {
  /** Section name (e.g., "Rules", "Patterns", "Stack") */
  name: string
  /** Section content */
  content: string
  /** Whether this section should override parent */
  override: boolean
}

export interface ResolvedContext {
  /** The final merged content */
  content: string
  /** Sources that contributed to this context (from root to leaf) */
  sources: string[]
  /** Sections that were overridden */
  overrides: string[]
}

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
}

// ============================================================================
// EXPORTS
// ============================================================================

export default NestedContextResolver
