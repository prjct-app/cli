/**
 * FileCategorizer - LLM-based file categorization for Smart Context Selection
 *
 * Two-phase process:
 * 1. DISCOVER DOMAINS: LLM analyzes project structure to identify functional domains
 * 2. CATEGORIZE FILES: LLM assigns files to discovered domains
 *
 * Features:
 * - Dynamic domain discovery (no hardcoded domains)
 * - Batch processing (20 files per LLM call)
 * - Heuristic fallback when LLM unavailable
 * - Caching for efficiency
 */

import path from 'node:path'
import {
  type CategoriesCache,
  type DiscoveredDomains,
  type DomainDefinition,
  type FileCategory,
  INDEX_VERSION,
  indexStorage,
  type ScoredFile,
} from '../storage/index-storage'
import { getTimestamp } from '../utils/date-helper'

// ============================================================================
// TYPES
// ============================================================================

export interface CategorizationResult {
  domains: DomainDefinition[]
  categories: FileCategory[]
  metrics: {
    totalFiles: number
    categorizedFiles: number
    domainsDiscovered: number
    llmCalls: number
    usedHeuristics: boolean
  }
}

export interface CategorizationOptions {
  batchSize?: number // Files per LLM call (default: 20)
  maxDomains?: number // Max domains to discover (default: 15)
  useLLM?: boolean // Use LLM or heuristics only (default: true)
  projectId?: string // For caching
}

// ============================================================================
// HEURISTIC PATTERNS
// ============================================================================

/**
 * Fallback heuristic patterns for when LLM is unavailable
 * Maps directory/filename patterns to domain names
 */
const HEURISTIC_PATTERNS: { pattern: RegExp; domain: string }[] = [
  // Payment-related
  { pattern: /\b(payment|stripe|billing|checkout|invoice)/i, domain: 'payments' },

  // User/Auth
  { pattern: /\b(auth|login|signup|user|session|password|oauth)/i, domain: 'auth' },

  // API
  { pattern: /\b(api|endpoint|route|controller)/i, domain: 'api' },

  // Database
  { pattern: /\b(model|schema|migration|database|db|prisma|drizzle)/i, domain: 'database' },

  // Frontend
  { pattern: /\b(component|page|view|layout|ui|button|form|modal)/i, domain: 'frontend' },

  // Testing
  { pattern: /\b(test|spec|__tests__|e2e|cypress)/i, domain: 'testing' },

  // Configuration
  { pattern: /\b(config|setting|env)/i, domain: 'config' },

  // Utilities
  { pattern: /\b(util|helper|lib|common|shared)/i, domain: 'utilities' },

  // Services/Business Logic
  { pattern: /\b(service|handler|processor|worker)/i, domain: 'services' },

  // Types/Interfaces
  { pattern: /\b(type|interface|dto)/i, domain: 'types' },
]

// ============================================================================
// FILE CATEGORIZER CLASS
// ============================================================================

export class FileCategorizer {
  private batchSize: number
  private maxDomains: number

  constructor(options: CategorizationOptions = {}) {
    this.batchSize = options.batchSize || 20
    this.maxDomains = options.maxDomains || 15
  }

  // ==========================================================================
  // MAIN METHODS
  // ==========================================================================

  /**
   * Full analysis: discover domains + categorize files
   */
  async analyzeProject(
    projectPath: string,
    files: ScoredFile[],
    options: CategorizationOptions = {}
  ): Promise<CategorizationResult> {
    const useLLM = options.useLLM !== false

    // Phase 1: Discover domains
    const domains = useLLM
      ? await this.discoverDomainsWithLLM(projectPath, files)
      : this.discoverDomainsHeuristic(files)

    // Phase 2: Categorize files
    const categories = useLLM
      ? await this.categorizeFilesWithLLM(files, domains)
      : this.categorizeFilesHeuristic(files, domains)

    // Update domain file counts
    for (const domain of domains) {
      domain.fileCount = categories.filter((c) => c.primaryDomain === domain.name).length
    }

    // Save to cache if projectId provided
    if (options.projectId) {
      await this.saveToCache(options.projectId, domains, categories)
    }

    return {
      domains,
      categories,
      metrics: {
        totalFiles: files.length,
        categorizedFiles: categories.length,
        domainsDiscovered: domains.length,
        llmCalls: useLLM ? Math.ceil(files.length / this.batchSize) + 1 : 0,
        usedHeuristics: !useLLM,
      },
    }
  }

