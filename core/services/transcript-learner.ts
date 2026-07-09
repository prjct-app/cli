/**
 * Transcript Learner — extract durable insights from a Claude Code
 * session transcript and persist them as project memory.
 *
 * Why this exists: even when prjct is installed, Claude routinely does
 * substantive analysis during a turn (decisions, root-cause findings,
 * gotchas discovered) without explicitly calling `prjct remember`. The
 * next session has to re-derive the same insights from source. This
 * service is the safety net: at session end, scan what the assistant
 * said and lift the substantive bits into SQLite as memory entries.
 *
 * Design constraints (from mem_899: efficiency contract):
 *   - Asynchronous, best-effort, never blocks session close
 *   - Idempotent: hash-based dedup, re-running on the same transcript
 *     never doubles entries
 *   - Conservative heuristics: high precision, low recall. False
 *     positives are worse than misses — the user can always call
 *     `prjct remember` explicitly. Noise erodes trust in the vault.
 *   - Tag entries with `source:transcript-auto` so the user can filter,
 *     audit, or `prjct memory prune --auto` if it gets noisy.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import configManager from '../infrastructure/config-manager'
import type { MemoryType } from '../memory/entries'
import { projectMemory } from '../memory/project-memory'
import type { LocalConfig } from '../types/config'
import { parseTranscriptJsonl, type TranscriptJsonlLine } from './transcript-jsonl'

const SOURCE_TAG = 'transcript-auto'
const CAPTURE_VERSION = 'v2'
const MIN_PARAGRAPH_CHARS = 80
const MAX_CONTENT_CHARS = 1500
const MAX_CANDIDATES_PER_SESSION = 12

interface Candidate {
  type: MemoryType
  content: string
  hash: string
  matchedPhrase: string
}

interface IngestResult {
  scanned: number
  ingested: number
  skipped: { reason: string; phrase?: string }[]
  errors: string[]
}

/**
 * Phrases that signal the assistant was making a durable claim. Each
 * phrase maps to a memory type. Match is case-insensitive substring
 * against the paragraph's lowercase form.
 *
 * Capture v2 keeps high precision: every phrase must still read as a
 * durable claim, not conversational filler. Label-prefix classifiers
 * (see LABEL_TYPE_MAP) cover the structured forms models prefer.
 */
const PHRASE_TYPE_MAP: Array<{ phrase: string; type: MemoryType }> = [
  // Decisions
  { phrase: 'decided to', type: 'decision' },
  { phrase: 'we chose', type: 'decision' },
  { phrase: 'going with', type: 'decision' },
  { phrase: 'the right call', type: 'decision' },
  { phrase: 'best approach is', type: 'decision' },
  { phrase: 'we will use', type: 'decision' },
  { phrase: 'shipping with', type: 'decision' },
  { phrase: 'decidimos', type: 'decision' },
  { phrase: 'la decisión es', type: 'decision' },
  // Learnings
  { phrase: 'turns out that', type: 'learning' },
  { phrase: 'now i understand', type: 'learning' },
  { phrase: 'the key insight', type: 'learning' },
  { phrase: 'i learned that', type: 'learning' },
  { phrase: 'discovered that', type: 'learning' },
  { phrase: 'root cause is', type: 'learning' },
  { phrase: 'root cause was', type: 'learning' },
  { phrase: 'the fix is', type: 'learning' },
  { phrase: 'resulta que', type: 'learning' },
  // Gotchas
  { phrase: 'gotcha:', type: 'gotcha' },
  { phrase: 'bug:', type: 'gotcha' },
  { phrase: 'fails when', type: 'gotcha' },
  { phrase: 'breaks when', type: 'gotcha' },
  { phrase: 'be careful', type: 'gotcha' },
  { phrase: 'never do this', type: 'gotcha' },
  { phrase: 'trap:', type: 'gotcha' },
  { phrase: 'cuidado:', type: 'gotcha' },
  // Facts / durable project truth
  { phrase: 'important:', type: 'fact' },
  { phrase: 'always use', type: 'fact' },
  { phrase: 'never write', type: 'fact' },
  // Patterns
  { phrase: 'the pattern is', type: 'pattern' },
  { phrase: 'anti-pattern:', type: 'anti-pattern' },
  { phrase: 'antipattern:', type: 'anti-pattern' },
]

/**
 * Structured label prefixes — models often write `Decision: …` or
 * `**Gotcha** …` without the conversational phrases above. Matched at
 * the start of a paragraph / bullet (after optional markdown/list markers).
 */
