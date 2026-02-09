/**
 * IndexStorage - Persistent storage for ProjectIndex (PRJ-303: SQLite-backed)
 *
 * Write path: SQLite index_meta (primary)
 * Read path: SQLite index_meta → null/default
 *
 * Stores:
 * - project-index: Main index data
 * - file-scores: Calculated scores
 * - checksums: For detecting file changes
 * - domains: Discovered project domains
 * - categories-cache: File categorization cache
 *
 * Location: SQLite DB at ~/.prjct-cli/projects/{projectId}/prjct.db
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'
import { getTimestamp } from '../utils/date-helper'
import { prjctDb } from './database'

// Note: fs, path, pathManager, isNotFoundError still needed for clearIndex, calculateChecksum

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageStats {
  count: number // Number of files
  totalLines: number // Total lines of code
  totalSize: number // Total bytes
}

export interface ConfigFileEntry {
  path: string
  type: string // "package.json", "Cargo.toml", etc.
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
  mtime: string // ISO timestamp
  categories?: string[] // Domain categories: ['payments', 'api', 'backend']
}

export interface DetectedPattern {
  name: string // "monorepo", "api-first", "component-based"
  confidence: number // 0-1
  evidence: string[] // Files/dirs that evidence this pattern
}

export interface DetectedStack {
  ecosystem: string // "JavaScript", "Python", "Rust", etc.
  frameworks: string[] // Detected frameworks
  hasTests: boolean
  hasDocker: boolean
  hasCi: boolean
  buildTool: string | null
}

export interface ProjectIndex {
  version: string
  projectPath: string
  lastFullScan: string // ISO timestamp
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
  totalSize: number // Total bytes
  totalLines: number // Total LOC
  scanDuration: number // ms
}

export interface FileChecksums {
  version: string
  lastUpdated: string
  checksums: Record<string, string> // path -> checksum
}

// ============================================================================
// DOMAIN & CATEGORY TYPES (for Smart Context Selection)
// ============================================================================

/**
 * A domain discovered by LLM analysis of the project
 */
export interface DomainDefinition {
  name: string // "payments", "shipping", "inventory"
  description: string // "Handles payment processing, Stripe integration"
  keywords: string[] // ["stripe", "checkout", "billing"]
  filePatterns: string[] // ["**/payments/**", "**/billing/**"]
  fileCount: number // Number of files in this domain
}

/**
 * Discovered domains for a project
 */
export interface DiscoveredDomains {
  version: string
  projectId: string
  domains: DomainDefinition[]
  discoveredAt: string // ISO timestamp
}

/**
 * Category assignment for a single file
 */
export interface FileCategory {
  path: string
  categories: string[] // ['payments', 'users', 'api']
  primaryDomain: string // 'payments'
  confidence: number // 0-1
  categorizedAt: string // ISO timestamp
  method: 'llm' | 'heuristic' // How it was categorized
}

/**
 * Cache of file categorizations
 */
export interface CategoriesCache {
  version: string
  lastUpdate: string
  fileCategories: FileCategory[]
  domainIndex: Record<string, string[]> // domain -> file paths
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
   * Read the project index.
   * Path: SQLite index_meta → null
   */
  async readIndex(projectId: string): Promise<ProjectIndex | null> {
    try {
      const data = this.getIndexMeta<ProjectIndex>(projectId, 'project-index')
      if (data !== null) {
        if (data.version !== INDEX_VERSION) return null
        return data
      }
    } catch {
      // SQLite not available
    }
    return null
  }