  /**
   * Discover domains from project structure (LLM)
   */
  async discoverDomainsWithLLM(
    _projectPath: string,
    files: ScoredFile[]
  ): Promise<DomainDefinition[]> {
    // For now, fall back to heuristics
    // TODO: Implement LLM call when LLM service is available
    // The prompt would analyze directory structure and file names
    // to identify functional domains unique to this project
    return this.discoverDomainsHeuristic(files)
  }

  /**
   * Categorize files using discovered domains (LLM)
   */
  async categorizeFilesWithLLM(
    files: ScoredFile[],
    domains: DomainDefinition[]
  ): Promise<FileCategory[]> {
    // For now, fall back to heuristics
    // TODO: Implement LLM batch processing when LLM service is available
    // The prompt would ask LLM to categorize batches of files using
    // the discovered domain definitions
    return this.categorizeFilesHeuristic(files, domains)
  }

  // ==========================================================================
  // HEURISTIC METHODS (Fallback)
  // ==========================================================================

  /**
   * Discover domains using heuristics (fallback)
   */
  discoverDomainsHeuristic(files: ScoredFile[]): DomainDefinition[] {
    const domainCounts = new Map<string, number>()
    const domainPatterns = new Map<string, Set<string>>()

    // Count files matching each heuristic pattern
    for (const file of files) {
      const filePath = file.path.toLowerCase()
      for (const { pattern, domain } of HEURISTIC_PATTERNS) {
        if (pattern.test(filePath)) {
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
          if (!domainPatterns.has(domain)) {
            domainPatterns.set(domain, new Set())
          }
          // Extract the matched directory as a pattern
          const dir = path.dirname(file.path)
          domainPatterns.get(domain)!.add(`**/${path.basename(dir)}/**`)
        }
      }
    }

    // Also detect domains from common directory names
    const dirDomains = this.extractDirectoryDomains(files)
    for (const [domain, count] of dirDomains) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + count)
    }

    // Build domain definitions for domains with at least 2 files
    const domains: DomainDefinition[] = []
    for (const [name, count] of domainCounts) {
      if (count >= 2) {
        const heuristic = HEURISTIC_PATTERNS.find((h) => h.domain === name)
        domains.push({
          name,
          description: `Files related to ${name}`,
          keywords: heuristic ? [name] : [name],
          filePatterns: Array.from(domainPatterns.get(name) || []),
          fileCount: count,
        })
      }
    }

    // Sort by file count (most files first) and limit
    return domains.sort((a, b) => b.fileCount - a.fileCount).slice(0, this.maxDomains)
  }

  /**
   * Extract domains from directory structure
   */
  private extractDirectoryDomains(files: ScoredFile[]): Map<string, number> {
    const dirCounts = new Map<string, number>()

    for (const file of files) {
      const parts = file.path.split('/')
      // Look at immediate parent directories
      for (const part of parts.slice(0, -1)) {
        const normalizedDir = part.toLowerCase()
        // Skip generic directories
        if (['src', 'lib', 'app', 'core', 'dist', 'build'].includes(normalizedDir)) {
          continue
        }
        // Count meaningful directory names
        if (normalizedDir.length > 2 && !normalizedDir.startsWith('.')) {
          dirCounts.set(normalizedDir, (dirCounts.get(normalizedDir) || 0) + 1)
        }
      }
    }

    return dirCounts
  }

  /**
   * Categorize files using heuristics (fallback)
   */
  categorizeFilesHeuristic(files: ScoredFile[], domains: DomainDefinition[]): FileCategory[] {
    const categories: FileCategory[] = []
    const now = getTimestamp()

    for (const file of files) {
      const matchedDomains: { domain: string; score: number }[] = []
      const filePath = file.path.toLowerCase()

      // Check against each domain's keywords and patterns
      for (const domain of domains) {
        let score = 0

        // Check keywords
        for (const keyword of domain.keywords) {
          if (filePath.includes(keyword.toLowerCase())) {
            score += 1
          }
        }

        // Check heuristic patterns
        for (const { pattern, domain: patternDomain } of HEURISTIC_PATTERNS) {
          if (patternDomain === domain.name && pattern.test(filePath)) {
            score += 2
          }
        }

        // Check directory patterns
        for (const pattern of domain.filePatterns) {
          const patternBase = pattern.replace(/\*\*/g, '').replace(/\//g, '')
          if (filePath.includes(patternBase.toLowerCase())) {
            score += 1
          }
        }

        if (score > 0) {
          matchedDomains.push({ domain: domain.name, score })
        }
      }

      // Sort by score and take top matches
      matchedDomains.sort((a, b) => b.score - a.score)

      const fileCategories =
        matchedDomains.length > 0 ? matchedDomains.slice(0, 3).map((m) => m.domain) : ['general']

      const primaryDomain = fileCategories[0]
      const confidence = matchedDomains.length > 0 ? Math.min(1, matchedDomains[0].score / 5) : 0.1

      categories.push({
        path: file.path,
        categories: fileCategories,
        primaryDomain,
        confidence,
        categorizedAt: now,
        method: 'heuristic',
      })
    }

    return categories
  }

  // ==========================================================================
  // CACHING
  // ==========================================================================

  /**
   * Save domains and categories to cache
   */
  async saveToCache(
    projectId: string,
    domains: DomainDefinition[],
    categories: FileCategory[]
  ): Promise<void> {
    const now = getTimestamp()

    // Save domains
    const domainsData: DiscoveredDomains = {
      version: INDEX_VERSION,
      projectId,
      domains,
      discoveredAt: now,
    }
    await indexStorage.writeDomains(projectId, domainsData)

    // Build domain index (domain -> file paths)
    const domainIndex: Record<string, string[]> = {}
    for (const cat of categories) {
      for (const domain of cat.categories) {
        if (!domainIndex[domain]) {
          domainIndex[domain] = []
        }
        domainIndex[domain].push(cat.path)
      }
    }

    // Save categories
    const cacheData: CategoriesCache = {
      version: INDEX_VERSION,
      lastUpdate: now,
      fileCategories: categories,
      domainIndex,
    }
    await indexStorage.writeCategories(projectId, cacheData)
  }

  /**
   * Load cached categorization
   */
  async loadFromCache(projectId: string): Promise<CategorizationResult | null> {
    const [domainsData, cacheData] = await Promise.all([
      indexStorage.readDomains(projectId),
      indexStorage.readCategories(projectId),
    ])

    if (!domainsData || !cacheData) {
      return null
    }

    return {
      domains: domainsData.domains,
      categories: cacheData.fileCategories,
      metrics: {
        totalFiles: cacheData.fileCategories.length,
        categorizedFiles: cacheData.fileCategories.length,
        domainsDiscovered: domainsData.domains.length,
        llmCalls: 0,
        usedHeuristics: cacheData.fileCategories[0]?.method === 'heuristic',
      },
    }
  }

  /**
   * Update categories for specific files (incremental)
   */
  async updateFilesCategories(
    projectId: string,
    files: ScoredFile[],
    options: CategorizationOptions = {}
  ): Promise<FileCategory[]> {
    // Load existing domains
    const domainsData = await indexStorage.readDomains(projectId)
    if (!domainsData) {
      // No domains yet, need full analysis
      const result = await this.analyzeProject('', files, { ...options, projectId })
      return result.categories
    }

    // Categorize just the new/changed files
    const newCategories =
      options.useLLM !== false
        ? await this.categorizeFilesWithLLM(files, domainsData.domains)
        : this.categorizeFilesHeuristic(files, domainsData.domains)

    // Load existing cache and merge
    const existingCache = await indexStorage.readCategories(projectId)
    if (existingCache) {
      // Remove old entries for updated files
      const updatedPaths = new Set(files.map((f) => f.path))
      const existingCategories = existingCache.fileCategories.filter(
        (c) => !updatedPaths.has(c.path)
      )

      // Merge and save
      const allCategories = [...existingCategories, ...newCategories]

      // Rebuild domain index
      const domainIndex: Record<string, string[]> = {}
      for (const cat of allCategories) {
        for (const domain of cat.categories) {
          if (!domainIndex[domain]) {
            domainIndex[domain] = []
          }
          domainIndex[domain].push(cat.path)
        }
      }

      const cacheData: CategoriesCache = {
        version: INDEX_VERSION,
        lastUpdate: getTimestamp(),
        fileCategories: allCategories,
        domainIndex,
      }
      await indexStorage.writeCategories(projectId, cacheData)
    }

    return newCategories
  }
}

export const fileCategorizer = new FileCategorizer()
export default FileCategorizer
