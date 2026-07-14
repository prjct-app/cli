/**
 * Optional codebase-memory-mcp (CBM) bridge.
 *
 * prjct owns harness + authored memory + native symbol graph. When the
 * CBM binary is on PATH, we surface it as a polyglot upgrade path without
 * making it a hard dependency.
 */

import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface CbmStatus {
  available: boolean
  path: string | null
  version: string | null
  note: string
}

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'where' : 'which',
      [cmd],
      { timeout: 2000 }
    )
    const first = stdout.trim().split(/\r?\n/)[0]
    return first || null
  } catch {
    return null
  }
}

export async function detectCbm(): Promise<CbmStatus> {
  const bin = await which('codebase-memory-mcp')
  if (!bin) {
    return {
      available: false,
      path: null,
      version: null,
      note: 'CBM not on PATH. Native prjct symbol graph is active. Install: https://github.com/DeusData/codebase-memory-mcp',
    }
  }
  let version: string | null = null
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['--version'], { timeout: 3000 })
    version = (stdout || stderr).trim().split(/\r?\n/)[0] || null
  } catch {
    try {
      const { stdout, stderr } = await execFileAsync(bin, ['version'], { timeout: 3000 })
      version = (stdout || stderr).trim().split(/\r?\n/)[0] || null
    } catch {
      version = 'unknown'
    }
  }
  return {
    available: true,
    path: bin,
    version,
    note: 'CBM available. prjct native graph remains default; use CBM for polyglot Hybrid-LSP depth when needed.',
  }
}

export function formatCbmStatus(s: CbmStatus): string {
  if (!s.available) return `CBM: not installed — ${s.note}`
  return `CBM: ${s.path}${s.version ? ` (${s.version})` : ''} — ${s.note}`
}

/** Soft path check for a project-local binary too. */
export async function detectCbmNear(projectPath: string): Promise<string | null> {
  const global = await which('codebase-memory-mcp')
  if (global) return global
  const local = path.join(projectPath, 'node_modules', '.bin', 'codebase-memory-mcp')
  try {
    await access(local)
    return local
  } catch {
    return null
  }
}
