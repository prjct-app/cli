/**
 * BM25 Text Search Index
 *
 * Implements the Okapi BM25 ranking algorithm for file relevance scoring.
 * Indexes files by extracting tokens from:
 * - Function names, class names, export names
 * - Import paths
 * - Comments and JSDoc
 * - File path segments
 *
 * Zero API calls — pure math on filesystem data.
 *
 * @module domain/bm25
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prjctDb from '../storage/database'

// =============================================================================
// Types
// =============================================================================

export interface BM25Document {
  path: string
  tokens: string[]
  length: number
}

export interface BM25Index {
  /** Map of file path → token list and document length */
  documents: Record<string, { tokens: string[]; length: number }>
  /** Inverted index: token → list of (path, term frequency) */
  invertedIndex: Record<string, Array<{ path: string; tf: number }>>
  /** Average document length across all documents */
  avgDocLength: number
  /** Total number of indexed documents */
  totalDocs: number
  /** Build timestamp */
  builtAt: string
}

export interface BM25Score {
  path: string
  score: number
}

// =============================================================================
// Constants
// =============================================================================

/** BM25 tuning: term frequency saturation */
const K1 = 1.2
/** BM25 tuning: document length normalization */
const B = 0.75

/** File extensions to index */
const INDEXABLE_EXTENSIONS = new Set([
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
  '.cs',
  '.rb',
  '.php',
  '.vue',
  '.svelte',
])

/** Common stop words to exclude from indexing */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
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
  'shall',
  'can',
  'of',
  'in',
  'to',
  'for',
  'with',
  'on',
  'at',
  'from',
  'by',
  'as',
  'or',
  'and',
  'but',
  'if',
  'not',
  'no',
  'so',
  'up',
  'out',
  'this',
  'that',
  'it',
  'its',
  'all',
  'any',
  // Code noise
  'import',
  'export',
  'default',
  'const',
  'let',
  'var',
  'function',
  'class',
  'interface',
  'type',
  'return',
  'new',
  'true',
  'false',
  'null',
  'undefined',
  'void',
  'async',
  'await',
  'static',
  'public',
  'private',
  'protected',
  'readonly',
  'string',
  'number',
  'boolean',
  'object',
  'array',
])

/** Directories to skip during indexing */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '__pycache__',
  'vendor',
  'target',
])

// =============================================================================
// Tokenization
// =============================================================================

/**
 * Split camelCase/PascalCase identifiers into words.
 * e.g., "getUserById" → ["get", "user", "by", "id"]
 */
function splitIdentifier(identifier: string): string[] {
  return identifier
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_./]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

/**
 * Extract tokens from a file's content and path.
 *
 * Extracts:
 * - Path segments (e.g., "core/domain/bm25.ts" → ["core", "domain", "bm25"])
 * - Function/class/interface/type names (split camelCase)
 * - Import sources (split on / and -)
 * - Single-line and multi-line comments
 * - JSDoc content
 */
export function tokenizeFile(content: string, filePath: string): string[] {
  const tokens: string[] = []

  // 1. Path segments (weighted: appear in every query match)
  const pathParts = filePath
    .replace(/\.[^.]+$/, '') // remove extension
    .split(/[/\\]/)
    .filter(Boolean)
  for (const part of pathParts) {
    tokens.push(...splitIdentifier(part))
  }

  // 2. Export names: export function/class/interface/type/const
  const exportPatterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+default\s+(?:class|function)\s+(\w+)/g,
  ]

  for (const pattern of exportPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        tokens.push(...splitIdentifier(match[1]))
      }
    }
  }

  // 3. Non-exported function/class/interface names
  const declPatterns = [
    /(?:async\s+)?function\s+(\w+)/g,
    /class\s+(\w+)/g,
    /interface\s+(\w+)/g,
    /type\s+(\w+)\s*=/g,
  ]

  for (const pattern of declPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        tokens.push(...splitIdentifier(match[1]))
      }
    }
  }

  // 4. Import sources
  const importPattern = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let importMatch: RegExpExecArray | null
  while ((importMatch = importPattern.exec(content)) !== null) {
    const source = importMatch[1]
    if (source.startsWith('.') || source.startsWith('@/')) {
      // Internal import — extract path tokens
      tokens.push(...splitIdentifier(source))
    } else {
      // External package — use package name
      const pkgName = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0]
      tokens.push(...splitIdentifier(pkgName))
    }
  }

  // 5. Comments (single-line)
  const singleLineComments = /\/\/\s*(.+)/g
  let commentMatch: RegExpExecArray | null
  while ((commentMatch = singleLineComments.exec(content)) !== null) {
    const words = commentMatch[1]
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
    tokens.push(...words)
  }

  // 6. JSDoc / multi-line comments — extract meaningful words
  const multiLineComments = /\/\*\*?([\s\S]*?)\*\//g
  let multiMatch: RegExpExecArray | null
  while ((multiMatch = multiLineComments.exec(content)) !== null) {
    const words = multiMatch[1]
      .replace(/@\w+/g, '') // strip JSDoc tags
      .replace(/\*/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && /^[a-z]+$/.test(w))
    tokens.push(...words)
  }

  // Filter: remove stop words, short tokens, non-alpha
  return tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t) && /^[a-z][a-z0-9]*$/.test(t))
}

/**
 * Tokenize a query string (task description).
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .split(/\s+/)
    .flatMap((word) => splitIdentifier(word))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t) && /^[a-z][a-z0-9]*$/.test(t))
}

// =============================================================================
// Index Building
// =============================================================================

/**
 * Recursively list all indexable files in a project.
 */
