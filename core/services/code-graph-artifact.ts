/**
 * Team-shared code graph artifact (CBM graph.db.zst-inspired).
 *
 * Exports a gzipped JSON snapshot of symbols + CALLS/DEFINES edges next to
 * the repo so teammates can bootstrap without a full reindex.
 *
 * Path: `.prjct/code-graph.json.gz`
 * Optional: `.gitattributes` merge=ours line for the artifact.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { hasSymbolIndex, indexSymbols, listAllSymbols, loadMeta } from '../domain/symbol-graph'
import prjctDb from '../storage/database'
import type { CodeSymbol, CodeSymbolEdge, SymbolGraphMeta } from '../types/domain.js'

const ARTIFACT_REL = path.join('.prjct', 'code-graph.json.gz')
const GITATTRIBUTES_LINE = '.prjct/code-graph.json.gz merge=ours'

interface ArtifactPayload {
  version: 1
  exportedAt: string
  meta: SymbolGraphMeta
  symbols: CodeSymbol[]
  edges: CodeSymbolEdge[]
}

export function artifactPath(projectPath: string): string {
  return path.join(projectPath, ARTIFACT_REL)
}

export async function exportCodeGraphArtifact(
  projectPath: string,
  projectId: string
): Promise<{ path: string; bytes: number; symbols: number; edges: number } | null> {
  if (!hasSymbolIndex(projectId)) return null
  const symbols = listAllSymbols(projectId)
  let edges: CodeSymbolEdge[] = []
  try {
    edges = prjctDb
      .query<{
        src: string
        dst: string
        edge_type: string
        confidence: number
      }>(projectId, 'SELECT src, dst, edge_type, confidence FROM code_symbol_edges')
      .map((r) => ({
        src: r.src,
        dst: r.dst,
        edgeType: r.edge_type as CodeSymbolEdge['edgeType'],
        confidence: r.confidence,
      }))
  } catch {
    edges = []
  }
  const meta = loadMeta(projectId) ?? {
    symbolCount: symbols.length,
    edgeCount: edges.length,
    fileCount: new Set(symbols.map((s) => s.file)).size,
    builtAt: new Date().toISOString(),
  }
  const payload: ArtifactPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    meta,
    symbols,
    edges,
  }
  const raw = Buffer.from(JSON.stringify(payload), 'utf-8')
  const gz = gzipSync(raw, { level: 6 })
  const out = artifactPath(projectPath)
  await fs.mkdir(path.dirname(out), { recursive: true })
  await fs.writeFile(out, gz)
  await ensureGitattributes(projectPath)
  return { path: ARTIFACT_REL, bytes: gz.length, symbols: symbols.length, edges: edges.length }
}

export async function importCodeGraphArtifact(
  projectPath: string,
  projectId: string
): Promise<{ imported: boolean; symbols: number; edges: number; reason?: string }> {
  const file = artifactPath(projectPath)
  let buf: Buffer
  try {
    buf = await fs.readFile(file)
  } catch {
    return { imported: false, symbols: 0, edges: 0, reason: 'no artifact' }
  }
  let payload: ArtifactPayload
  try {
    const json = gunzipSync(buf).toString('utf-8')
    payload = JSON.parse(json) as ArtifactPayload
  } catch (e) {
    return {
      imported: false,
      symbols: 0,
      edges: 0,
      reason: `corrupt artifact: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
  if (payload.version !== 1 || !Array.isArray(payload.symbols)) {
    return { imported: false, symbols: 0, edges: 0, reason: 'unsupported artifact version' }
  }

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
    for (const s of payload.symbols) {
      insSym.run(s.id, s.file, s.kind, s.name, s.qname, s.startLine, s.endLine, s.exported ? 1 : 0)
    }
    for (const e of payload.edges) {
      insEdge.run(e.src, e.dst, e.edgeType, e.confidence)
    }
  })
  prjctDb.setDoc(projectId, 'symbol-graph', {
    ...payload.meta,
    builtAt: payload.meta.builtAt ?? payload.exportedAt,
  })
  return {
    imported: true,
    symbols: payload.symbols.length,
    edges: payload.edges.length,
  }
}

/**
 * Bootstrap: if local index empty but artifact present, import then optional
 * incremental reindex of dirty tree is left to sync.
 */
export async function bootstrapCodeGraphFromArtifact(
  projectPath: string,
  projectId: string
): Promise<{ bootstrapped: boolean; detail: string }> {
  if (hasSymbolIndex(projectId)) {
    return { bootstrapped: false, detail: 'local index already present' }
  }
  const result = await importCodeGraphArtifact(projectPath, projectId)
  if (!result.imported) {
    return { bootstrapped: false, detail: result.reason ?? 'import failed' }
  }
  return {
    bootstrapped: true,
    detail: `imported ${result.symbols} symbols / ${result.edges} edges from ${ARTIFACT_REL}`,
  }
}

async function ensureGitattributes(projectPath: string): Promise<void> {
  const ga = path.join(projectPath, '.gitattributes')
  try {
    let existing = ''
    try {
      existing = await fs.readFile(ga, 'utf-8')
    } catch {
      existing = ''
    }
    if (existing.includes('code-graph.json.gz')) return
    const next = existing
      ? existing.endsWith('\n')
        ? `${existing}${GITATTRIBUTES_LINE}\n`
        : `${existing}\n${GITATTRIBUTES_LINE}\n`
      : `${GITATTRIBUTES_LINE}\n`
    await fs.writeFile(ga, next)
  } catch {
    /* best-effort */
  }
}

/** After a successful full index, refresh the team artifact (non-fatal). */
export async function maybeExportAfterIndex(projectPath: string, projectId: string): Promise<void> {
  try {
    await exportCodeGraphArtifact(projectPath, projectId)
  } catch {
    /* non-critical */
  }
}

export async function ensureIndexWithBootstrap(
  projectPath: string,
  projectId: string
): Promise<SymbolGraphMeta | null> {
  if (hasSymbolIndex(projectId)) return loadMeta(projectId)
  const boot = await bootstrapCodeGraphFromArtifact(projectPath, projectId)
  if (boot.bootstrapped) return loadMeta(projectId)
  // No artifact — full index
  return indexSymbols(projectPath, projectId)
}