const LABEL_TYPE_MAP: Array<{ re: RegExp; type: MemoryType; phrase: string }> = [
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(decision|decisión)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'decision',
    phrase: 'label:decision',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(learning|aprendizaje|insight)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'learning',
    phrase: 'label:learning',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(gotcha|trap|cuidado|warning)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'gotcha',
    phrase: 'label:gotcha',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(fact|dato|note)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'fact',
    phrase: 'label:fact',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(root\s*cause|causa\s*raíz)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'learning',
    phrase: 'label:root-cause',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(pattern|patrón)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'pattern',
    phrase: 'label:pattern',
  },
  {
    re: /^(?:[-*•]\s+)?(?:\*\*)?(anti[- ]?pattern|anti[- ]?patrón)(?:\*\*)?\s*[:—-]\s+/i,
    type: 'anti-pattern',
    phrase: 'label:anti-pattern',
  },
]

/**
 * Public entry: read a Claude Code transcript JSONL, extract durable
 * candidates, persist them as memory, return a report.
 *
 * Caller (Stop hook) wraps in try/catch and discards errors. We surface
 * `errors` on the result for tests + future telemetry.
 */
export async function ingestTranscript(
  projectPath: string,
  transcriptPath: string,
  sessionId: string | null,
  opts: { preloadedConfig?: LocalConfig | null; preloadedLines?: TranscriptJsonlLine[] } = {}
): Promise<IngestResult> {
  const result: IngestResult = { scanned: 0, ingested: 0, skipped: [], errors: [] }

  const config =
    opts.preloadedConfig !== undefined
      ? opts.preloadedConfig
      : await configManager.readConfig(projectPath).catch(() => null)
  if (!config?.projectId) {
    result.errors.push('no project config')
    return result
  }

  let lines: TranscriptJsonlLine[]
  if (opts.preloadedLines) {
    lines = opts.preloadedLines
  } else {
    let raw: string
    try {
      raw = await fs.readFile(transcriptPath, 'utf-8')
    } catch (err) {
      result.errors.push(`transcript read failed: ${(err as Error).message}`)
      return result
    }
    lines = parseTranscriptJsonl(raw)
  }

  const messages = projectMessages(lines)
  result.scanned = messages.length
  if (messages.length === 0) return result

  const candidates = extractCandidates(messages)
  if (candidates.length === 0) return result

  // Dedup against memory we already wrote from previous transcript
  // ingests. We tag every auto-captured entry with `source:transcript-auto`
  // and embed the content hash in the tags as `hash:<first16>` so this
  // check is one query + a Set lookup.
  const existingHashes = collectExistingAutoHashes(config.projectId)

  const sessionTag = sessionId ? sessionId.slice(0, 12) : 'unknown'
  for (const cand of candidates) {
    if (existingHashes.has(cand.hash)) {
      result.skipped.push({ reason: 'duplicate', phrase: cand.matchedPhrase })
      continue
    }
    try {
      await projectMemory.remember(projectPath, {
        type: cand.type,
        content: cand.content,
        tags: {
          source: SOURCE_TAG,
          capture: CAPTURE_VERSION,
          session: sessionTag,
          hash: cand.hash,
          phrase: cand.matchedPhrase,
        },
        provenance: 'inferred',
        projectId: config.projectId,
      })
      result.ingested += 1
    } catch (err) {
      result.errors.push(`remember failed: ${(err as Error).message}`)
    }
  }

  return result
}

// Transcript parsing

interface TranscriptMessage {
  role: 'assistant' | 'user' | 'system'
  text: string
}

/**
 * Best-effort JSONL parser. Claude Code's transcript shape varies by
 * version, but the contract we depend on is minimal: each line is JSON
 * with a recognizable role + extractable text content.
 *
 * We only care about `assistant` messages with substantive text. Tool
 * calls, tool results, and user turns are skipped.
 */
function parseTranscript(raw: string): TranscriptMessage[] {
  return projectMessages(parseTranscriptJsonl(raw))
}

/** Typed projection over shared raw lines: assistant turns with real text. */
function projectMessages(lines: TranscriptJsonlLine[]): TranscriptMessage[] {
  const out: TranscriptMessage[] = []
  for (const parsed of lines) {
    const role = inferRole(parsed)
    if (role !== 'assistant') continue
    const text = extractText(parsed)
    if (!text || text.length < MIN_PARAGRAPH_CHARS) continue
    out.push({ role, text })
  }
  return out
}

function inferRole(msg: Record<string, unknown>): TranscriptMessage['role'] | null {
  // Try common shapes: top-level `role`, nested `message.role`, or
  // `type` field. Fall through quietly if unrecognized.
  const direct = msg.role
  if (typeof direct === 'string') return normalizeRole(direct)
  const nested = msg.message
  if (nested && typeof nested === 'object' && 'role' in nested) {
    const r = (nested as Record<string, unknown>).role
    if (typeof r === 'string') return normalizeRole(r)
  }
  const type = msg.type
  if (type === 'assistant' || type === 'user' || type === 'system') return type
  return null
}

