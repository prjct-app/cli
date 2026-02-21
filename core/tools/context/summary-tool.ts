/**
 * Summary Tool - Intelligent file summarization
 *
 * Combines:
 * - Code signatures (public API)
 * - JSDoc/docstring extraction
 * - Key dependencies
 *
 * Achieves high compression by returning only public-facing elements.
 *
 * @module context-tools/summary-tool
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { PublicAPIEntry, SummaryToolOutput } from '../../types/context-tools'
import { isNotFoundError } from '../../types/fs'
import { analyzeImports } from './imports-tool'
import { extractSignatures } from './signatures-tool'
import { measureCompression, noCompression } from './token-counter'

// =============================================================================
// Docstring Patterns
// =============================================================================

interface DocstringPattern {
  start: RegExp
  end: RegExp | null
  singleLine?: boolean
}

/**
 * Docstring patterns by language
 */
const DOCSTRING_PATTERNS: Record<string, DocstringPattern[]> = {
  typescript: [
    { start: /\/\*\*/, end: /\*\// }, // JSDoc
    { start: /\/\/\//, end: null, singleLine: true }, // Triple-slash
  ],
  javascript: [
    { start: /\/\*\*/, end: /\*\// }, // JSDoc
  ],
  python: [
    { start: /"""/, end: /"""/ }, // Triple quotes
    { start: /'''/, end: /'''/ }, // Single quotes
  ],
  go: [
    { start: /\/\//, end: null, singleLine: true }, // Line comment (Go uses these as docs)
  ],
  rust: [
    { start: /\/\/\//, end: null, singleLine: true }, // Doc comment
    { start: /\/\/!/, end: null, singleLine: true }, // Inner doc comment
  ],
}

/**
 * Extension to language mapping
 */
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Generate an intelligent summary of a file
 *
 * @param filePath - Path to the file
 * @param projectPath - Project root path
 * @returns Summary with public API and metrics
 */
export async function summarizeFile(
  filePath: string,
  projectPath: string = process.cwd()
): Promise<SummaryToolOutput> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath)

  // Read file content
  let content: string
  try {
    content = await fs.readFile(absolutePath, 'utf-8')
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        file: filePath,
        purpose: 'File not found',
        publicAPI: [],
        dependencies: [],
        metrics: noCompression(''),
      }
    }
    throw error
  }

  // Get language
  const ext = path.extname(filePath).toLowerCase()
  const language = EXT_TO_LANG[ext] || 'unknown'

  // Extract signatures
  const signaturesResult = await extractSignatures(filePath, projectPath)

  // Extract imports for dependencies
  const importsResult = await analyzeImports(filePath, projectPath)

  // Extract file-level docstring (purpose)
  const purpose = extractFilePurpose(content, language)

  // Build public API from exported signatures
  const publicAPI: PublicAPIEntry[] = signaturesResult.signatures
    .filter((sig) => sig.exported)
    .map((sig) => ({
      name: sig.name,
      type: sig.type,
      signature: sig.signature,
      description: sig.docstring ? extractDescriptionFromDocstring(sig.docstring) : undefined,
    }))

  // Get key dependencies (internal only, external are obvious from package.json)
  const dependencies = importsResult.imports
    .filter((imp) => !imp.isExternal && imp.resolved)
    .map((imp) => imp.resolved!)
    .slice(0, 10) // Limit to 10

  // Build summary content for metrics
  const summaryContent = buildSummaryText(purpose, publicAPI, dependencies)

  return {
    file: filePath,
    purpose,
    publicAPI,
    dependencies,
    metrics: measureCompression(content, summaryContent),
  }
}

/**
 * Summarize all files in a directory
 */
export async function summarizeDirectory(
  dirPath: string,
  projectPath: string = process.cwd(),
  options: { recursive?: boolean } = {}
): Promise<SummaryToolOutput[]> {
  const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.join(projectPath, dirPath)

  const results: SummaryToolOutput[] = []

  async function processDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(projectPath, fullPath)

      if (entry.isDirectory()) {
        // Skip common ignore patterns
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
          continue
        }
        if (options.recursive) {
          await processDir(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (EXT_TO_LANG[ext]) {
          const result = await summarizeFile(relativePath, projectPath)
          results.push(result)
        }
      }
    }
  }

  await processDir(absolutePath)
  return results
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract file-level purpose from first docstring
 */
function extractFilePurpose(content: string, language: string): string {
  const patterns = DOCSTRING_PATTERNS[language] || []
  const lines = content.split('\n')

  // Look for a file-level docstring in first 30 lines
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i].trim()

    for (const pattern of patterns) {
      if (pattern.start.test(line)) {
        if (pattern.singleLine) {
          // Single-line comment - grab consecutive lines
          const commentLines: string[] = []
          let j = i
          while (j < lines.length && pattern.start.test(lines[j].trim())) {
            commentLines.push(lines[j].trim().replace(pattern.start, '').trim())
            j++
          }
          if (commentLines.length > 0) {
            return commentLines.slice(0, 3).join(' ').trim()
          }
        } else if (pattern.end) {
          // Multi-line comment - extract until end
          let comment = ''
          let j = i
          while (j < lines.length) {
            comment += `${lines[j]}\n`
            if (pattern.end.test(lines[j])) break
            j++
          }
          // Extract first meaningful line
          const meaningfulLines = comment
            .replace(pattern.start, '')
            .replace(pattern.end!, '')
            .split('\n')
            .map((l) => l.replace(/^\s*\*\s?/, '').trim())
            .filter((l) => l.length > 0 && !l.startsWith('@'))
          if (meaningfulLines.length > 0) {
            return meaningfulLines.slice(0, 2).join(' ').trim()
          }
        }
      }
    }

    // Stop if we hit code (not comments or empty lines)
    if (
      line.length > 0 &&
      !line.startsWith('//') &&
      !line.startsWith('#') &&
      !line.startsWith('/*') &&
      !line.startsWith('*') &&
      !line.startsWith("'") &&
      !line.startsWith('"')
    ) {
      break
    }
  }

  // Fallback: derive from filename
  const fileName = content.split('\n')[0] || ''
  return `Module: ${path.basename(fileName, path.extname(fileName))}`
}

/**
 * Extract description from a docstring line
 */
function extractDescriptionFromDocstring(docstring: string): string {
  // Remove comment markers and clean up
  return docstring
    .replace(/^\/\*\*\s*/, '')
    .replace(/\*\/$/, '')
    .replace(/^\/\/\/?\s*/, '')
    .replace(/^#\s*/, '')
    .replace(/^"""\s*/, '')
    .replace(/"""\s*$/, '')
    .trim()
    .split('\n')[0] // First line only
    .trim()
}

/**
 * Build summary text for metrics calculation
 */
function buildSummaryText(
  purpose: string,
  publicAPI: PublicAPIEntry[],
  dependencies: string[]
): string {
  const parts: string[] = []

  parts.push(`Purpose: ${purpose}`)
  parts.push('')

  if (publicAPI.length > 0) {
    parts.push('Public API:')
    for (const entry of publicAPI) {
      const desc = entry.description ? ` - ${entry.description}` : ''
      parts.push(`  ${entry.type} ${entry.name}: ${entry.signature}${desc}`)
    }
    parts.push('')
  }

  if (dependencies.length > 0) {
    parts.push(`Dependencies: ${dependencies.join(', ')}`)
  }

  return parts.join('\n')
}
