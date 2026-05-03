/**
 * Disk I/O + manifest diffing for the generated vault.
 *
 * Manifest = `{ relPath: sha256 }`. Lets us short-circuit unchanged
 * files on the next regen and detect strays. The orchestrator owns
 * the diff loop; this module just exposes the file-system primitives.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Manifest } from './_shared'

export const MANIFEST_FILE = '.manifest.json'

export async function readManifest(root: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(path.join(root, MANIFEST_FILE), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Manifest
    return {}
  } catch {
    return {}
  }
}

export async function writeFile(root: string, relPath: string, body: string): Promise<void> {
  const fullPath = path.join(root, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, body, 'utf-8')
}

export async function removeFile(root: string, relPath: string): Promise<void> {
  try {
    await fs.rm(path.join(root, relPath), { force: true })
  } catch {
    // non-critical
  }
}

/**
 * Walk the generated tree and delete any .md file that isn't in the
 * new manifest. Catches iCloud duplicate artifacts (" 2.md") and any
 * stragglers from previous regens whose manifest got lost.
 *
 * Safe because `_generated/` is 100% generator-owned — user notes live
 * above it at the vault root and in `captured/`.
 */
export async function sweepStaleFiles(root: string, keep: Manifest): Promise<number> {
  let removed = 0
  const walk = async (dir: string): Promise<void> => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        // Prune empty directories — they accumulate after sweeps.
        try {
          const remaining = await fs.readdir(full)
          if (remaining.length === 0) await fs.rmdir(full)
        } catch {
          // Non-critical.
        }
        continue
      }
      if (!entry.name.endsWith('.md')) continue
      const rel = path.relative(root, full)
      if (keep[rel]) continue
      try {
        await fs.rm(full, { force: true })
        removed++
      } catch {
        // Non-critical.
      }
    }
  }
  await walk(root)
  return removed
}