async function listFiles(dir: string, projectPath: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, projectPath)))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (INDEXABLE_EXTENSIONS.has(ext)) {
        files.push(path.relative(projectPath, fullPath))
      }
    }
  }

  return files
}

/**
 * Build a BM25 index for all files in a project.
 *
 * Performance target: <5 seconds for 500-file project.
 */
export async function buildIndex(projectPath: string): Promise<BM25Index> {
  const files = await listFiles(projectPath, projectPath)

  const documents: BM25Index['documents'] = {}
  const invertedIndex: BM25Index['invertedIndex'] = {}
  let totalLength = 0

  // Process files in parallel batches of 50
  const BATCH_SIZE = 50
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const content = await fs.readFile(path.join(projectPath, filePath), 'utf-8')
          const tokens = tokenizeFile(content, filePath)
          return { filePath, tokens }
        } catch {
          return { filePath, tokens: [] as string[] }
        }
      })
    )

    for (const { filePath, tokens } of results) {
      if (tokens.length === 0) continue

      documents[filePath] = { tokens, length: tokens.length }
      totalLength += tokens.length

      // Build term frequency map for this document
      const tfMap = new Map<string, number>()
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1)
      }

      // Add to inverted index
      for (const [token, tf] of tfMap) {
        if (!invertedIndex[token]) {
          invertedIndex[token] = []
        }
        invertedIndex[token].push({ path: filePath, tf })
      }
    }
  }

  const totalDocs = Object.keys(documents).length

  return {
    documents,
    invertedIndex,
    avgDocLength: totalDocs > 0 ? totalLength / totalDocs : 0,
    totalDocs,
    builtAt: new Date().toISOString(),
  }
}

// =============================================================================
// BM25 Scoring
// =============================================================================

/**
 * Calculate IDF (Inverse Document Frequency) for a term.
 */
function idf(docFrequency: number, totalDocs: number): number {
  return Math.log((totalDocs - docFrequency + 0.5) / (docFrequency + 0.5) + 1)
}

/**
 * Score all documents against a query using BM25.
 *
 * Performance target: <50ms per query.
 *
 * @returns Sorted array of (path, score) tuples, highest score first.
 */
export function score(query: string, index: BM25Index): BM25Score[] {
  const queryTokens = tokenizeQuery(query)
  if (queryTokens.length === 0) return []

  const scores = new Map<string, number>()

  for (const token of queryTokens) {
    const postings = index.invertedIndex[token]
    if (!postings) continue

    const tokenIdf = idf(postings.length, index.totalDocs)

    for (const { path: docPath, tf } of postings) {
      const doc = index.documents[docPath]
      if (!doc) continue

      // BM25 term score
      const numerator = tf * (K1 + 1)
      const denominator = tf + K1 * (1 - B + B * (doc.length / index.avgDocLength))
      const termScore = tokenIdf * (numerator / denominator)

      scores.set(docPath, (scores.get(docPath) || 0) + termScore)
    }
  }

  // Sort by score descending
  return Array.from(scores.entries())
    .map(([p, s]) => ({ path: p, score: s }))
    .sort((a, b) => b.score - a.score)
}

// =============================================================================
// SQLite Persistence
// =============================================================================

const INDEX_KEY = 'bm25-index'

/**
 * Save a BM25 index to SQLite.
 */
export function saveIndex(projectId: string, index: BM25Index): void {
  // Store only the inverted index + metadata (not raw tokens, to save space)
  const storable = {
    invertedIndex: index.invertedIndex,
    avgDocLength: index.avgDocLength,
    totalDocs: index.totalDocs,
    builtAt: index.builtAt,
    // Store document lengths (needed for scoring) but not full token lists
    docLengths: Object.fromEntries(Object.entries(index.documents).map(([p, d]) => [p, d.length])),
  }
  prjctDb.setDoc(projectId, INDEX_KEY, storable)
}

/**
 * Load a BM25 index from SQLite.
 * Returns null if no index exists.
 */
export function loadIndex(projectId: string): BM25Index | null {
  const stored = prjctDb.getDoc<{
    invertedIndex: BM25Index['invertedIndex']
    avgDocLength: number
    totalDocs: number
    builtAt: string
    docLengths: Record<string, number>
  }>(projectId, INDEX_KEY)

  if (!stored) return null

  // Reconstruct documents map with lengths only (tokens not needed for scoring)
  const documents: BM25Index['documents'] = {}
  for (const [p, length] of Object.entries(stored.docLengths)) {
    documents[p] = { tokens: [], length }
  }

  return {
    documents,
    invertedIndex: stored.invertedIndex,
    avgDocLength: stored.avgDocLength,
    totalDocs: stored.totalDocs,
    builtAt: stored.builtAt,
  }
}

// =============================================================================
// High-level API
// =============================================================================

/**
 * Build and persist a BM25 index for a project.
 */
export async function indexProject(projectPath: string, projectId: string): Promise<BM25Index> {
  const index = await buildIndex(projectPath)
  saveIndex(projectId, index)
  return index
}

/**
 * Query files by relevance to a task description.
 * Loads index from SQLite, scores against query, returns top N.
 *
 * @param projectId - Project ID for SQLite lookup
 * @param query - Task description or search query
 * @param topN - Maximum number of results (default: 15)
 * @returns Sorted array of (path, score) — empty if no index exists
 */
export function queryFiles(projectId: string, query: string, topN = 15): BM25Score[] {
  const index = loadIndex(projectId)
  if (!index) return []

  return score(query, index).slice(0, topN)
}
