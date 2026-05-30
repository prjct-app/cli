/**
 * Stable content fingerprint for memory duplicate detection.
 *
 * Normalizes away trivial formatting noise — case, leading/trailing space, and
 * internal whitespace runs — so two captures of the same knowledge collapse to
 * the same hash. Two consumers MUST agree on this normalization, so it lives
 * here (one tiny module, only `node:crypto`) and is imported by both:
 *   - `projectMemory.remember()` — skips a verbatim re-capture (the dedup net)
 *   - migration `memory-dedup-content-hash` — backfills `memories.content_hash`
 *     and purges the historical duplicates that landed before the net existed
 *
 * Keep this dependency-free to avoid an import cycle through the storage layer.
 */

import crypto from 'node:crypto'

/** sha256 of the case- and whitespace-normalized content. */
export function memoryFingerprint(content: string): string {
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
