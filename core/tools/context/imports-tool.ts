/**
 * Imports Tool - Build import/dependency graphs
 *
 * Analyzes:
 * - What a file imports
 * - What files import this file (reverse lookup)
 * - Dependency tree to a given depth
 *
 * @module context-tools/imports-tool
 * @version 1.0.0
 */

import { exec as execCallback } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { isNotFoundError } from '../../types/fs'
import type { DependencyNode, ImportedBy, ImportRelation, ImportsToolOutput } from './types'

const exec = promisify(execCallback)

// =============================================================================
// Import Patterns by Language
// =============================================================================

interface ImportPattern {
  pattern: RegExp
  sourceIndex: number
  namesIndex?: number
  isDefault?: boolean
  isNamespace?: boolean
}

/**
 * TypeScript/JavaScript import patterns
 */
const TS_IMPORT_PATTERNS: ImportPattern[] = [
  // import { x, y } from 'module'
  {
    pattern: /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
    sourceIndex: 2,
    namesIndex: 1,
  },
  // import x from 'module'
  {
    pattern: /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
    sourceIndex: 2,
    namesIndex: 1,
    isDefault: true,
  },
  // import * as x from 'module'
  {
    pattern: /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
    sourceIndex: 2,
    namesIndex: 1,
    isNamespace: true,
  },
  // import 'module' (side-effect)
  {
    pattern: /import\s*['"]([^'"]+)['"]/g,
    sourceIndex: 1,
  },
  // require('module')
  {
    pattern: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    sourceIndex: 1,
  },
  // Dynamic import
  {
    pattern: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    sourceIndex: 1,
  },
]

/**
 * Python import patterns
 */
const PYTHON_IMPORT_PATTERNS: ImportPattern[] = [
  // from module import x, y
  {
    pattern: /from\s+([\w.]+)\s+import\s+([^;\n]+)/g,
    sourceIndex: 1,
    namesIndex: 2,
  },
  // import module
  {
    pattern: /^import\s+([\w.]+)(?:\s+as\s+\w+)?$/gm,
    sourceIndex: 1,
  },
]

/**
 * Go import patterns
 */
const GO_IMPORT_PATTERNS: ImportPattern[] = [
  // import "module"
  {
    pattern: /import\s*"([^"]+)"/g,
    sourceIndex: 1,
  },
  // import ( "module1" "module2" )
  {
    pattern: /import\s*\([^)]*"([^"]+)"[^)]*\)/g,
    sourceIndex: 1,
  },
]

/**
 * Language to import patterns mapping
 */
const IMPORT_PATTERNS: Record<string, ImportPattern[]> = {
  typescript: TS_IMPORT_PATTERNS,
  javascript: TS_IMPORT_PATTERNS,
  python: PYTHON_IMPORT_PATTERNS,
  go: GO_IMPORT_PATTERNS,
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
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Analyze imports for a file
 *
 * @param filePath - Path to the file
 * @param projectPath - Project root path
 * @param options - Analysis options
 * @returns Import analysis with metrics
 */
export async function analyzeImports(
  filePath: string,
  projectPath: string = process.cwd(),
  options: {
    reverse?: boolean // Include files that import this
    depth?: number // Dependency tree depth (0 = no tree)
  } = {}
): Promise<ImportsToolOutput> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath)

  // Read file content
  let content: string
  try {
    content = await fs.readFile(absolutePath, 'utf-8')
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        file: filePath,
        imports: [],
        importedBy: [],
        metrics: {
          totalImports: 0,
          externalImports: 0,
          internalImports: 0,
          importedByCount: 0,
        },
      }
    }
    throw error
  }

  // Detect language
  const ext = path.extname(filePath).toLowerCase()
  const language = EXT_TO_LANG[ext] || 'unknown'
  const patterns = IMPORT_PATTERNS[language] || []

  // Extract imports
  const imports = await extractImports(content, patterns, absolutePath, projectPath)

  // Get reverse imports if requested
  let importedBy: ImportedBy[] = []
  if (options.reverse) {
    importedBy = await findImportedBy(filePath, projectPath)
  }

  // Build dependency tree if requested
  let dependencyTree: DependencyNode | undefined
  if (options.depth && options.depth > 0) {
    dependencyTree = await buildDependencyTree(filePath, projectPath, options.depth)
  }

  // Calculate metrics
  const externalImports = imports.filter((i) => i.isExternal).length
  const internalImports = imports.filter((i) => !i.isExternal).length

  return {
    file: filePath,
    imports,
    importedBy,
    dependencyTree,
    metrics: {
      totalImports: imports.length,
      externalImports,
      internalImports,
      importedByCount: importedBy.length,
    },
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract imports from file content
 */
async function extractImports(
  content: string,
  patterns: ImportPattern[],
  absolutePath: string,
  projectPath: string
): Promise<ImportRelation[]> {
  const imports: ImportRelation[] = []
  const seen = new Set<string>()

  for (const patternDef of patterns) {
    patternDef.pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = patternDef.pattern.exec(content)) !== null) {
      const source = match[patternDef.sourceIndex]
      if (!source || seen.has(source)) continue
      seen.add(source)

      // Parse imported names
      let importedNames: string[] | undefined
      if (patternDef.namesIndex !== undefined) {
        const namesStr = match[patternDef.namesIndex]
        if (namesStr) {
          importedNames = namesStr
            .split(',')
            .map((n) => n.trim().split(' as ')[0].trim())
            .filter(Boolean)
        }
      }

      // Determine if external
      const isExternal =
        !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/')

      // Resolve internal imports
      let resolved: string | null = null
      if (!isExternal) {
        resolved = await resolveImport(source, absolutePath, projectPath)
      }

      imports.push({
        source,
        resolved,
        isExternal,
        importedNames,
        isDefault: patternDef.isDefault,
        isNamespace: patternDef.isNamespace,
      })
    }
  }

  return imports
}