  /**
   * Write the project index to SQLite.
   */
  async writeIndex(projectId: string, index: ProjectIndex): Promise<void> {
    this.setIndexMeta(projectId, 'project-index', index)
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
   * Read file checksums.
   * Path: SQLite index_meta → default
   */
  async readChecksums(projectId: string): Promise<FileChecksums> {
    try {
      const data = this.getIndexMeta<FileChecksums>(projectId, 'checksums')
      if (data !== null) return data
    } catch {
      // SQLite not available
    }
    return getDefaultChecksums()
  }

  /**
   * Write file checksums to SQLite.
   */
  async writeChecksums(projectId: string, checksums: FileChecksums): Promise<void> {
    this.setIndexMeta(projectId, 'checksums', checksums)
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
    currentFiles: Map<string, string> // path -> checksum
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
   * Read file scores.
   * Path: SQLite index_meta → []
   */
  async readScores(projectId: string): Promise<ScoredFile[]> {
    try {
      const data = this.getIndexMeta<{ scores: ScoredFile[] }>(projectId, 'file-scores')
      if (data !== null) return data.scores || []
    } catch {
      // SQLite not available
    }
    return []
  }

  /**
   * Write file scores to SQLite.
   */
  async writeScores(projectId: string, scores: ScoredFile[]): Promise<void> {
    const data = {
      version: INDEX_VERSION,
      lastUpdated: getTimestamp(),
      scores,
    }

    this.setIndexMeta(projectId, 'file-scores', data)
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Clear all index data for a project (SQLite + JSON files)
   */
  async clearIndex(projectId: string): Promise<void> {
    // Clear from SQLite index_meta
    try {
      const db = prjctDb.getDb(projectId)
      db.prepare('DELETE FROM index_meta').run()
    } catch {
      // SQLite not available — continue with JSON cleanup
    }

    // Clear JSON files
    const indexPath = this.getIndexPath(projectId)

    try {
      const files = await fs.readdir(indexPath)
      await Promise.all(files.map((file) => fs.unlink(path.join(indexPath, file))))
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
   * Read discovered domains for a project.
   * Path: SQLite index_meta → null
   */
  async readDomains(projectId: string): Promise<DiscoveredDomains | null> {
    try {
      const data = this.getIndexMeta<DiscoveredDomains>(projectId, 'domains')
      if (data !== null) {
        if (data.version !== INDEX_VERSION) return null
        return data
      }
    } catch {
      // SQLite not available
    }
    return null
  }

  /**
   * Write discovered domains to SQLite.
   */
  async writeDomains(projectId: string, domains: DiscoveredDomains): Promise<void> {
    this.setIndexMeta(projectId, 'domains', domains)
  }

  // ==========================================================================
  // CATEGORIES CACHE
  // ==========================================================================

  /**
   * Read categories cache.
   * Path: SQLite index_meta → null
   */
  async readCategories(projectId: string): Promise<CategoriesCache | null> {
    try {
      const data = this.getIndexMeta<CategoriesCache>(projectId, 'categories-cache')
      if (data !== null) {
        if (data.version !== INDEX_VERSION) return null
        return data
      }
    } catch {
      // SQLite not available
    }
    return null
  }

  /**
   * Write categories cache to SQLite.
   */
  async writeCategories(projectId: string, cache: CategoriesCache): Promise<void> {
    this.setIndexMeta(projectId, 'categories-cache', cache)
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

  // ==========================================================================
  // SQLite index_meta helpers
  // ==========================================================================

  /**
   * Read a document from the index_meta table.
   */
  private getIndexMeta<T>(projectId: string, key: string): T | null {
    const db = prjctDb.getDb(projectId)
    const row = db.prepare('SELECT data FROM index_meta WHERE key = ?').get(key) as {
      data: string
    } | null
    if (!row) return null
    return JSON.parse(row.data) as T
  }

  /**
   * Write a document to the index_meta table.
   */
  private setIndexMeta<T>(projectId: string, key: string, data: T): void {
    const db = prjctDb.getDb(projectId)
    const json = JSON.stringify(data)
    const now = new Date().toISOString()
    db.prepare('INSERT OR REPLACE INTO index_meta (key, data, updated_at) VALUES (?, ?, ?)').run(
      key,
      json,
      now
    )
  }
}

export const indexStorage = new IndexStorage()
export default indexStorage
