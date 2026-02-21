/**
 * Command Context Resolver
 *
 * Replaces 4 hardcoded command lists in prompt-builder with config-driven lookups.
 * Falls back to LLM classification for unknown commands (Phase 2).
 * Auto-learns after repeated classifications (Phase 3).
 *
 * @see PRJ-298
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  type CommandContextConfig,
  CommandContextConfigSchema,
  type CommandContextEntry,
} from '../schemas/command-context'
import type { Template } from '../types/agentic'
import { PACKAGE_ROOT } from '../utils/version'
import { classifyCommand } from './command-classifier'

const CONFIG_PATH = path.join(PACKAGE_ROOT, 'core/config/command-context.config.json')

let cachedConfig: CommandContextConfig | null = null

/**
 * Load and validate the command context config.
 * Cached after first load for the process lifetime.
 */
export async function loadCommandContextConfig(): Promise<CommandContextConfig> {
  if (cachedConfig) return cachedConfig

  const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
  const parsed = JSON.parse(raw)
  cachedConfig = CommandContextConfigSchema.parse(parsed)
  return cachedConfig
}

/**
 * Get context config for a command.
 * Returns the command's config if explicitly defined, otherwise falls back to wildcard '*'.
 */
export function resolveCommandContext(
  config: CommandContextConfig,
  commandName: string
): CommandContextEntry {
  return config.commands[commandName] ?? config.commands['*']
}

// =============================================================================
// LLM Classification Cache (Phase 2)
// =============================================================================

const classificationCache = new Map<string, CommandContextEntry>()

/**
 * Get a cached LLM classification result for a command.
 */
export function getCachedClassification(commandName: string): CommandContextEntry | undefined {
  return classificationCache.get(commandName)
}

/**
 * Cache an LLM classification result for a command.
 */
export function cacheClassification(commandName: string, entry: CommandContextEntry): void {
  classificationCache.set(commandName, entry)
}

// =============================================================================
// Auto-Learn Tracking (Phase 3)
// =============================================================================

const classificationHistory = new Map<string, { entry: CommandContextEntry; count: number }>()

const AUTO_LEARN_THRESHOLD = 3

/**
 * Track a classification result. Returns true if the threshold is reached
 * and the classification should be persisted to config.
 */
export function trackClassification(commandName: string, entry: CommandContextEntry): boolean {
  const key = commandName
  const existing = classificationHistory.get(key)

  if (existing && isSameEntry(existing.entry, entry)) {
    existing.count++
    return existing.count >= AUTO_LEARN_THRESHOLD
  }

  classificationHistory.set(key, { entry, count: 1 })
  return false
}

/**
 * Persist a learned classification to the config file.
 */
export async function persistClassification(
  commandName: string,
  entry: CommandContextEntry
): Promise<void> {
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
  const config = JSON.parse(raw) as CommandContextConfig

  config.commands[commandName] = entry
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')

  // Invalidate cache so next load picks up the change
  cachedConfig = null
}

function isSameEntry(a: CommandContextEntry, b: CommandContextEntry): boolean {
  return (
    a.agents === b.agents &&
    a.patterns === b.patterns &&
    a.checklist === b.checklist &&
    a.modules.length === b.modules.length &&
    a.modules.every((m, i) => m === b.modules[i])
  )
}

// =============================================================================
// Convenience: resolve with all fallbacks
// =============================================================================

/**
 * Resolve command context with full fallback chain:
 * 1. Config lookup (instant)
 * 2. Classification cache (instant)
 * 3. Template heuristic classification (instant) — caches result + tracks for auto-learn
 * 4. Wildcard default (instant)
 *
 * Returns { entry, source } where source indicates how it was resolved.
 */
export function resolveCommandContextFull(
  config: CommandContextConfig,
  commandName: string,
  template?: Template
): { entry: CommandContextEntry; source: 'config' | 'classified' | 'cache' | 'wildcard' } {
  // 1. Explicit config match
  if (commandName in config.commands && commandName !== '*') {
    return { entry: config.commands[commandName], source: 'config' }
  }

  // 2. Classification cache
  const cached = getCachedClassification(commandName)
  if (cached) {
    return { entry: cached, source: 'cache' }
  }

  // 3. Template heuristic classification
  if (template) {
    const classified = classifyCommand(commandName, template)
    cacheClassification(commandName, classified)

    // Track for auto-learn (Phase 3)
    const shouldPersist = trackClassification(commandName, classified)
    if (shouldPersist) {
      // Fire-and-forget persist — don't block prompt building
      persistClassification(commandName, classified).catch(() => {})
    }

    return { entry: classified, source: 'classified' }
  }

  // 4. Wildcard default
  return { entry: config.commands['*'], source: 'wildcard' }
}