/**
 * Resolve a relative import to an absolute path
 */
async function resolveImport(
  source: string,
  fromFile: string,
  projectPath: string
): Promise<string | null> {
  const fileDir = path.dirname(fromFile)

  // Handle path alias like @/
  if (source.startsWith('@/')) {
    const aliasPath = path.join(projectPath, 'src', source.slice(2))
    return tryResolve(aliasPath, projectPath)
  }

  // Regular relative import
  const resolved = path.resolve(fileDir, source)
  return tryResolve(resolved, projectPath)
}

/**
 * Try to resolve a path, adding extensions if needed
 */
async function tryResolve(basePath: string, projectPath: string): Promise<string | null> {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']

  for (const ext of extensions) {
    const fullPath = basePath + ext
    try {
      const stat = await fs.stat(fullPath)
      if (stat.isFile()) {
        return path.relative(projectPath, fullPath)
      }
    } catch {}
  }

  return null
}

/**
 * Find all files that import the target file
 */
async function findImportedBy(filePath: string, projectPath: string): Promise<ImportedBy[]> {
  const importedBy: ImportedBy[] = []

  // Get the base name without extension for matching
  const baseName = path.basename(filePath, path.extname(filePath))
  const _dirName = path.dirname(filePath)

  try {
    // Use ripgrep if available, otherwise grep
    const searchPatterns = [
      `from ['"].*${baseName}['"]`,
      `from ['"]\\./${baseName}['"]`,
      `import\\(['"'].*${baseName}['"]`,
      `require\\(['"'].*${baseName}['"]`,
    ]

    const pattern = searchPatterns.join('|')

    const { stdout } = await exec(
      `grep -r -l -E '${pattern}' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' . 2>/dev/null || true`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
    )

    const files = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/^\.\//, ''))
      .filter((f) => f !== filePath) // Exclude self

    for (const file of files) {
      importedBy.push({ file })
    }
  } catch (_error) {
    // grep not available or error - return empty
  }

  return importedBy
}

/**
 * Build a dependency tree to a given depth
 */
async function buildDependencyTree(
  filePath: string,
  projectPath: string,
  maxDepth: number,
  currentDepth: number = 0,
  visited: Set<string> = new Set()
): Promise<DependencyNode> {
  const node: DependencyNode = {
    file: filePath,
    imports: [],
    depth: currentDepth,
  }

  if (currentDepth >= maxDepth || visited.has(filePath)) {
    return node
  }

  visited.add(filePath)

  // Get imports for this file
  const analysis = await analyzeImports(filePath, projectPath, {
    reverse: false,
    depth: 0,
  })

  // Recursively build tree for internal imports
  for (const imp of analysis.imports) {
    if (!imp.isExternal && imp.resolved) {
      const childNode = await buildDependencyTree(
        imp.resolved,
        projectPath,
        maxDepth,
        currentDepth + 1,
        visited
      )
      node.imports.push(childNode)
    }
  }

  return node
}
