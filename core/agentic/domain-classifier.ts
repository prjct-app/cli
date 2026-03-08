/**
 * Domain Classifier
 *
 * Task domain classification with caching.
 * The host LLM already understands domains — prjct only stores
 * confirmed patterns from successful task completions.
 *
 * Fallback chain:
 * 1. Cache lookup (file-based, 1hr TTL)
 * 2. Confirmed patterns (from successful task completions)
 * 3. General fallback
 *
 * @see PRJ-299
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { CLASSIFICATION_CACHE_TTL_MS } from '../constants/timings'
import {
  type ClassificationCache,
  DEFAULT_CLASSIFICATION_CACHE,
  GENERAL_CLASSIFICATION,
  type TaskClassification,
} from '../schemas/classification'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { isExpired } from '../utils/cache'
import { writeJson } from '../utils/file-helper'
import { sha256Short } from '../utils/hash'

// =============================================================================
// Hashing
// =============================================================================

function hashDescription(description: string): string {
  return sha256Short(description.toLowerCase().trim())
}

// =============================================================================
// Cache Layer
// =============================================================================

async function loadCache(globalPath: string): Promise<ClassificationCache> {
  try {
    const cachePath = path.join(globalPath, 'storage', 'classification-cache.json')
    const content = await fs.readFile(cachePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (isNotFoundError(error)) return DEFAULT_CLASSIFICATION_CACHE
    console.warn('[classifier] Failed to load cache:', getErrorMessage(error))
    return DEFAULT_CLASSIFICATION_CACHE
  }
}

async function saveCache(globalPath: string, cache: ClassificationCache): Promise<void> {
  try {
    const cachePath = path.join(globalPath, 'storage', 'classification-cache.json')
    await writeJson(cachePath, cache)
  } catch (error) {
    console.warn('[classifier] Failed to save cache:', getErrorMessage(error))
  }
}

function lookupCache(
  cache: ClassificationCache,
  hash: string,
  projectId: string
): TaskClassification | null {
  const entry = cache.entries[hash]
  if (!entry) return null
  if (entry.projectId !== projectId) return null

  // Check TTL
  if (isExpired(entry.classifiedAt, CLASSIFICATION_CACHE_TTL_MS)) return null

  return entry.classification
}

// =============================================================================
// Confirmed Patterns (from successful task completions)
// =============================================================================

function lookupPatterns(cache: ClassificationCache, hash: string): TaskClassification | null {
  const pattern = cache.confirmedPatterns.find((p) => p.descriptionHash === hash)
  return pattern?.classification ?? null
}

// =============================================================================
// Main Classifier
// =============================================================================

export class DomainClassifier {
  /**
   * Classify a task description into a domain.
   *
   * Fallback chain:
   * 1. Cache lookup (1hr TTL)
   * 2. Confirmed patterns (from completed tasks)
   * 3. General fallback
   */
  async classify(
    description: string,
    projectId: string,
    globalPath: string
  ): Promise<{
    classification: TaskClassification
    source: 'cache' | 'history' | 'llm' | 'heuristic'
  }> {
    const hash = hashDescription(description)
    const cache = await loadCache(globalPath)

    // 1. Cache lookup
    const cached = lookupCache(cache, hash, projectId)
    if (cached) {
      return { classification: cached, source: 'cache' }
    }

    // 2. Confirmed patterns
    const pattern = lookupPatterns(cache, hash)
    if (pattern) {
      return { classification: pattern, source: 'history' }
    }

    // 3. Fallback → general (host LLM handles classification)
    return { classification: GENERAL_CLASSIFICATION, source: 'heuristic' }
  }

  /**
   * Persist a classification as a confirmed pattern after successful task completion.
   */
  async confirmClassification(
    description: string,
    classification: TaskClassification,
    globalPath: string
  ): Promise<void> {
    const hash = hashDescription(description)
    const cache = await loadCache(globalPath)

    // Check if already confirmed
    if (cache.confirmedPatterns.some((p) => p.descriptionHash === hash)) return

    cache.confirmedPatterns.push({
      descriptionHash: hash,
      classification,
      confirmedAt: new Date().toISOString(),
      taskDescription: description,
    })
    await saveCache(globalPath, cache)
  }
}

// Singleton
const domainClassifier = new DomainClassifier()
export default domainClassifier
export { hashDescription }
