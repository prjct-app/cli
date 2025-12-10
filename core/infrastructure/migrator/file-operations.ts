/**
 * File Operations
 * Handles file copying and mapping for migrations.
 */

import fs from 'fs/promises'
import path from 'path'
import type { FileMapping, MigrationStats, LayerCounts } from './types'

/**
 * Copy a directory recursively
 */
export async function copyDirectory(source: string, destination: string): Promise<number> {
  let fileCount = 0

  await fs.mkdir(destination, { recursive: true })

  const entries = await fs.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      fileCount += await copyDirectory(sourcePath, destPath)
    } else {
      await fs.copyFile(sourcePath, destPath)
      fileCount++
    }
  }

  return fileCount
}

/**
 * Map legacy flat structure to new layered structure
 */
export function mapLegacyFile(filename: string): FileMapping {
  if (filename === 'now.md' || filename === 'next.md' || filename === 'context.md') {
    return { layer: 'core', filename }
  }

  if (filename === 'shipped.md' || filename === 'metrics.md') {
    return { layer: 'progress', filename }
  }

  if (filename === 'ideas.md' || filename === 'roadmap.md') {
    return { layer: 'planning', filename }
  }

  if (
    filename === 'memory.jsonl' ||
    filename === 'context.jsonl' ||
    filename === 'decisions.jsonl'
  ) {
    return { layer: 'memory', filename }
  }

  if (filename === 'repo-summary.md') {
    return { layer: 'analysis', filename }
  }

  return { layer: '.', filename }
}

/**
 * Migrate files from legacy structure to new layered structure
 */
export async function migrateFiles(legacyPath: string, globalPath: string): Promise<MigrationStats> {
  let fileCount = 0
  const layerCounts: LayerCounts = {
    core: 0,
    progress: 0,
    planning: 0,
    analysis: 0,
    memory: 0,
    other: 0,
  }

  const validLayers = ['core', 'progress', 'planning', 'analysis', 'memory', 'sessions']
  const entries = await fs.readdir(legacyPath, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(legacyPath, entry.name)

    if (entry.name === 'prjct.config.json' || entry.name.endsWith('.old')) {
      continue
    }

    if (entry.isDirectory()) {
      if (validLayers.includes(entry.name)) {
        const destPath = path.join(globalPath, entry.name)
        const count = await copyDirectory(sourcePath, destPath)
        fileCount += count
        if (Object.prototype.hasOwnProperty.call(layerCounts, entry.name)) {
          layerCounts[entry.name as keyof LayerCounts] += count
        } else {
          layerCounts.other += count
        }
      } else {
        const destPath = path.join(globalPath, 'planning', entry.name)
        const count = await copyDirectory(sourcePath, destPath)
        fileCount += count
        layerCounts.planning += count
      }
    } else {
      const mapping = mapLegacyFile(entry.name)
      const destPath = path.join(globalPath, mapping.layer, mapping.filename)

      await fs.mkdir(path.dirname(destPath), { recursive: true })

      await fs.copyFile(sourcePath, destPath)
      fileCount++

      if (mapping.layer === '.') {
        layerCounts.other++
      } else {
        layerCounts[mapping.layer as keyof LayerCounts] =
          (layerCounts[mapping.layer as keyof LayerCounts] || 0) + 1
      }
    }
  }

  return { fileCount, layerCounts }
}
