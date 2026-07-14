/**
 * Symbol Graph — structural code intelligence (file → symbol layer).
 *
 * Inspired by codebase-memory-mcp's knowledge graph, but scoped to what
 * prjct needs without Hybrid LSP / tree-sitter vendoring:
 *   - Extract functions/classes/types (+ call sites) via regex AST-lite
 *   - Persist symbols + CALLS/DEFINES edges in SQLite
 *   - Score files by symbol-name match (4th ranker signal)
 *   - Trace inbound/outbound call paths
 *   - Power detect_changes blast radius
 *
 * Languages (S1): TypeScript / JavaScript / TSX / JSX, plus lightweight
 * Python / Go / Rust / Java definition extraction (calls best-effort).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prjctDb from '../storage/database'
import type {
  CodeSymbol,
  CodeSymbolEdge,
  SymbolEdgeType,
  SymbolGraphMeta,
  SymbolKind,
  SymbolScore,
  TraceHop,
  TraceResult,
} from '../types/domain.js'
import { batchProcess, walkDir } from '../utils/file-helper'

const META_KEY = 'symbol-graph'
const SYMBOL_EXTS = new Set([
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
])

// Extraction

interface RawSymbol {
  kind: SymbolKind
  name: string
  startLine: number
  endLine: number | null
  exported: boolean
}

interface FileExtract {
  filePath: string
  symbols: RawSymbol[]
  /** Call names found in this file (not yet resolved). */
  callNames: string[]
  /** Named imports: localName → resolved relative module path (best-effort). */
  importBindings: Map<string, string>
}

function lineOf(content: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++
  }
  return line
}

function symbolId(file: string, kind: string, name: string, startLine: number): string {
  return `${file}#${kind}:${name}@${startLine}`
}

function qnameOf(file: string, name: string): string {
  const base = file.replace(/\.[^.]+$/, '').replace(/[/\\]/g, '.')
  return `${base}.${name}`
}

function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return SYMBOL_EXTS.has(ext)
}

