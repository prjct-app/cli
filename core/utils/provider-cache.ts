import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type { ProviderDetectionResult } from '../types/provider'
import { isExpired } from './cache'
import { writeJson } from './file-helper'

// Lazy (not a module const): resolve via pathManager at call time so
// PRJCT_CLI_HOME and test-time setGlobalBaseDir overrides are honored.
// Production (no override) === ~/.prjct-cli/cache, unchanged.
const cacheFile = (): string => path.join(pathManager.getCachePath(), 'providers.json')
const TTL_MS = 10 * 60 * 1000 // 10 minutes

interface ProviderCache {
  timestamp: string
  detection: {
    claude: ProviderDetectionResult
    gemini: ProviderDetectionResult
    codex: ProviderDetectionResult
  }
}

export async function readProviderCache(): Promise<ProviderCache['detection'] | null> {
  try {
    const raw = await fs.readFile(cacheFile(), 'utf-8')
    const cache: ProviderCache = JSON.parse(raw)

    if (!cache.timestamp || !cache.detection) return null
    if (!cache.detection.claude || !cache.detection.gemini || !cache.detection.codex) return null

    if (isExpired(cache.timestamp, TTL_MS)) return null

    return cache.detection
  } catch {
    return null
  }
}

export async function writeProviderCache(detection: ProviderCache['detection']): Promise<void> {
  const cache: ProviderCache = {
    timestamp: new Date().toISOString(),
    detection,
  }
  await writeJson(cacheFile(), cache)
}

export async function invalidateProviderCache(): Promise<void> {
  try {
    await fs.unlink(cacheFile())
  } catch {
    // File doesn't exist — fine
  }
}
