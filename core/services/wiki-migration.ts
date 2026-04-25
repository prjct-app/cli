/**
 * Wiki location migration — pre-2.2.0 → 2.2.0
 *
 * Pre-2.2.0 hardcoded the Obsidian vault at `<repo>/.prjct/wiki/`. That
 * location was hidden (invisible in Finder/Explorer by default) and lived
 * inside the repo, so any `git push` leaked personal decisions and
 * learnings. 2.2.0 moves the default to `~/Documents/prjct/<slug>/`
 * (visible + outside the repo).
 *
 * This module performs a best-effort, idempotent, one-shot migration the
 * first time a 2.2.0+ binary touches an existing project. It's safe to
 * call on every wiki-generator / wiki-ingest entry: if there's nothing to
 * move, it's a near-zero cost stat check.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'

const GITIGNORE_MARKER = '# prjct: legacy wiki — vault moved to ~/Documents/prjct/ in 2.2.0'
const LEGACY_GITIGNORE_LINE = '.prjct/wiki/'

interface WikiMigrationResult {
  moved: boolean
  reason?: 'no-legacy' | 'already-migrated' | 'user-override' | 'conflict' | 'moved'
  from?: string
  to?: string
  filesMoved?: number
}

/**
 * Resolve the project's vault root after running the 2.2.0 migration.
 * Single source of truth for the `migrate → readConfig → getWikiPath`
 * dance that wiki-generator and wiki-ingest both need.
 */
export async function resolveVaultRoot(projectPath: string): Promise<string> {
  await migrateWikiLocationIfNeeded(projectPath)
  const config = await configManager.readConfig(projectPath).catch(() => null)
  return pathManager.getWikiPath(projectPath, config?.vaultPath)
}

/**
 * Detect and migrate a legacy `.prjct/wiki/` folder to the 2.2.0 default.
 * Idempotent: safe to call from every wiki entry point.
 *
 * Rules:
 *   - If user set `vaultPath` in config → skip (respect explicit override).
 *   - If legacy path does not exist → skip.
 *   - If legacy path exists but new path already has content → skip
 *     (refuse to overwrite; user must resolve manually).
 *   - Otherwise → move legacy → new default, create parent dirs, add a
 *     gitignore entry for the legacy path, return a report.
 */
export async function migrateWikiLocationIfNeeded(
  projectPath: string
): Promise<WikiMigrationResult> {
  const config = await configManager.readConfig(projectPath).catch(() => null)
  if (config?.vaultPath && config.vaultPath.trim().length > 0) {
    return { moved: false, reason: 'user-override' }
  }

  const legacyPath = pathManager.getLegacyWikiPath(projectPath)
  const legacyHasContent = await dirHasContent(legacyPath)
  if (!legacyHasContent) {
    return { moved: false, reason: 'no-legacy' }
  }

  const newPath = pathManager.getWikiPath(projectPath)
  const newPathHasContent = await dirHasContent(newPath)
  if (newPathHasContent) {
    // Don't overwrite the user's in-progress content at the new location.
    // The legacy folder stays put; user resolves manually.
    // Log a hint via stderr so it shows up but doesn't break commands.
    console.error(
      `⚠ prjct: legacy wiki at ${legacyPath} was NOT migrated — ${newPath} already has content.\n` +
        `  Merge manually or set \`vaultPath\` in .prjct/prjct.config.json to choose one.`
    )
    return { moved: false, reason: 'conflict', from: legacyPath, to: newPath }
  }

  // Perform the move.
  await fs.mkdir(path.dirname(newPath), { recursive: true })
  const filesMoved = await moveDirectory(legacyPath, newPath)
  await ensureLegacyGitignore(projectPath)

  console.error(
    `ℹ prjct: migrated Obsidian vault\n` +
      `    from: ${pathManager.getDisplayPath(legacyPath)}\n` +
      `    to:   ${pathManager.getDisplayPath(newPath)}\n` +
      `    (set \`vaultPath\` in .prjct/prjct.config.json to override)`
  )

  return { moved: true, reason: 'moved', from: legacyPath, to: newPath, filesMoved }
}

async function dirHasContent(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath)
    // Ignore lone `.DS_Store` / `.gitkeep` so a stale empty dir doesn't
    // block the migration.
    const meaningful = entries.filter((e) => e !== '.DS_Store' && e !== '.gitkeep')
    return meaningful.length > 0
  } catch {
    return false
  }
}

/**
 * Move a directory tree. Uses `fs.rename` first (atomic on same
 * filesystem); falls back to copy+delete when rename would cross device
 * boundaries (EXDEV) — common when the repo is on an external drive and
 * $HOME is on the internal one.
 */
async function moveDirectory(src: string, dest: string): Promise<number> {
  try {
    await fs.rename(src, dest)
    return await countFiles(dest)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'EXDEV') throw err
    // Cross-device: copy then remove.
    await copyRecursive(src, dest)
    const count = await countFiles(dest)
    await fs.rm(src, { recursive: true, force: true })
    return count
  }
}

async function copyRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath)
    }
    // symlinks intentionally skipped — wiki is plain markdown
  }
}

async function countFiles(dirPath: string): Promise<number> {
  let count = 0
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) count += await countFiles(full)
    else if (entry.isFile()) count++
  }
  return count
}

/**
 * Append a `.prjct/wiki/` entry to the repo's `.gitignore` so the legacy
 * folder doesn't reappear in status. Idempotent: checks for the marker
 * before appending.
 */
async function ensureLegacyGitignore(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore')
  let existing = ''
  try {
    existing = await fs.readFile(gitignorePath, 'utf-8')
  } catch {
    // No .gitignore yet — create one only if the project is a git repo.
    const isGitRepo = await fileExists(path.join(projectPath, '.git'))
    if (!isGitRepo) return
  }

  if (existing.includes(LEGACY_GITIGNORE_LINE)) return

  const addition = `\n${GITIGNORE_MARKER}\n${LEGACY_GITIGNORE_LINE}\n`
  const next =
    existing.endsWith('\n') || existing.length === 0
      ? existing + addition
      : `${existing}${addition}`
  await fs.writeFile(gitignorePath, next, 'utf-8')
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

// Expose for tests
const __testing = {
  LEGACY_GITIGNORE_LINE,
  GITIGNORE_MARKER,
  dirHasContent,
  moveDirectory,
}
