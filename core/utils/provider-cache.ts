import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProviderDetectionResult } from '../types/provider'

const CACHE_DIR = path.join(os.homedir(), '.prjct-cli', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'providers.json')
const TTL_MS = 10 * 60 * 1000 // 10 minutes

interface ProviderCache {
  timestamp: string
  detection: {
    claude: ProviderDetectionResult
    gemini: ProviderDetectionResult
  }
}

export async function readProviderCache(): Promise<ProviderCache['detection'] | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache: ProviderCache = JSON.parse(raw)

    if (!cache.timestamp || !cache.detection) return null

    const age = Date.now() - new Date(cache.timestamp).getTime()
    if (age > TTL_MS) return null

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
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
}

export async function invalidateProviderCache(): Promise<void> {
  try {
    await fs.unlink(CACHE_FILE)
  } catch {
    // File doesn't exist — fine
  }
}