function normalizeRole(r: string): TranscriptMessage['role'] | null {
  const lower = r.toLowerCase()
  if (lower === 'assistant' || lower === 'user' || lower === 'system') {
    return lower as TranscriptMessage['role']
  }
  return null
}

/**
 * Pull the assistant's textual output from whatever shape the line
 * uses. Claude Code emits content as either a string or an array of
 * `{type:'text', text:'...'}` blocks. Tool-use blocks are dropped.
 */
function extractText(msg: Record<string, unknown>): string {
  // Some shapes nest under message.content
  let content: unknown = msg.content
  if (content === undefined && msg.message && typeof msg.message === 'object') {
    content = (msg.message as Record<string, unknown>).content
  }
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    }
    return parts.join('\n').trim()
  }
  return ''
}

// Candidate extraction

/**
 * Classify a single paragraph into a typed capture, or null.
 * Label-prefix wins over freeform phrase match (higher precision).
 */
export function classifyCaptureParagraph(
  para: string
): { type: MemoryType; matchedPhrase: string } | null {
  const trimmed = para.trim()
  if (trimmed.length < MIN_PARAGRAPH_CHARS) return null

  for (const label of LABEL_TYPE_MAP) {
    if (label.re.test(trimmed)) {
      return { type: label.type, matchedPhrase: label.phrase }
    }
  }

  const lower = trimmed.toLowerCase()
  const match = PHRASE_TYPE_MAP.find((m) => lower.includes(m.phrase))
  if (!match) return null
  return { type: match.type, matchedPhrase: match.phrase }
}

/**
 * Walk assistant messages, return the substantive paragraphs that
 * trigger a recognized label or phrase. Capped at
 * MAX_CANDIDATES_PER_SESSION so a chatty session doesn't flood the
 * memory store.
 */
function extractCandidates(messages: TranscriptMessage[]): Candidate[] {
  const candidates: Candidate[] = []
  const seen = new Set<string>()

  for (const msg of messages) {
    const paragraphs = splitParagraphs(msg.text)
    for (const para of paragraphs) {
      if (candidates.length >= MAX_CANDIDATES_PER_SESSION) return candidates
      const classified = classifyCaptureParagraph(para)
      if (!classified) continue
      const trimmed =
        para.length > MAX_CONTENT_CHARS ? `${para.slice(0, MAX_CONTENT_CHARS)}…` : para
      const hash = hashContent(trimmed)
      if (seen.has(hash)) continue
      seen.add(hash)
      candidates.push({
        type: classified.type,
        content: trimmed,
        hash,
        matchedPhrase: classified.matchedPhrase,
      })
    }
  }

  return candidates
}

function splitParagraphs(text: string): string[] {
  // Blank-line paragraphs plus single-line bullets so `Decision: …` lines
  // in a dense list still surface without needing double newlines.
  const blocks = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const hasLabeledBullet = lines.some((l) => LABEL_TYPE_MAP.some((m) => m.re.test(l)))
    if (hasLabeledBullet && lines.length > 1) {
      for (const line of lines) out.push(line)
    } else {
      out.push(block)
    }
  }
  return out
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content.toLowerCase().trim()).digest('hex').slice(0, 16)
}

// Dedup against previously ingested entries

interface AutoMemoryRow {
  data: string
}

function collectExistingAutoHashes(projectId: string): Set<string> {
  const out = new Set<string>()
  try {
    // We tag every auto-captured entry with `source:transcript-auto` and
    // embed the hash in `tags.hash`. Pull recent events and parse out
    // the hashes — same pattern projectMemory.recall uses.
    const { prjctDb } = require('../storage/database') as typeof import('../storage/database')
    const { REMEMBER_EVENT_RANGE } =
      require('../memory/events') as typeof import('../memory/events')
    const rows = prjctDb.query<AutoMemoryRow>(
      projectId,
      'SELECT data FROM events WHERE type >= ? AND type < ? ORDER BY id DESC LIMIT 500',
      ...REMEMBER_EVENT_RANGE
    )
    for (const row of rows) {
      let parsed: unknown
      try {
        parsed = JSON.parse(row.data)
      } catch {
        continue
      }
      if (!parsed || typeof parsed !== 'object') continue
      const tags = (parsed as { tags?: Record<string, unknown> }).tags
      if (!tags || tags.source !== SOURCE_TAG) continue
      const h = tags.hash
      if (typeof h === 'string') out.add(h)
    }
  } catch {
    // Best-effort: a missing dedup index just means we may write a
    // duplicate this turn; the user can prune.
  }
  return out
}

// Test exports

export const _internal = {
  parseTranscript,
  extractCandidates,
  hashContent,
  PHRASE_TYPE_MAP,
  LABEL_TYPE_MAP,
  classifyCaptureParagraph,
  CAPTURE_VERSION,
  SOURCE_TAG,
}
