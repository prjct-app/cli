/**
 * Files Tool - Find relevant files for a task
 *
 * Scoring algorithm:
 * - 60% Keywords in path/filename
 * - 20% Domain patterns (frontend/backend/etc)
 * - 15% Git recency (recently modified files)
 * - 5% Import distance (proximity to entry points)
 *
 * @module context-tools/files-tool
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import type { FilesToolOutput, ScoredFile, ScoreReason } from './types'
import { isNotFoundError } from '../types/fs'

const exec = promisify(execCallback)

// =============================================================================
// Domain Keywords
// =============================================================================

/**
 * Domain keywords for classification
 * Used to match file paths against domain patterns
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: [
    'component',
    'page',
    'view',
    'ui',
    'layout',
    'style',
    'css',
    'scss',
    'sass',
    'hook',
    'context',
    'store',
    'redux',
    'zustand',
    'react',
    'vue',
    'svelte',
    'angular',
    'next',
    'nuxt',
    'app',
    'client',
  ],
  backend: [
    'api',
    'route',
    'controller',
    'service',
    'middleware',
    'handler',
    'resolver',
    'schema',
    'model',
    'entity',
    'repository',
    'server',
    'socket',
    'graphql',
    'rest',
    'trpc',
  ],
  database: [
    'migration',
    'seed',
    'schema',
    'model',
    'entity',
    'repository',
    'prisma',
    'drizzle',
    'sequelize',
    'typeorm',
    'mongoose',
    'knex',
    'sql',
    'db',
  ],
  auth: [
    'auth',
    'login',
    'logout',
    'session',
    'token',
    'jwt',
    'oauth',
    'passport',
    'credential',
    'permission',
    'role',
    'user',
    'account',
  ],
  testing: [
    'test',
    'spec',
    'e2e',
    'integration',
    'unit',
    'mock',
    'fixture',
    'stub',
    'jest',
    'vitest',
    'cypress',
    'playwright',
  ],
  config: [
    'config',
    'env',
    'setting',
    'constant',
    'option',
    'tsconfig',
    'eslint',
    'prettier',
    'vite',
    'webpack',
    'rollup',
  ],
  infra: [
    'docker',
    'compose',
    'kubernetes',
    'k8s',
    'ci',
    'cd',
    'github',
    'gitlab',
    'jenkins',
    'terraform',
    'ansible',
    'deploy',
  ],
  util: ['util', 'helper', 'lib', 'common', 'shared', 'core', 'base', 'abstract'],
}

/**
 * Common code file extensions
 */
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.vue',
  '.svelte',
])

/**
 * Directories to ignore
 */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.cache',
  '__pycache__',
  '.pytest_cache',
  'vendor',
  'target',
  '.turbo',
  '.vercel',
])

// =============================================================================
// Main Function
// =============================================================================

/**
 * Find files relevant to a task description
 *
 * @param taskDescription - Natural language description of the task
 * @param projectPath - Path to the project root
 * @param options - Configuration options
 * @returns Scored files sorted by relevance
 */
export async function findRelevantFiles(
  taskDescription: string,
  projectPath: string,
  options: {
    maxFiles?: number
    minScore?: number
    includeTests?: boolean
  } = {}
): Promise<FilesToolOutput> {
  const startTime = Date.now()
  const maxFiles = options.maxFiles ?? 30
  const minScore = options.minScore ?? 0.1
  const includeTests = options.includeTests ?? false

  // Extract keywords from task description
  const keywords = extractKeywords(taskDescription)

  // Get all code files
  const allFiles = await getAllCodeFiles(projectPath)

  // Get git recency data
  const gitRecency = await getGitRecency(projectPath)

  // Score each file
  const scoredFiles: ScoredFile[] = []

  for (const filePath of allFiles) {
    // Skip test files if not requested
    if (!includeTests && isTestFile(filePath)) {
      continue
    }

    const score = scoreFile(filePath, keywords, gitRecency)

    if (score.score >= minScore) {
      scoredFiles.push(score)
    }
  }

  // Sort by score descending
  scoredFiles.sort((a, b) => b.score - a.score)

  // Limit results
  const topFiles = scoredFiles.slice(0, maxFiles)

  return {
    files: topFiles,
    metrics: {
      filesScanned: allFiles.length,
      filesReturned: topFiles.length,
      scanDuration: Date.now() - startTime,
    },
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract keywords from task description
 */
function extractKeywords(description: string): string[] {
  // Convert to lowercase and split by non-word characters
  const words = description.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

  // Remove common stop words
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'add',
    'create',
    'make',
    'implement',
    'fix',
    'update',
    'change',
    'modify',
    'remove',
    'delete',
    'new',
  ])

  return words.filter((w) => !stopWords.has(w) && w.length > 2)
}

/**
 * Get all code files in the project
 */
