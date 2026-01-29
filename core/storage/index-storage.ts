/**
 * IndexStorage - Persistent storage for ProjectIndex
 *
 * Stores:
 * - project-index.json: Main index data
 * - file-scores.json: Calculated scores
 * - checksums.json: For detecting file changes
 *
 * Location: ~/.prjct-cli/projects/{projectId}/index/
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import pathManager from '../infrastructure/path-manager'
import { getTimestamp } from '../utils/date-helper'
import { isNotFoundError } from '../types/fs'

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageStats {
  count: number         // Number of files
  totalLines: number    // Total lines of code
  totalSize: number     // Total bytes
}

export interface ConfigFileEntry {
  path: string
  type: string          // "package.json", "Cargo.toml", etc.
  checksum: string
  parsed?: Record<string, unknown>
}

export interface DirectoryEntry {
  path: string
  type: 'source' | 'test' | 'config' | 'build' | 'vendor' | 'docs' | 'unknown'
  fileCount: number
}

export interface ScoredFile {
  path: string
  score: number
  size: number
  mtime: string         // ISO timestamp
  categories?: string[] // Domain categories: ['payments', 'api', 'backend']
}

export interface DetectedPattern {
  name: string          // "monorepo", "api-first", "component-based"
  confidence: number    // 0-1
  evidence: string[]    // Files/dirs that evidence this pattern
}

export interface DetectedStack {
  ecosystem: string           // "JavaScript", "Python", "Rust", etc.
  frameworks: string[]        // Detected frameworks
  hasTests: boolean
  hasDocker: boolean
  hasCi: boolean
  buildTool: string | null
}

export interface ProjectIndex {
  version: string
  projectPath: string
  lastFullScan: string        // ISO timestamp
  lastIncrementalUpdate: string // ISO timestamp

  // Language detection by extension
  languages: Record<string, LanguageStats>

  // Config files found
  configFiles: ConfigFileEntry[]

  // Directory structure (top-level relevant)
  directories: DirectoryEntry[]

  // Files with score > threshold
  relevantFiles: ScoredFile[]

  // Detected patterns
  patterns: DetectedPattern[]

  // Stack detection
  detectedStack: DetectedStack

  // Metrics
  totalFiles: number
  totalSize: number           // Total bytes
  totalLines: number          // Total LOC
  scanDuration: number        // ms
}

export interface FileChecksums {
  version: string
  lastUpdated: string
  checksums: Record<string, string>  // path -> checksum
}

// ============================================================================
// DOMAIN & CATEGORY TYPES (for Smart Context Selection)
// ============================================================================

/**
 * A domain discovered by LLM analysis of the project
 */
export interface DomainDefinition {
  name: string           // "payments", "shipping", "inventory"
  description: string    // "Handles payment processing, Stripe integration"
  keywords: string[]     // ["stripe", "checkout", "billing"]
  filePatterns: string[] // ["**/payments/**", "**/billing/**"]
  fileCount: number      // Number of files in this domain
}

/**
 * Discovered domains for a project
 */
export interface DiscoveredDomains {
  version: string
  projectId: string
  domains: DomainDefinition[]
  discoveredAt: string   // ISO timestamp
}

/**
 * Category assignment for a single file
 */
export interface FileCategory {
  path: string
  categories: string[]       // ['payments', 'users', 'api']
  primaryDomain: string      // 'payments'
  confidence: number         // 0-1
  categorizedAt: string      // ISO timestamp
  method: 'llm' | 'heuristic' // How it was categorized
}

/**
 * Cache of file categorizations
 */
export interface CategoriesCache {
  version: string
  lastUpdate: string
  fileCategories: FileCategory[]
  domainIndex: Record<string, string[]>  // domain -> file paths
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const INDEX_VERSION = '1.0.0'

export function getDefaultIndex(projectPath: string): ProjectIndex {
  return {
    version: INDEX_VERSION,
    projectPath,
    lastFullScan: '',
    lastIncrementalUpdate: '',
    languages: {},
    configFiles: [],
    directories: [],
    relevantFiles: [],
    patterns: [],
    detectedStack: {
      ecosystem: 'unknown',
      frameworks: [],
      hasTests: false,
      hasDocker: false,
      hasCi: false,
      buildTool: null,
    },
    totalFiles: 0,
    totalSize: 0,
    totalLines: 0,
    scanDuration: 0,
  }
}

export function getDefaultChecksums(): FileChecksums {
  return {
    version: INDEX_VERSION,
    lastUpdated: '',
    checksums: {},
  }
}

// ============================================================================
// INDEX STORAGE CLASS
// ============================================================================

class IndexStorage {
  /**
   * Get the index directory path for a project
   */
  getIndexPath(projectId: string): string {
    return path.join(pathManager.getGlobalProjectPath(projectId), 'index')
  }

  /**
   * Ensure index directory exists
   */
  async ensureIndexDir(projectId: string): Promise<string> {
    const indexPath = this.getIndexPath(projectId)
    await fs.mkdir(indexPath, { recursive: true })
    return indexPath
  }

  // ==========================================================================
  // PROJECT INDEX
  // ==========================================================================

