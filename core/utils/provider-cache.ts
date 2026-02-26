import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProviderDetectionResult } from '../types/provider'
import { isExpired } from './cache'
import { writeJson } from './file-helper'

const CACHE_DIR = path.join(os.homedir(), '.prjct-cli', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'providers.json')
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
    const raw = await fs.readFile(CACHE_FILE, 'utf-8')
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
  await writeJson(CACHE_FILE, cache)
}

export async function invalidateProviderCache(): Promise<void> {
  try {
    await fs.unlink(CACHE_FILE)
  } catch {
    // File doesn't exist — fine
  }
}