async function getAllCodeFiles(projectPath: string): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = path.join(relativePath, entry.name)

        if (entry.isDirectory()) {
          // Skip ignored directories
          if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) {
            continue
          }
          await walk(fullPath, relPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (CODE_EXTENSIONS.has(ext)) {
            files.push(relPath)
          }
        }
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        // Log but continue on permission errors, etc.
      }
    }
  }

  await walk(projectPath)
  return files
}

/**
 * Get git recency information
 */
async function getGitRecency(
  projectPath: string
): Promise<Map<string, { commits: number; daysAgo: number }>> {
  const recency = new Map<string, { commits: number; daysAgo: number }>()

  try {
    // Get files changed in last 30 commits with their commit counts
    const { stdout } = await exec(
      `git log -30 --pretty=format:"%H %ct" --name-only | awk '
        /^[a-f0-9]{40}/ { commit=$1; timestamp=$2; next }
        NF { files[$0]++; if (!lastmod[$0]) lastmod[$0]=timestamp }
        END { for (f in files) print files[f], lastmod[f], f }
      '`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
    )

    const now = Math.floor(Date.now() / 1000)
    const lines = stdout.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
      if (match) {
        const commits = parseInt(match[1])
        const timestamp = parseInt(match[2])
        const file = match[3]
        const daysAgo = Math.floor((now - timestamp) / 86400)
        recency.set(file, { commits, daysAgo })
      }
    }
  } catch (error) {
    // Git not available or not a git repo
  }

  return recency
}

/**
 * Score a file based on relevance
 */
function scoreFile(
  filePath: string,
  keywords: string[],
  gitRecency: Map<string, { commits: number; daysAgo: number }>
): ScoredFile {
  const reasons: ScoreReason[] = []
  let keywordScore = 0
  let domainScore = 0
  let recencyScore = 0
  let importScore = 0

  const pathLower = filePath.toLowerCase()
  const pathParts = pathLower.split('/').join(' ').split(/[^a-z0-9]+/)

  // Keyword matching (60% weight)
  for (const keyword of keywords) {
    if (pathLower.includes(keyword)) {
      keywordScore += 0.3
      reasons.push(`keyword:${keyword}`)
    }
    // Partial match in path parts
    for (const part of pathParts) {
      if (part.includes(keyword) || keyword.includes(part)) {
        keywordScore += 0.15
        break
      }
    }
  }
  keywordScore = Math.min(1, keywordScore)

  // Domain matching (20% weight)
  for (const [domain, domainKeywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const domainKw of domainKeywords) {
      if (pathLower.includes(domainKw)) {
        // Check if any task keyword relates to this domain
        const taskRelatesToDomain = keywords.some(
          (k) =>
            domainKeywords.includes(k) ||
            k.includes(domain) ||
            domain.includes(k)
        )
        if (taskRelatesToDomain) {
          domainScore += 0.4
          reasons.push(`domain:${domain}`)
          break
        }
      }
    }
  }
  domainScore = Math.min(1, domainScore)

  // Git recency (15% weight)
  const recencyData = gitRecency.get(filePath)
  if (recencyData) {
    // More recent = higher score
    if (recencyData.daysAgo <= 1) {
      recencyScore = 1.0
      reasons.push('recent:1d')
    } else if (recencyData.daysAgo <= 3) {
      recencyScore = 0.8
      reasons.push('recent:3d')
    } else if (recencyData.daysAgo <= 7) {
      recencyScore = 0.6
      reasons.push('recent:1w')
    } else if (recencyData.daysAgo <= 30) {
      recencyScore = 0.3
      reasons.push('recent:1m')
    }

    // Bonus for frequently changed files
    if (recencyData.commits >= 5) {
      recencyScore = Math.min(1, recencyScore + 0.2)
    }
  }

  // Import distance - simplified heuristic (5% weight)
  // Entry points (index, main, app) get bonus
  const filename = path.basename(filePath).toLowerCase()
  if (
    filename.includes('index') ||
    filename.includes('main') ||
    filename.includes('app') ||
    filename.includes('entry')
  ) {
    importScore = 0.5
    reasons.push('import:0')
  }
  // Core/shared files get some bonus
  if (
    pathLower.includes('/core/') ||
    pathLower.includes('/shared/') ||
    pathLower.includes('/lib/')
  ) {
    importScore = Math.max(importScore, 0.3)
    if (!reasons.some((r) => r.startsWith('import:'))) {
      reasons.push('import:1')
    }
  }

  // Calculate weighted score
  const score =
    keywordScore * 0.6 +
    domainScore * 0.2 +
    recencyScore * 0.15 +
    importScore * 0.05

  return {
    path: filePath,
    score: Math.min(1, score),
    reasons: [...new Set(reasons)], // Dedupe
  }
}

/**
 * Check if a file is a test file
 */
function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__') ||
    lower.includes('__mocks__') ||
    lower.includes('/tests/') ||
    lower.includes('/test/') ||
    lower.endsWith('_test.go') ||
    lower.endsWith('_test.py')
  )
}

// =============================================================================
// Exports
// =============================================================================

export default { findRelevantFiles }