  /**
   * Read the project index
   */
  async readIndex(projectId: string): Promise<ProjectIndex | null> {
    const filePath = path.join(this.getIndexPath(projectId), 'project-index.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const index = JSON.parse(content) as ProjectIndex

      // Version check
      if (index.version !== INDEX_VERSION) {
        // Index is outdated, return null to trigger full rescan
        return null
      }

      return index
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Write the project index
   */
  async writeIndex(projectId: string, index: ProjectIndex): Promise<void> {
    await this.ensureIndexDir(projectId)
    const filePath = path.join(this.getIndexPath(projectId), 'project-index.json')
    await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8')
  }

  /**
   * Check if index exists and is valid
   */
  async hasValidIndex(projectId: string): Promise<boolean> {
    const index = await this.readIndex(projectId)
    return index !== null && index.lastFullScan !== ''
  }

  // ==========================================================================
  // FILE CHECKSUMS
  // ==========================================================================

  /**
   * Read file checksums
   */
  async readChecksums(projectId: string): Promise<FileChecksums> {
    const filePath = path.join(this.getIndexPath(projectId), 'checksums.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as FileChecksums
    } catch (error) {
      if (isNotFoundError(error)) {
        return getDefaultChecksums()
      }
      throw error
    }
  }

  /**
   * Write file checksums
   */
  async writeChecksums(projectId: string, checksums: FileChecksums): Promise<void> {
    await this.ensureIndexDir(projectId)
    const filePath = path.join(this.getIndexPath(projectId), 'checksums.json')
    await fs.writeFile(filePath, JSON.stringify(checksums, null, 2), 'utf-8')
  }

  /**
   * Calculate checksum for a file
   */
  async calculateChecksum(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  /**
   * Detect changed files by comparing checksums
   */
  async detectChangedFiles(
    projectId: string,
    currentFiles: Map<string, string>  // path -> checksum
  ): Promise<{
    added: string[]
    modified: string[]
    deleted: string[]
  }> {
    const stored = await this.readChecksums(projectId)
    const storedChecksums = stored.checksums

    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []

    // Check current files against stored
    for (const [filePath, checksum] of currentFiles) {
      if (!(filePath in storedChecksums)) {
        added.push(filePath)
      } else if (storedChecksums[filePath] !== checksum) {
        modified.push(filePath)
      }
    }

    // Check for deleted files
    for (const filePath of Object.keys(storedChecksums)) {
      if (!currentFiles.has(filePath)) {
        deleted.push(filePath)
      }
    }

    return { added, modified, deleted }
  }

  // ==========================================================================
  // FILE SCORES
  // ==========================================================================

  /**
   * Read file scores
   */
  async readScores(projectId: string): Promise<ScoredFile[]> {
    const filePath = path.join(this.getIndexPath(projectId), 'file-scores.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as { scores: ScoredFile[] }
      return data.scores || []
    } catch (error) {
      if (isNotFoundError(error)) {
        return []
      }
      throw error
    }
  }

  /**
   * Write file scores
   */
  async writeScores(projectId: string, scores: ScoredFile[]): Promise<void> {
    await this.ensureIndexDir(projectId)
    const filePath = path.join(this.getIndexPath(projectId), 'file-scores.json')
    const data = {
      version: INDEX_VERSION,
      lastUpdated: getTimestamp(),
      scores,
    }
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Clear all index data for a project
   */
  async clearIndex(projectId: string): Promise<void> {
    const indexPath = this.getIndexPath(projectId)

    try {
      const files = await fs.readdir(indexPath)
      await Promise.all(
        files.map(file => fs.unlink(path.join(indexPath, file)))
      )
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  /**
   * Get index age in hours
   */
  async getIndexAge(projectId: string): Promise<number> {
    const index = await this.readIndex(projectId)
    if (!index || !index.lastFullScan) {
      return Infinity
    }

    const lastScan = new Date(index.lastFullScan)
    const now = new Date()
    return (now.getTime() - lastScan.getTime()) / (1000 * 60 * 60)
  }

  // ==========================================================================
  // DISCOVERED DOMAINS
  // ==========================================================================

  /**
   * Read discovered domains for a project
   */
  async readDomains(projectId: string): Promise<DiscoveredDomains | null> {
    const filePath = path.join(this.getIndexPath(projectId), 'domains.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const domains = JSON.parse(content) as DiscoveredDomains

      // Version check
      if (domains.version !== INDEX_VERSION) {
        return null
      }

      return domains
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Write discovered domains
   */
  async writeDomains(projectId: string, domains: DiscoveredDomains): Promise<void> {
    await this.ensureIndexDir(projectId)
    const filePath = path.join(this.getIndexPath(projectId), 'domains.json')
    await fs.writeFile(filePath, JSON.stringify(domains, null, 2), 'utf-8')
  }

  // ==========================================================================
  // CATEGORIES CACHE
  // ==========================================================================

  /**
   * Read categories cache
   */
  async readCategories(projectId: string): Promise<CategoriesCache | null> {
    const filePath = path.join(this.getIndexPath(projectId), 'categories-cache.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const cache = JSON.parse(content) as CategoriesCache

      // Version check
      if (cache.version !== INDEX_VERSION) {
        return null
      }

      return cache
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Write categories cache
   */
  async writeCategories(projectId: string, cache: CategoriesCache): Promise<void> {
    await this.ensureIndexDir(projectId)
    const filePath = path.join(this.getIndexPath(projectId), 'categories-cache.json')
    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf-8')
  }

  /**
   * Get file categories for specific paths
   */
  async getFileCategories(projectId: string, paths: string[]): Promise<Map<string, string[]>> {
    const cache = await this.readCategories(projectId)
    const result = new Map<string, string[]>()

    if (!cache) {
      return result
    }

    const pathSet = new Set(paths)
    for (const fc of cache.fileCategories) {
      if (pathSet.has(fc.path)) {
        result.set(fc.path, fc.categories)
      }
    }

    return result
  }

  /**
   * Get files by domain
   */
  async getFilesByDomain(projectId: string, domain: string): Promise<string[]> {
    const cache = await this.readCategories(projectId)
    if (!cache) {
      return []
    }

    return cache.domainIndex[domain] || []
  }
}

export const indexStorage = new IndexStorage()
export default indexStorage