/** Strip strings/comments so call extraction doesn't match noise. */
function stripNoise(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

function extractTsJs(content: string, filePath: string): FileExtract {
  const symbols: RawSymbol[] = []
  const callNames: string[] = []
  const importBindings = new Map<string, string>()
  const clean = stripNoise(content)

  const declPatterns: Array<{
    re: RegExp
    kind: SymbolKind
    nameIdx: number
    exported?: boolean
  }> = [
    {
      re: /export\s+(?:async\s+)?function\s+(\w+)/g,
      kind: 'function',
      nameIdx: 1,
      exported: true,
    },
    { re: /(?:^|[^\w.])(?:async\s+)?function\s+(\w+)/g, kind: 'function', nameIdx: 1 },
    {
      re: /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
      kind: 'function',
      nameIdx: 1,
      exported: true,
    },
    {
      re: /(?:^|[\n;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
      kind: 'function',
      nameIdx: 1,
    },
    {
      re: /export\s+(?:abstract\s+)?class\s+(\w+)/g,
      kind: 'class',
      nameIdx: 1,
      exported: true,
    },
    { re: /(?:^|[^\w.])(?:abstract\s+)?class\s+(\w+)/g, kind: 'class', nameIdx: 1 },
    { re: /export\s+interface\s+(\w+)/g, kind: 'interface', nameIdx: 1, exported: true },
    { re: /(?:^|[^\w.])interface\s+(\w+)/g, kind: 'interface', nameIdx: 1 },
    { re: /export\s+type\s+(\w+)\s*[=<]/g, kind: 'type', nameIdx: 1, exported: true },
    { re: /(?:^|[^\w.])type\s+(\w+)\s*[=<]/g, kind: 'type', nameIdx: 1 },
    { re: /export\s+enum\s+(\w+)/g, kind: 'enum', nameIdx: 1, exported: true },
    { re: /(?:^|[^\w.])enum\s+(\w+)/g, kind: 'enum', nameIdx: 1 },
    {
      re: /export\s+(?:const|let|var)\s+(\w+)\s*[:=]/g,
      kind: 'const',
      nameIdx: 1,
      exported: true,
    },
    // Methods inside classes (indent heuristic)
    {
      re: /(?:^|\n)\s+(?:public|private|protected|static|async|readonly|\s)*\s*(?:async\s+)?(\w+)\s*\([^;{]*\)\s*[:{]/g,
      kind: 'method',
      nameIdx: 1,
    },
  ]

  const seen = new Set<string>()
  for (const { re, kind, nameIdx, exported } of declPatterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      const name = m[nameIdx]
      if (!name || name.length < 2) continue
      // Skip keywords / control
      if (
        /^(if|for|while|switch|catch|return|await|typeof|new|throw|else|case|from|import|export|class|function|const|let|var|get|set|constructor)$/.test(
          name
        )
      )
        continue
      const startLine = lineOf(content, m.index)
      const key = `${kind}:${name}@${startLine}`
      if (seen.has(key)) continue
      seen.add(key)
      symbols.push({
        kind,
        name,
        startLine,
        endLine: null,
        exported: exported === true,
      })
    }
  }

  // Named imports: import { a as b, c } from './mod'
  const importRe =
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"](\.[^'"]+|@\/[^'"]+)['"]/g
  let im: RegExpExecArray | null
  while ((im = importRe.exec(content)) !== null) {
    const source = im[3]!
    if (im[1]) {
      for (const part of im[1].split(',')) {
        const bits = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
        const local = (bits[1] ?? bits[0])?.trim()
        if (local) importBindings.set(local, source)
      }
    } else if (im[2]) {
      importBindings.set(im[2], source)
    }
  }

  // Call sites: identifier(
  const callRe = /\b([A-Za-z_][\w]*)\s*\(/g
  let cm: RegExpExecArray | null
  const callSeen = new Set<string>()
  while ((cm = callRe.exec(clean)) !== null) {
    const name = cm[1]!
    if (
      /^(if|for|while|switch|catch|function|class|return|typeof|new|throw|await|void|super|this|import|require|console|Math|JSON|Object|Array|Promise|Map|Set|Date|Error|Buffer|process|describe|it|test|expect|beforeEach|afterEach)$/.test(
        name
      )
    )
      continue
    if (callSeen.has(name)) continue
    callSeen.add(name)
    callNames.push(name)
  }

  // Route heuristics (Express/Hono/Next-ish)
  const routeRe = /\.(?:get|post|put|patch|delete|options|head|all)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi
  let rm: RegExpExecArray | null
  while ((rm = routeRe.exec(content)) !== null) {
    const routePath = rm[1]!
    const name = routePath.replace(/[^\w/.-]/g, '').slice(0, 64) || 'route'
    symbols.push({
      kind: 'route',
      name,
      startLine: lineOf(content, rm.index),
      endLine: null,
      exported: true,
    })
  }

  return { filePath, symbols, callNames, importBindings }
}

function extractPython(content: string, filePath: string): FileExtract {
  const symbols: RawSymbol[] = []
  const callNames: string[] = []
  const reFn = /^(?:async\s+)?def\s+(\w+)\s*\(/gm
  const reClass = /^class\s+(\w+)/gm
  let m: RegExpExecArray | null
  while ((m = reFn.exec(content)) !== null) {
    symbols.push({
      kind: 'function',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: !m[1]!.startsWith('_'),
    })
  }
  while ((m = reClass.exec(content)) !== null) {
    symbols.push({
      kind: 'class',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: !m[1]!.startsWith('_'),
    })
  }
  const callRe = /\b([A-Za-z_][\w]*)\s*\(/g
  const clean = stripNoise(content)
  const seen = new Set<string>()
  while ((m = callRe.exec(clean)) !== null) {
    const name = m[1]!
    if (/^(if|for|while|return|print|len|range|str|int|list|dict|set|super|self)$/.test(name))
      continue
    if (seen.has(name)) continue
    seen.add(name)
    callNames.push(name)
  }
  return { filePath, symbols, callNames, importBindings: new Map() }
}

function extractGo(content: string, filePath: string): FileExtract {
  const symbols: RawSymbol[] = []
  const callNames: string[] = []
  const reFn = /^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/gm
  const reType = /^type\s+(\w+)\s+(?:struct|interface)/gm
  let m: RegExpExecArray | null
  while ((m = reFn.exec(content)) !== null) {
    const name = m[1]!
    symbols.push({
      kind: name[0] === name[0]!.toUpperCase() ? 'function' : 'function',
      name,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: name[0] === name[0]!.toUpperCase(),
    })
  }
  while ((m = reType.exec(content)) !== null) {
    symbols.push({
      kind: 'type',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: m[1]![0] === m[1]![0]!.toUpperCase(),
    })
  }
  return { filePath, symbols, callNames, importBindings: new Map() }
}

function extractRust(content: string, filePath: string): FileExtract {
  const symbols: RawSymbol[] = []
  const reFn = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm
  const reStruct = /^(?:pub\s+)?struct\s+(\w+)/gm
  const reTrait = /^(?:pub\s+)?trait\s+(\w+)/gm
  const reEnum = /^(?:pub\s+)?enum\s+(\w+)/gm
  let m: RegExpExecArray | null
  for (const [re, kind] of [
    [reFn, 'function'],
    [reStruct, 'class'],
    [reTrait, 'interface'],
    [reEnum, 'enum'],
  ] as const) {
    while ((m = re.exec(content)) !== null) {
      symbols.push({
        kind: kind as SymbolKind,
        name: m[1]!,
        startLine: lineOf(content, m.index),
        endLine: null,
        exported: /^pub\b/.test(m[0]!),
      })
    }
  }
  return { filePath, symbols, callNames: [], importBindings: new Map() }
}

function extractJava(content: string, filePath: string): FileExtract {
  const symbols: RawSymbol[] = []
  const reClass = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)/g
  const reIface = /(?:public\s+)?interface\s+(\w+)/g
  const reMethod =
    /(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?[\w.<>,[\]\s]+\s+(\w+)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = reClass.exec(content)) !== null) {
    symbols.push({
      kind: 'class',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: true,
    })
  }
  while ((m = reIface.exec(content)) !== null) {
    symbols.push({
      kind: 'interface',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: true,
    })
  }
  while ((m = reMethod.exec(content)) !== null) {
    if (/^(if|for|while|switch|catch|return|new)$/.test(m[1]!)) continue
    symbols.push({
      kind: 'method',
      name: m[1]!,
      startLine: lineOf(content, m.index),
      endLine: null,
      exported: true,
    })
  }
  return { filePath, symbols, callNames: [], importBindings: new Map() }
}

export function extractFile(content: string, filePath: string): FileExtract {
  const ext = path.extname(filePath).toLowerCase()
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    return extractTsJs(content, filePath)
  }
  if (ext === '.py') return extractPython(content, filePath)
  if (ext === '.go') return extractGo(content, filePath)
  if (ext === '.rs') return extractRust(content, filePath)
  if (ext === '.java') return extractJava(content, filePath)
  return { filePath, symbols: [], callNames: [], importBindings: new Map() }
}

// Resolve import path relative to file (TS/JS relative only)

function resolveModuleHint(fromFile: string, source: string): string | null {
  if (!source.startsWith('.') && !source.startsWith('@/')) return null
  // Soft resolve: strip extension, return normalized relative path without project root
  let base: string
  if (source.startsWith('@/')) {
    base = path.posix.join('src', source.slice(2))
  } else {
    const fromDir = path.posix.dirname(fromFile.replace(/\\/g, '/'))
    base = path.posix.normalize(path.posix.join(fromDir, source))
  }
  return base.replace(/^\.\//, '')
}

// Graph build + persistence

interface BuiltGraph {
  symbols: CodeSymbol[]
  edges: CodeSymbolEdge[]
  fileCount: number
}

function buildFromExtracts(extracts: FileExtract[]): BuiltGraph {
  const symbols: CodeSymbol[] = []
  const edges: CodeSymbolEdge[] = []
  // name → symbols (for call resolution)
  const byName = new Map<string, CodeSymbol[]>()
  // file → symbols
  const byFile = new Map<string, CodeSymbol[]>()

  for (const ex of extracts) {
    const fileSyms: CodeSymbol[] = []
    for (const raw of ex.symbols) {
      const id = symbolId(ex.filePath, raw.kind, raw.name, raw.startLine)
      const sym: CodeSymbol = {
        id,
        file: ex.filePath,
        kind: raw.kind,
        name: raw.name,
        qname: qnameOf(ex.filePath, raw.name),
        startLine: raw.startLine,
        endLine: raw.endLine,
        exported: raw.exported,
      }
      symbols.push(sym)
      fileSyms.push(sym)
      const list = byName.get(raw.name) ?? []
      list.push(sym)
      byName.set(raw.name, list)

      // File DEFINES symbol
      edges.push({
        src: `file:${ex.filePath}`,
        dst: id,
        edgeType: 'DEFINES',
        confidence: 1,
      })
    }
    byFile.set(ex.filePath, fileSyms)
  }

  // Resolve CALLS. Source is the file synthetic node (stable, no false
  // "function A calls B" when we only know the file invokes B). Trace still
  // resolves file: → display via symbolsInFile / reverse expansion.
  for (const ex of extracts) {
    const fileSyms = byFile.get(ex.filePath) ?? []
    const fileSrc = `file:${ex.filePath}`

    for (const callName of ex.callNames) {
      // 1) same-file definition
      const local = fileSyms.filter((s) => s.name === callName)
      let targets: CodeSymbol[] = local

      // 2) import binding → module path hint → match symbol in that file
      if (targets.length === 0) {
        const hint = ex.importBindings.get(callName)
        if (hint) {
          const mod = resolveModuleHint(ex.filePath, hint)
          if (mod) {
            const candidates = (byName.get(callName) ?? []).filter(
              (s) =>
                s.file.replace(/\.[^.]+$/, '') === mod ||
                s.file.startsWith(`${mod}.`) ||
                s.file.startsWith(`${mod}/`) ||
                s.file === `${mod}.ts` ||
                s.file === `${mod}.tsx` ||
                s.file === `${mod}.js` ||
                s.file === `${mod}/index.ts` ||
                s.file === `${mod}/index.js`
            )
            if (candidates.length > 0) targets = candidates
          }
        }
      }

      // 3) unique project-wide name
      if (targets.length === 0) {
        const all = byName.get(callName) ?? []
        if (all.length === 1) targets = all
        else if (all.length > 1) {
          const exported = all.filter((s) => s.exported)
          if (exported.length === 1) targets = exported
        }
      }

      if (targets.length === 0) continue
      for (const t of targets) {
        // Skip self-calls within same file's definition noise
        if (t.file === ex.filePath && local.includes(t)) continue
        edges.push({
          src: fileSrc,
          dst: t.id,
          edgeType: 'CALLS',
          confidence: local.length > 0 ? 0.6 : 0.75,
        })
      }
    }
  }

  // Dedup edges
  const edgeKey = new Set<string>()
  const uniqEdges: CodeSymbolEdge[] = []
  for (const e of edges) {
    const k = `${e.src}|${e.dst}|${e.edgeType}`
    if (edgeKey.has(k)) continue
    edgeKey.add(k)
    uniqEdges.push(e)
  }

  return {
    symbols,
    edges: uniqEdges,
    fileCount: extracts.length,
  }
}

async function extractProject(projectPath: string, onlyFiles?: string[]): Promise<FileExtract[]> {
  const files =
    onlyFiles ?? (await walkDir(projectPath)).filter((f) => isSourceFile(f) && !f.includes('.d.ts'))
  const sourceFiles = files.filter((f) => isSourceFile(f) && !f.endsWith('.d.ts'))

  return batchProcess(sourceFiles, 40, async (filePath) => {
    try {
      const content = await fs.readFile(path.join(projectPath, filePath), 'utf-8')
      // Cap very large files for extraction cost
      const sliced = content.length > 400_000 ? content.slice(0, 400_000) : content
      return extractFile(sliced, filePath)
    } catch {
      return {
        filePath,
        symbols: [],
        callNames: [],
        importBindings: new Map(),
      }
    }
  })
}

function persistGraph(projectId: string, graph: BuiltGraph): void {
  prjctDb.transaction(projectId, (db) => {
    db.prepare('DELETE FROM code_symbols').run()
    db.prepare('DELETE FROM code_symbol_edges').run()
    const insSym = db.prepare(
      `INSERT INTO code_symbols (id, file, kind, name, qname, start_line, end_line, exported)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insEdge = db.prepare(
      `INSERT OR IGNORE INTO code_symbol_edges (src, dst, edge_type, confidence)
       VALUES (?, ?, ?, ?)`
    )
    for (const s of graph.symbols) {
      insSym.run(s.id, s.file, s.kind, s.name, s.qname, s.startLine, s.endLine, s.exported ? 1 : 0)
    }
    for (const e of graph.edges) {
      insEdge.run(e.src, e.dst, e.edgeType, e.confidence)
    }
  })

  const meta: SymbolGraphMeta = {
    symbolCount: graph.symbols.length,
    edgeCount: graph.edges.length,
    fileCount: graph.fileCount,
    builtAt: new Date().toISOString(),
  }
  prjctDb.setDoc(projectId, META_KEY, meta)
}

function patchGraph(
  projectId: string,
  extracts: FileExtract[],
  deletedFiles: string[]
): SymbolGraphMeta | null {
  // Incremental: drop symbols/edges for touched files, re-insert from extracts.
  // CALLS that target/src these symbols also get cleaned via id prefix.
  const touched = new Set([...extracts.map((e) => e.filePath), ...deletedFiles])
  if (touched.size === 0) return loadMeta(projectId)

  // Load surviving symbols for call resolution (name index of whole project after patch)
  const existing = listAllSymbols(projectId).filter((s) => !touched.has(s.file))
  const rebuilt = buildFromExtracts(extracts)

  prjctDb.transaction(projectId, (db) => {
    const delSym = db.prepare('DELETE FROM code_symbols WHERE file = ?')
    for (const file of touched) {
      // LIKE: file#… symbol ids and synthetic file: nodes
      db.prepare(
        `DELETE FROM code_symbol_edges WHERE src LIKE ? OR dst LIKE ? OR src = ? OR dst = ?`
      ).run(`${file}#%`, `${file}#%`, `file:${file}`, `file:${file}`)
      delSym.run(file)
    }

    const insSym = db.prepare(
      `INSERT INTO code_symbols (id, file, kind, name, qname, start_line, end_line, exported)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insEdge = db.prepare(
      `INSERT OR IGNORE INTO code_symbol_edges (src, dst, edge_type, confidence)
       VALUES (?, ?, ?, ?)`
    )
    for (const s of rebuilt.symbols) {
      insSym.run(s.id, s.file, s.kind, s.name, s.qname, s.startLine, s.endLine, s.exported ? 1 : 0)
    }
    // Re-resolve CALLS for changed files against full name index
    const byName = new Map<string, CodeSymbol[]>()
    for (const s of [...existing, ...rebuilt.symbols]) {
      const list = byName.get(s.name) ?? []
      list.push(s)
      byName.set(s.name, list)
    }
    for (const ex of extracts) {
      const fileSyms = rebuilt.symbols.filter((s) => s.file === ex.filePath)
      const defaultSrc =
        fileSyms.find((s) => s.kind === 'function' || s.kind === 'class' || s.kind === 'method')
          ?.id ?? fileSyms[0]?.id
      for (const s of fileSyms) {
        insEdge.run(`file:${ex.filePath}`, s.id, 'DEFINES', 1)
      }
      if (!defaultSrc) continue
      for (const callName of ex.callNames) {
        let targets = fileSyms.filter((s) => s.name === callName)
        if (targets.length === 0) {
          const all = byName.get(callName) ?? []
          if (all.length === 1) targets = all
          else {
            const exported = all.filter((s) => s.exported)
            if (exported.length === 1) targets = exported
          }
        }
        for (const t of targets) {
          if (t.id === defaultSrc) continue
          insEdge.run(defaultSrc, t.id, 'CALLS', 0.7)
        }
      }
    }
  })

  const counts = prjctDb.get<{ sc: number; ec: number; fc: number }>(
    projectId,
    `SELECT
       (SELECT COUNT(*) FROM code_symbols) AS sc,
       (SELECT COUNT(*) FROM code_symbol_edges) AS ec,
       (SELECT COUNT(DISTINCT file) FROM code_symbols) AS fc`
  )
  const meta: SymbolGraphMeta = {
    symbolCount: counts?.sc ?? 0,
    edgeCount: counts?.ec ?? 0,
    fileCount: counts?.fc ?? 0,
    builtAt: new Date().toISOString(),
  }
  prjctDb.setDoc(projectId, META_KEY, meta)
  return meta
}

// Public API

export async function indexSymbols(
  projectPath: string,
  projectId: string
): Promise<SymbolGraphMeta> {
  const extracts = await extractProject(projectPath)
  const graph = buildFromExtracts(extracts)
  persistGraph(projectId, graph)
  return {
    symbolCount: graph.symbols.length,
    edgeCount: graph.edges.length,
    fileCount: graph.fileCount,
    builtAt: new Date().toISOString(),
  }
}

export async function updateSymbols(
  projectPath: string,
  projectId: string,
  changedFiles: string[],
  deletedFiles: string[] = []
): Promise<SymbolGraphMeta> {
  if (!hasSymbolIndex(projectId)) {
    return indexSymbols(projectPath, projectId)
  }
  const sourceChanged = changedFiles.filter((f) => isSourceFile(f) && !f.endsWith('.d.ts'))
  const sourceDeleted = deletedFiles.filter((f) => isSourceFile(f))
  if (sourceChanged.length === 0 && sourceDeleted.length === 0) {
    return (
      loadMeta(projectId) ?? {
        symbolCount: 0,
        edgeCount: 0,
        fileCount: 0,
        builtAt: new Date().toISOString(),
      }
    )
  }
  const extracts = await extractProject(projectPath, sourceChanged)
  return (
    patchGraph(projectId, extracts, sourceDeleted) ?? {
      symbolCount: 0,
      edgeCount: 0,
      fileCount: 0,
      builtAt: new Date().toISOString(),
    }
  )
}

export function hasSymbolIndex(projectId: string): boolean {
  try {
    const row = prjctDb.get<{ n: number }>(projectId, 'SELECT COUNT(*) AS n FROM code_symbols')
    return (row?.n ?? 0) > 0
  } catch {
    return false
  }
}

export function loadMeta(projectId: string): SymbolGraphMeta | null {
  return prjctDb.getDoc<SymbolGraphMeta>(projectId, META_KEY)
}

function rowToSymbol(r: {
  id: string
  file: string
  kind: string
  name: string
  qname: string | null
  start_line: number
  end_line: number | null
  exported: number
}): CodeSymbol {
  return {
    id: r.id,
    file: r.file,
    kind: r.kind as SymbolKind,
    name: r.name,
    qname: r.qname ?? qnameOf(r.file, r.name),
    startLine: r.start_line,
    endLine: r.end_line,
    exported: r.exported === 1,
  }
}

export function listAllSymbols(projectId: string): CodeSymbol[] {
  try {
    const rows = prjctDb.query<{
      id: string
      file: string
      kind: string
      name: string
      qname: string | null
      start_line: number
      end_line: number | null
      exported: number
    }>(projectId, 'SELECT * FROM code_symbols ORDER BY file, start_line')
    return rows.map(rowToSymbol)
  } catch {
    return []
  }
}

export function searchSymbols(
  projectId: string,
  pattern: string,
  opts: { limit?: number; kind?: SymbolKind } = {}
): CodeSymbol[] {
  const limit = opts.limit ?? 30
  const like = `%${pattern.replace(/[%_]/g, '')}%`
  try {
    if (opts.kind) {
      return prjctDb
        .query<{
          id: string
          file: string
          kind: string
          name: string
          qname: string | null
          start_line: number
          end_line: number | null
          exported: number
        }>(
          projectId,
          `SELECT * FROM code_symbols
           WHERE name LIKE ? COLLATE NOCASE AND kind = ?
           ORDER BY exported DESC, name
           LIMIT ?`,
          like,
          opts.kind,
          limit
        )
        .map(rowToSymbol)
    }
    return prjctDb
      .query<{
        id: string
        file: string
        kind: string
        name: string
        qname: string | null
        start_line: number
        end_line: number | null
        exported: number
      }>(
        projectId,
        `SELECT * FROM code_symbols
         WHERE name LIKE ? COLLATE NOCASE OR qname LIKE ? COLLATE NOCASE
         ORDER BY exported DESC, name
         LIMIT ?`,
        like,
        like,
        limit
      )
      .map(rowToSymbol)
  } catch {
    return []
  }
}

/** Query indexer: files that define symbols matching query tokens. */
export function scoreFilesFromQuery(projectId: string, query: string, topN = 20): SymbolScore[] {
  const tokens = query
    .split(/[^A-Za-z0-9_]+/)
    .flatMap((t) => t.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length > 2)

  if (tokens.length === 0 || !hasSymbolIndex(projectId)) return []

  const fileScores = new Map<string, { score: number; names: Set<string> }>()

  for (const token of tokens) {
    const hits = searchSymbols(projectId, token, { limit: 40 })
    for (const h of hits) {
      const exact = h.name.toLowerCase() === token.toLowerCase() ? 1 : 0.55
      const exp = h.exported ? 1.15 : 1
      const kindBoost = h.kind === 'function' || h.kind === 'class' || h.kind === 'route' ? 1.1 : 1
      const add = exact * exp * kindBoost
      const cur = fileScores.get(h.file) ?? { score: 0, names: new Set<string>() }
      cur.score += add
      cur.names.add(h.name)
      fileScores.set(h.file, cur)
    }
  }

  return Array.from(fileScores.entries())
    .map(([p, v]) => ({
      path: p,
      score: v.score,
      matchedNames: [...v.names],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

export function symbolsInFile(projectId: string, filePath: string): CodeSymbol[] {
  try {
    return prjctDb
      .query<{
        id: string
        file: string
        kind: string
        name: string
        qname: string | null
        start_line: number
        end_line: number | null
        exported: number
      }>(projectId, 'SELECT * FROM code_symbols WHERE file = ? ORDER BY start_line', filePath)
      .map(rowToSymbol)
  } catch {
    return []
  }
}

function loadEdges(
  projectId: string,
  edgeType: SymbolEdgeType = 'CALLS'
): { forward: Map<string, string[]>; reverse: Map<string, string[]> } {
  const forward = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()
  try {
    const rows = prjctDb.query<{ src: string; dst: string }>(
      projectId,
      'SELECT src, dst FROM code_symbol_edges WHERE edge_type = ?',
      edgeType
    )
    for (const r of rows) {
      if (!forward.has(r.src)) forward.set(r.src, [])
      forward.get(r.src)!.push(r.dst)
      if (!reverse.has(r.dst)) reverse.set(r.dst, [])
      reverse.get(r.dst)!.push(r.src)
    }
  } catch {
    /* empty */
  }
  return { forward, reverse }
}

function symbolById(projectId: string, id: string): CodeSymbol | null {
  try {
    const r = prjctDb.get<{
      id: string
      file: string
      kind: string
      name: string
      qname: string | null
      start_line: number
      end_line: number | null
      exported: number
    }>(projectId, 'SELECT * FROM code_symbols WHERE id = ?', id)
    return r ? rowToSymbol(r) : null
  } catch {
    return null
  }
}

/**
 * BFS call-path trace for a symbol name (first match preferred: exported).
 */
export function tracePath(
  projectId: string,
  functionName: string,
  opts: { direction?: 'inbound' | 'outbound' | 'both'; depth?: number } = {}
): TraceResult | null {
  const direction = opts.direction ?? 'both'
  const maxDepth = Math.min(Math.max(opts.depth ?? 3, 1), 5)
  const roots = searchSymbols(projectId, functionName, { limit: 10 }).filter(
    (s) => s.name.toLowerCase() === functionName.toLowerCase()
  )
  const rootList = roots.length > 0 ? roots : searchSymbols(projectId, functionName, { limit: 5 })
  if (rootList.length === 0) return null

  const { forward, reverse } = loadEdges(projectId, 'CALLS')
  const inbound: TraceHop[] = []
  const outbound: TraceHop[] = []

  const bfs = (startIds: string[], adj: Map<string, string[]>, out: TraceHop[], maxD: number) => {
    const visited = new Set<string>(startIds)
    const queue: Array<{ id: string; depth: number }> = startIds.map((id) => ({
      id,
      depth: 0,
    }))
    for (let qi = 0; qi < queue.length; qi++) {
      const { id, depth } = queue[qi]!
      if (depth >= maxD) continue
      for (const next of adj.get(id) ?? []) {
        if (visited.has(next)) continue
        visited.add(next)
        // Synthetic file: callers — expand to primary exported symbols in that file
        if (next.startsWith('file:')) {
          const filePath = next.slice('file:'.length)
          const fileSyms = symbolsInFile(projectId, filePath)
          const primary =
            fileSyms.find((s) => s.exported && (s.kind === 'function' || s.kind === 'class')) ??
            fileSyms.find((s) => s.kind === 'function' || s.kind === 'class') ??
            fileSyms[0]
          if (primary && !visited.has(primary.id)) {
            visited.add(primary.id)
            out.push({ symbol: primary, depth: depth + 1, via: 'CALLS' })
            queue.push({ id: primary.id, depth: depth + 1 })
          }
          // Also continue BFS from the file node for multi-hop file→symbol
          queue.push({ id: next, depth: depth + 1 })
          continue
        }
        const sym = symbolById(projectId, next)
        if (!sym) continue
        out.push({ symbol: sym, depth: depth + 1, via: 'CALLS' })
        queue.push({ id: next, depth: depth + 1 })
      }
    }
  }

  const startIds = rootList.map((r) => r.id)
  if (direction === 'inbound' || direction === 'both') {
    bfs(startIds, reverse, inbound, maxDepth)
  }
  if (direction === 'outbound' || direction === 'both') {
    bfs(startIds, forward, outbound, maxDepth)
  }

  return { root: rootList, inbound, outbound }
}

/** Fan-in (callers) count for symbols in a file. */
export function fileFanIn(projectId: string, filePath: string): number {
  const syms = symbolsInFile(projectId, filePath)
  if (syms.length === 0) return 0
  const { reverse } = loadEdges(projectId, 'CALLS')
  let count = 0
  const callers = new Set<string>()
  for (const s of syms) {
    for (const c of reverse.get(s.id) ?? []) {
      // Count file: callers as one fan-in unit each
      callers.add(c)
    }
  }
  count = callers.size
  return count
}

/** Files that call into symbols defined in seed files (call-graph expand). */
export function filesCallingInto(projectId: string, seedFiles: string[], maxDepth = 2): string[] {
  const seedSet = new Set(seedFiles)
  const { reverse } = loadEdges(projectId, 'CALLS')
  const seedSymIds = new Set<string>()
  for (const f of seedFiles) {
    for (const s of symbolsInFile(projectId, f)) seedSymIds.add(s.id)
  }
  const files = new Set<string>()
  const visited = new Set<string>(seedSymIds)
  let frontier = [...seedSymIds]
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const caller of reverse.get(id) ?? []) {
        if (visited.has(caller)) continue
        visited.add(caller)
        next.push(caller)
        if (caller.startsWith('file:')) {
          const fp = caller.slice('file:'.length)
          if (!seedSet.has(fp)) files.add(fp)
        } else {
          const sym = symbolById(projectId, caller)
          if (sym && !seedSet.has(sym.file)) files.add(sym.file)
        }
      }
    }
    frontier = next
  }
  return [...files]
}

export type { SymbolEdgeType }
