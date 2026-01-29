/**
 * ProjectIndex - Persistent Project Scanner with Scoring
 *
 * Features:
 * - Full scan: Analyzes entire project, caches results
 * - Incremental update: Only re-scans changed files
 * - Relevance scoring: Prioritizes important files
 * - Pattern detection: Identifies project architecture
 *
 * Usage:
 * - sync-service calls fullScan() on first sync
 * - Subsequent syncs use incrementalUpdate() or cached index
 * - watch-service uses incrementalUpdate() for changed files
 *
 * Storage location: ~/.prjct-cli/projects/{projectId}/index/
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  type ConfigFileEntry,
  type DetectedPattern,
  type DetectedStack,
  type DirectoryEntry,
  getDefaultIndex,
  INDEX_VERSION,
  indexStorage,
  type LanguageStats,
  type ProjectIndex,
  type ScoredFile,
} from '../storage/index-storage'
import { getTimestamp } from '../utils/date-helper'
import { type FileStats, fileScorer, RELEVANCE_THRESHOLD, type ScoringContext } from './file-scorer'

const execAsync = promisify(exec)

// ============================================================================
// TYPES
// ============================================================================

export interface IndexOptions {
  forceFullScan?: boolean // Force full scan even if index exists
  maxFiles?: number // Limit number of files to scan (for large repos)
  excludePatterns?: string[] // Additional patterns to exclude
}

export interface ScanResult {
  index: ProjectIndex
  fromCache: boolean
  changedFiles: number
  scanDuration: number
}

export interface RelevantContext {
  files: ScoredFile[]
  estimatedTokens: number
  originalTokens: number
  compressionRate: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Source file extensions to scan
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs', // JavaScript/TypeScript
  '.py',
  '.pyw', // Python
  '.go', // Go
  '.rs', // Rust
  '.java',
  '.kt',
  '.scala', // JVM
  '.c',
  '.cpp',
  '.h',
  '.hpp', // C/C++
  '.rb', // Ruby
  '.php', // PHP
  '.swift', // Swift
  '.cs', // C#
  '.vue',
  '.svelte', // Frontend frameworks
])

// Config file names to track
const CONFIG_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'webpack.config.js',
  'rollup.config.js',
  'esbuild.config.js',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.ts',
  'vitest.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
])

// Directories to ignore
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '__pycache__',
  '.pytest_cache',
  'target', // Rust
  'vendor', // Go/PHP
  '.venv',
  'venv', // Python
  'eggs',
  '*.egg-info',
])

// Directory type detection patterns
const DIR_TYPE_PATTERNS: { type: DirectoryEntry['type']; patterns: RegExp[] }[] = [
  { type: 'test', patterns: [/^tests?$/i, /^__tests__$/i, /^spec$/i, /^e2e$/i] },
  {
    type: 'source',
    patterns: [
      /^src$/i,
      /^lib$/i,
      /^core$/i,
      /^app$/i,
      /^pages$/i,
      /^components$/i,
      /^services$/i,
      /^utils$/i,
    ],
  },
  { type: 'config', patterns: [/^config$/i, /^\.config$/i, /^settings$/i] },
  { type: 'build', patterns: [/^dist$/i, /^build$/i, /^out$/i, /^\.next$/i] },
  { type: 'vendor', patterns: [/^node_modules$/i, /^vendor$/i, /^packages$/i] },
  { type: 'docs', patterns: [/^docs?$/i, /^documentation$/i] },
]

// Pattern detection rules
const PATTERN_DETECTORS: {
  name: string
  detect: (index: ProjectIndex) => number
  evidence: (index: ProjectIndex) => string[]
}[] = [
  {
    name: 'monorepo',
    detect: (idx) => {
      const hasWorkspaces = idx.configFiles.some(
        (cf) => cf.type === 'package.json' && cf.parsed?.workspaces
      )
      const hasPackages = idx.directories.some((d) => d.path === 'packages' || d.path === 'apps')
      return hasWorkspaces ? 0.9 : hasPackages ? 0.7 : 0
    },
    evidence: (idx) => {
      const ev: string[] = []
      if (idx.directories.some((d) => d.path === 'packages')) ev.push('packages/')
      if (idx.directories.some((d) => d.path === 'apps')) ev.push('apps/')
      return ev
    },
  },
  {
    name: 'api-first',
    detect: (idx) => {
      const hasApiDir = idx.directories.some(
        (d) => d.path.includes('api') || d.path.includes('routes')
      )
      const hasOpenApi = idx.configFiles.some(
        (cf) => cf.path.includes('openapi') || cf.path.includes('swagger')
      )
      return hasOpenApi ? 0.9 : hasApiDir ? 0.6 : 0
    },
    evidence: (idx) =>
      idx.directories
        .filter((d) => d.path.includes('api') || d.path.includes('routes'))
        .map((d) => `${d.path}/`),
  },
  {
    name: 'component-based',
    detect: (idx) => {
      const hasComponents = idx.directories.some((d) => d.path.includes('components'))
      const hasReact = idx.detectedStack.frameworks.includes('React')
      const hasVue = idx.detectedStack.frameworks.includes('Vue')
      return hasComponents && (hasReact || hasVue) ? 0.8 : hasComponents ? 0.5 : 0
    },
    evidence: (idx) =>
      idx.directories.filter((d) => d.path.includes('components')).map((d) => `${d.path}/`),
  },
  {
    name: 'serverless',
    detect: (idx) => {
      const hasServerless = idx.configFiles.some(
        (cf) =>
          cf.path.includes('serverless') ||
          cf.path.includes('netlify') ||
          cf.path.includes('vercel')
      )
      const hasLambda = idx.directories.some(
        (d) => d.path.includes('functions') || d.path.includes('lambda')
      )
      return hasServerless ? 0.9 : hasLambda ? 0.6 : 0
    },
    evidence: (idx) =>
      idx.configFiles
        .filter((cf) => cf.path.includes('serverless') || cf.path.includes('vercel'))
        .map((cf) => cf.path),
  },
]

// ============================================================================
// PROJECT INDEXER CLASS
// ============================================================================

export class ProjectIndexer {
  private projectPath: string
  private projectId: string

  constructor(projectPath: string, projectId: string) {
    this.projectPath = projectPath
    this.projectId = projectId
  }

  // ==========================================================================
  // MAIN METHODS
  // ==========================================================================

  /**
   * Perform a full project scan
   * Creates fresh index from scratch
   */
  async fullScan(options: IndexOptions = {}): Promise<ScanResult> {
    const startTime = Date.now()

    // Create fresh index
    const index = getDefaultIndex(this.projectPath)

    // Scan all files
    const allFiles = await this.scanAllFiles(options)
    const filesArray = Array.from(allFiles.values())

    // Build language stats
    index.languages = this.buildLanguageStats(filesArray)

    // Find and parse config files
    index.configFiles = await this.findConfigFiles()

    // Analyze directory structure
    index.directories = await this.analyzeDirectories()

    // Detect stack
    index.detectedStack = await this.detectStack(index.configFiles)

    // Calculate scores
    const context = this.buildScoringContext(allFiles)
    const scores = fileScorer.getRelevantFiles(context, RELEVANCE_THRESHOLD)

    index.relevantFiles = scores.map((s) => ({
      path: s.path,
      score: s.score,
      size: allFiles.get(s.path)?.size || 0,
      mtime: allFiles.get(s.path)?.mtime.toISOString() || '',
    }))

    // Detect patterns
    index.patterns = this.detectPatterns(index)

    // Set metrics
    index.totalFiles = allFiles.size
    index.totalSize = filesArray.reduce((sum, f) => sum + f.size, 0)
    index.totalLines = filesArray.reduce((sum, f) => sum + (f.lines || 0), 0)
    index.scanDuration = Date.now() - startTime

    // Set timestamps
    const now = getTimestamp()
    index.lastFullScan = now
    index.lastIncrementalUpdate = now

    // Persist
    await indexStorage.writeIndex(this.projectId, index)
    await this.saveChecksums(allFiles)
    await indexStorage.writeScores(this.projectId, index.relevantFiles)

    return {
      index,
      fromCache: false,
      changedFiles: allFiles.size,
      scanDuration: index.scanDuration,
    }
  }

  /**
   * Incremental update - only re-scan changed files
   */
  async incrementalUpdate(changedPaths?: string[]): Promise<ScanResult> {
    const startTime = Date.now()

    // Load existing index
    const index = await indexStorage.readIndex(this.projectId)
    if (!index) {
      // No index exists, do full scan
      return this.fullScan()
    }

    // If specific paths provided, use those; otherwise detect changes
    let filesToUpdate: string[]
    if (changedPaths && changedPaths.length > 0) {
      filesToUpdate = changedPaths
    } else {
      const changes = await this.detectFileChanges()
      filesToUpdate = [...changes.added, ...changes.modified]

      // Remove deleted files from index
      if (changes.deleted.length > 0) {
        index.relevantFiles = index.relevantFiles.filter((f) => !changes.deleted.includes(f.path))
      }
    }

    // If no changes, return cached
    if (filesToUpdate.length === 0) {
      return {
        index,
        fromCache: true,
        changedFiles: 0,
        scanDuration: Date.now() - startTime,
      }
    }

    // Scan only changed files
    const updatedFiles = await this.scanFiles(filesToUpdate)

    // Rebuild scoring context with updated files
    const existingFiles = await this.loadExistingFileStats(index)
    for (const [path, stats] of updatedFiles) {
      existingFiles.set(path, stats)
    }

    const context = this.buildScoringContext(existingFiles)
    const scores = fileScorer.getRelevantFiles(context, RELEVANCE_THRESHOLD)

    index.relevantFiles = scores.map((s) => ({
      path: s.path,
      score: s.score,
      size: existingFiles.get(s.path)?.size || 0,
      mtime: existingFiles.get(s.path)?.mtime.toISOString() || '',
    }))

    // Update timestamps
    index.lastIncrementalUpdate = getTimestamp()
    index.scanDuration = Date.now() - startTime

    // Persist
    await indexStorage.writeIndex(this.projectId, index)
    await indexStorage.writeScores(this.projectId, index.relevantFiles)

    return {
      index,
      fromCache: false,
      changedFiles: filesToUpdate.length,
      scanDuration: index.scanDuration,
    }
  }

  /**
   * Load index from cache if valid, otherwise full scan
   */
  async loadOrScan(options: IndexOptions = {}): Promise<ScanResult> {
    if (options.forceFullScan) {
      return this.fullScan(options)
    }

    const index = await indexStorage.readIndex(this.projectId)
    if (index?.lastFullScan) {
      // Check if index is fresh enough (< 24 hours old)
      const age = await indexStorage.getIndexAge(this.projectId)
      if (age < 24) {
        return {
          index,
          fromCache: true,
          changedFiles: 0,
          scanDuration: 0,
        }
      }
    }

    return this.fullScan(options)
  }

  /**
   * Get relevant context for LLM with token estimation
   */
  async getRelevantContext(maxTokens: number = 50000): Promise<RelevantContext> {
    const index = await indexStorage.readIndex(this.projectId)
    if (!index) {
      return {
        files: [],
        estimatedTokens: 0,
        originalTokens: 0,
        compressionRate: 0,
      }
    }

    const CHARS_PER_TOKEN = 4
    let estimatedTokens = 0
    const selectedFiles: ScoredFile[] = []

    // Select files by score until we hit token limit
    for (const file of index.relevantFiles) {
      const fileTokens = Math.ceil(file.size / CHARS_PER_TOKEN)
      if (estimatedTokens + fileTokens > maxTokens) {
        break
      }
      selectedFiles.push(file)
      estimatedTokens += fileTokens
    }

    // Original tokens = total project size
    const originalTokens = Math.ceil(index.totalSize / CHARS_PER_TOKEN)
    const compressionRate =
      originalTokens > 0 ? (originalTokens - estimatedTokens) / originalTokens : 0

    return {
      files: selectedFiles,
      estimatedTokens,
      originalTokens,
      compressionRate,
    }
  }

  // ==========================================================================
  // SCANNING METHODS
  // ==========================================================================

  /**
   * Scan all source files in the project
   */
  private async scanAllFiles(options: IndexOptions = {}): Promise<Map<string, FileStats>> {
    const files = new Map<string, FileStats>()
    const maxFiles = options.maxFiles || 10000

    // Use find command for speed
    try {
      const excludeDirs = Array.from(IGNORE_DIRS)
        .map((d) => `-not -path "*/${d}/*"`)
        .join(' ')
      const extensions = Array.from(SOURCE_EXTENSIONS)
        .map((e) => `-name "*${e}"`)
        .join(' -o ')

      const { stdout } = await execAsync(
        `find . -type f \\( ${extensions} \\) ${excludeDirs} | head -n ${maxFiles}`,
        { cwd: this.projectPath, maxBuffer: 10 * 1024 * 1024 }
      )

      const paths = stdout.trim().split('\n').filter(Boolean)

      // Process files in parallel batches
      const batchSize = 100
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map((p) => this.getFileStats(p.replace(/^\.\//, '')))
        )
        for (const stats of results) {
          if (stats) {
            files.set(stats.path, stats)
          }
        }
      }
    } catch {
      // Fallback to recursive directory walk
      await this.walkDirectory('.', files, maxFiles)
    }

    return files
  }

  /**
   * Scan specific files
   */
  private async scanFiles(paths: string[]): Promise<Map<string, FileStats>> {
    const files = new Map<string, FileStats>()

    const results = await Promise.all(paths.map((p) => this.getFileStats(p)))

    for (const stats of results) {
      if (stats) {
        files.set(stats.path, stats)
      }
    }

    return files
  }

  /**
   * Get stats for a single file
   */
  private async getFileStats(relativePath: string): Promise<FileStats | null> {
    const fullPath = path.join(this.projectPath, relativePath)

    try {
      const stat = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split('\n').length

      return {
        path: relativePath,
        size: stat.size,
        mtime: stat.mtime,
        lines,
      }
    } catch {
      return null
    }
  }

  /**
   * Recursive directory walk (fallback)
   */
  private async walkDirectory(
    dir: string,
    files: Map<string, FileStats>,
    maxFiles: number
  ): Promise<void> {
    if (files.size >= maxFiles) return

    const fullDir = path.join(this.projectPath, dir)

    try {
      const entries = await fs.readdir(fullDir, { withFileTypes: true })

      for (const entry of entries) {
        if (files.size >= maxFiles) break

        const relativePath = path.join(dir, entry.name).replace(/^\.\//, '')

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name)) {
            await this.walkDirectory(relativePath, files, maxFiles)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (SOURCE_EXTENSIONS.has(ext)) {
            const stats = await this.getFileStats(relativePath)
            if (stats) {
              files.set(relativePath, stats)
            }
          }
        }
      }
    } catch {
      // Directory may not be accessible
    }
  }

  // ==========================================================================
  // CONFIG & DIRECTORY ANALYSIS
  // ==========================================================================

  /**
   * Find and parse config files
   */
  private async findConfigFiles(): Promise<ConfigFileEntry[]> {
    const configs: ConfigFileEntry[] = []

    for (const configName of CONFIG_FILES) {
      const configPath = path.join(this.projectPath, configName)

      try {
        await fs.access(configPath)
        const checksum = await indexStorage.calculateChecksum(configPath)

        const entry: ConfigFileEntry = {
          path: configName,
          type: configName,
          checksum,
        }

        // Parse JSON config files
        if (configName.endsWith('.json')) {
          try {
            const content = await fs.readFile(configPath, 'utf-8')
            entry.parsed = JSON.parse(content)
          } catch {
            // Invalid JSON
          }
        }

        configs.push(entry)
      } catch {
        // Config file doesn't exist
      }
    }

    return configs
  }

  /**
   * Analyze top-level directory structure
   */
  private async analyzeDirectories(): Promise<DirectoryEntry[]> {
    const directories: DirectoryEntry[] = []

    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (IGNORE_DIRS.has(entry.name)) continue
        if (entry.name.startsWith('.') && entry.name !== '.github') continue

        const dirPath = entry.name
        const type = this.classifyDirectory(dirPath)
        const fileCount = await this.countFilesInDir(dirPath)

        directories.push({
          path: dirPath,
          type,
          fileCount,
        })
      }
    } catch {
      // Project path may not be accessible
    }

    return directories
  }

  /**
   * Classify directory type
   */
  private classifyDirectory(dirName: string): DirectoryEntry['type'] {
    for (const { type, patterns } of DIR_TYPE_PATTERNS) {
      if (patterns.some((p) => p.test(dirName))) {
        return type
      }
    }
    return 'unknown'
  }

  /**
   * Count files in a directory
   */
  private async countFilesInDir(relativePath: string): Promise<number> {
    const fullPath = path.join(this.projectPath, relativePath)

    try {
      const { stdout } = await execAsync(`find . -type f | wc -l`, { cwd: fullPath })
      return parseInt(stdout.trim(), 10) || 0
    } catch {
      return 0
    }
  }

  // ==========================================================================
  // STACK DETECTION
  // ==========================================================================

  /**
   * Detect technology stack from config files
   */
  private async detectStack(configFiles: ConfigFileEntry[]): Promise<DetectedStack> {
    const stack: DetectedStack = {
      ecosystem: 'unknown',
      frameworks: [],
      hasTests: false,
      hasDocker: false,
      hasCi: false,
      buildTool: null,
    }

    // Find package.json for JS/TS projects
    const packageJson = configFiles.find((cf) => cf.type === 'package.json')
    if (packageJson?.parsed) {
      stack.ecosystem = 'JavaScript'

      const deps = {
        ...(((packageJson.parsed as Record<string, unknown>).dependencies as Record<
          string,
          string
        >) || {}),
        ...(((packageJson.parsed as Record<string, unknown>).devDependencies as Record<
          string,
          string
        >) || {}),
      }

      // Detect frameworks
      if (deps.react) stack.frameworks.push('React')
      if (deps.next) stack.frameworks.push('Next.js')
      if (deps.vue) stack.frameworks.push('Vue')
      if (deps.nuxt) stack.frameworks.push('Nuxt')
      if (deps.svelte) stack.frameworks.push('Svelte')
      if (deps['@angular/core']) stack.frameworks.push('Angular')
      if (deps.express) stack.frameworks.push('Express')
      if (deps.fastify) stack.frameworks.push('Fastify')
      if (deps.hono) stack.frameworks.push('Hono')
      if (deps['@nestjs/core']) stack.frameworks.push('NestJS')

      // Detect testing
      if (deps.jest || deps.vitest || deps.mocha) stack.hasTests = true

      // Detect build tool
      if (deps.vite) stack.buildTool = 'vite'
      else if (deps.webpack) stack.buildTool = 'webpack'
      else if (deps.esbuild) stack.buildTool = 'esbuild'
      else if (deps.rollup) stack.buildTool = 'rollup'
    }

    // Other ecosystems
    if (configFiles.some((cf) => cf.type === 'Cargo.toml')) {
      stack.ecosystem = 'Rust'
    }
    if (configFiles.some((cf) => cf.type === 'go.mod')) {
      stack.ecosystem = 'Go'
    }
    if (configFiles.some((cf) => cf.type === 'pyproject.toml' || cf.type === 'requirements.txt')) {
      stack.ecosystem = 'Python'
    }

    // Docker & CI
    stack.hasDocker = configFiles.some(
      (cf) => cf.type === 'Dockerfile' || cf.type.includes('docker-compose')
    )

    // Check for CI configs
    try {
      await fs.access(path.join(this.projectPath, '.github', 'workflows'))
      stack.hasCi = true
    } catch {
      // No GitHub Actions
    }

    return stack
  }

  // ==========================================================================
  // PATTERN DETECTION
  // ==========================================================================

  /**
   * Detect architectural patterns
   */
  private detectPatterns(index: ProjectIndex): DetectedPattern[] {
    const patterns: DetectedPattern[] = []

    for (const detector of PATTERN_DETECTORS) {
      const confidence = detector.detect(index)
      if (confidence > 0.3) {
        patterns.push({
          name: detector.name,
          confidence,
          evidence: detector.evidence(index),
        })
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Build language statistics
   */
  private buildLanguageStats(files: FileStats[]): Record<string, LanguageStats> {
    const stats: Record<string, LanguageStats> = {}

    for (const file of files) {
      const ext = path.extname(file.path)
      if (!ext) continue

      if (!stats[ext]) {
        stats[ext] = { count: 0, totalLines: 0, totalSize: 0 }
      }

      stats[ext].count++
      stats[ext].totalLines += file.lines || 0
      stats[ext].totalSize += file.size
    }

    return stats
  }

  /**
   * Build scoring context for all files
   */
  private buildScoringContext(files: Map<string, FileStats>): ScoringContext {
    const configFiles = new Set<string>()
    let maxRecentCommits = 0

    for (const file of files.values()) {
      if (CONFIG_FILES.has(path.basename(file.path))) {
        configFiles.add(file.path)
      }
      if (file.recentCommits && file.recentCommits > maxRecentCommits) {
        maxRecentCommits = file.recentCommits
      }
    }

    return {
      allFiles: files,
      configFiles,
      maxFileSize: Math.max(...Array.from(files.values()).map((f) => f.size)),
      maxRecentCommits,
      now: new Date(),
    }
  }

  /**
   * Load existing file stats from index
   */
  private async loadExistingFileStats(index: ProjectIndex): Promise<Map<string, FileStats>> {
    const files = new Map<string, FileStats>()

    for (const file of index.relevantFiles) {
      files.set(file.path, {
        path: file.path,
        size: file.size,
        mtime: new Date(file.mtime),
      })
    }

    return files
  }

  /**
   * Detect changed files using checksums
   */
  private async detectFileChanges(): Promise<{
    added: string[]
    modified: string[]
    deleted: string[]
  }> {
    // Scan current files and calculate checksums
    const currentFiles = new Map<string, string>()

    const allFiles = await this.scanAllFiles()
    for (const [filePath] of allFiles) {
      const fullPath = path.join(this.projectPath, filePath)
      const checksum = await indexStorage.calculateChecksum(fullPath)
      currentFiles.set(filePath, checksum)
    }

    return indexStorage.detectChangedFiles(this.projectId, currentFiles)
  }

  /**
   * Save checksums for all scanned files
   */
  private async saveChecksums(files: Map<string, FileStats>): Promise<void> {
    const checksums: Record<string, string> = {}

    for (const [filePath] of files) {
      const fullPath = path.join(this.projectPath, filePath)
      checksums[filePath] = await indexStorage.calculateChecksum(fullPath)
    }

    await indexStorage.writeChecksums(this.projectId, {
      version: INDEX_VERSION,
      lastUpdated: getTimestamp(),
      checksums,
    })
  }
}

// Factory function for convenience
export function createProjectIndexer(projectPath: string, projectId: string): ProjectIndexer {
  return new ProjectIndexer(projectPath, projectId)
}

export { RELEVANCE_THRESHOLD }
