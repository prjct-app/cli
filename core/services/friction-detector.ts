/**
 * Friction detector — scans the Claude Code session transcript at
 * Stop time for moments of user friction and persists them as
 * `improvement-signal` memory entries.
 *
 * Design principle (matches the verb-intent-map philosophy: the LLM
 * is the engine, not regex): we DO NOT pretend to infer deep intent
 * from regex. We convert a high-confidence pushback moment into a
 * conservative structured lesson: what happened, why it mattered,
 * the pattern/anti-pattern, and the next action. The raw quote stays
 * as evidence, not the primary value.
 *
 * What counts as friction (precision-over-recall):
 *   - User negation directly after an assistant tool-use:
 *     "no", "así no", "espera", "stop", "cancel", "wait" → strong signal
 *   - User correction phrasing: "should be X", "rather than", "instead"
 *   - Repeated requests for the same surface ("dónde", "where", "how
 *     do I" appearing 3+ times in the session)
 *   - Explicit complaint markers: "doesn't work", "no funciona", "broken"
 *
 * Conservative cap: max 5 signals per session. Hashed dedup against
 * existing improvement-signal entries so re-running the hook never
 * doubles them.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { projectMemory } from '../memory/project-memory'
import { parseTranscriptJsonl, type TranscriptJsonlLine } from './transcript-jsonl'

const SOURCE_TAG = 'friction-detector'
const MAX_SIGNALS_PER_SESSION = 5
const MAX_EXCERPT_CHARS = 400

// Negation / correction markers — language-agnostic (es/en) since the
// user codebase mixes both. Matched against the START of a user turn
// (after the assistant just acted) to avoid false positives in
// ordinary discussion.
const NEGATION_MARKERS = [
  /^\s*no[,.!\s]/i,
  /^\s*nope\b/i,
  /^\s*así no\b/i,
  /^\s*espera\b/i,
  /^\s*stop\b/i,
  /^\s*wait\b/i,
  /^\s*cancel\b/i,
]

const CORRECTION_MARKERS = [
  /\bshould be\b/i,
  /\brather than\b/i,
  /\binstead\b/i,
  /\bmás bien\b/i,
  /\ben realidad\b/i,
]

const COMPLAINT_MARKERS = [
  /\bdoesn'?t work\b/i,
  /\bno funciona\b/i,
  /\bbroken\b/i,
  /\bestá roto\b/i,
  /\bagain\b.*\bsame\b/i,
]

interface TranscriptLine {
  type?: string
  message?: { role?: string; content?: unknown }
  role?: string
  content?: unknown
}

interface FrictionSignal {
  excerpt: string
  category: 'negation' | 'correction' | 'complaint'
  /** Assistant turn (truncated) that immediately preceded the signal. */
  precedingAssistantPreview: string
}

export interface FrictionResult {
  signalsRecorded: number
  signalsSkipped: number
}

/**
 * Public entry. Reads the transcript JSONL, extracts up to
 * MAX_SIGNALS_PER_SESSION friction signals, persists them via
 * projectMemory.remember with type `improvement-signal`. Idempotent
 * (hashed dedup against existing entries with the same source tag).
 */
export async function detectFriction(
  projectPath: string,
  transcriptPath: string,
  sessionId: string | null,
  opts: { preloadedLines?: TranscriptJsonlLine[] } = {}
): Promise<FrictionResult> {
  let lines: TranscriptLine[]
  if (opts.preloadedLines) {
    lines = opts.preloadedLines as TranscriptLine[]
  } else {
    let raw = ''
    try {
      raw = await fs.readFile(transcriptPath, 'utf-8')
    } catch {
      return { signalsRecorded: 0, signalsSkipped: 0 }
    }
    lines = parseJsonl(raw)
  }
  const signals = extractSignals(lines)
  if (signals.length === 0) {
    return { signalsRecorded: 0, signalsSkipped: 0 }
  }

  // Dedup against signals already in memory (hashing on excerpt).
  const existing = projectMemoryHashes(projectPath)
  const projectId = projectIdFromPath(projectPath) ?? undefined
  let recorded = 0
  let skipped = 0
  for (const signal of signals.slice(0, MAX_SIGNALS_PER_SESSION)) {
    // `existing` holds the 12-char keys stored on prior signals (see
    // projectMemoryHashes), so the comparison unit MUST be the same 12-char
    // slice — comparing the full 64-char hash here silently never matched,
    // re-recording the same pushback every session (the 5-9× dup bloat).
    const dedupKey = hashSignal(signal.excerpt).slice(0, 12)
    if (existing.has(dedupKey)) {
      skipped++
      continue
    }
    try {
      await projectMemory.remember(projectPath, {
        type: 'improvement-signal',
        content: formatSignal(signal),
        tags: {
          source: SOURCE_TAG,
          category: signal.category,
          ...(sessionId ? { session: sessionId } : {}),
          key: dedupKey, // dedup key for the (type, key) latest-winner rule
        },
        provenance: 'extracted',
        projectId,
      })
      recorded++
    } catch {
      skipped++
    }
  }
  return { signalsRecorded: recorded, signalsSkipped: skipped }
}

// Helpers — exported for tests via _internal.

function parseJsonl(raw: string): TranscriptLine[] {
  return parseTranscriptJsonl(raw) as TranscriptLine[]
}

/**
 * Walk the transcript turn-by-turn. A "friction signal" is a USER
 * turn whose first 200 chars match a marker, recorded with the
 * preceding ASSISTANT turn as context.
 */
function extractSignals(lines: TranscriptLine[]): FrictionSignal[] {
  const signals: FrictionSignal[] = []
  let lastAssistantText = ''

  for (const line of lines) {
    const role = line.role ?? line.message?.role
    const content = textOf(line.content ?? line.message?.content)
    if (!content) continue

    if (role === 'assistant') {
      lastAssistantText = content
      continue
    }
    if (role !== 'user') continue

    const head = content.slice(0, 300)
    const category = classify(head)
    if (!category) continue

    signals.push({
      excerpt: content.slice(0, MAX_EXCERPT_CHARS).trim(),
      category,
      precedingAssistantPreview: lastAssistantText.slice(0, MAX_EXCERPT_CHARS).trim(),
    })
  }

  return signals
}

function classify(text: string): FrictionSignal['category'] | null {
  // Complaints checked FIRST: phrases like "no funciona" share the
  // "no" prefix with negation markers, but the multi-word complaint
  // pattern is more specific and shouldn't be miscategorised as
  // pure rejection.
  if (COMPLAINT_MARKERS.some((re) => re.test(text))) return 'complaint'
  if (NEGATION_MARKERS.some((re) => re.test(text))) return 'negation'
  if (CORRECTION_MARKERS.some((re) => re.test(text))) return 'correction'
  return null
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    // Anthropic content blocks: [{ type: 'text', text: '...' }, ...]
    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block) {
          const t = (block as { text?: unknown }).text
          return typeof t === 'string' ? t : ''
        }
        return ''
      })
      .join('\n')
      .trim()
  }
  return ''
}

function formatSignal(signal: FrictionSignal): string {
  const template = lessonTemplate(signal.category)
  const evidence = inlineEvidence(signal.excerpt)
  const assistant = inlineEvidence(signal.precedingAssistantPreview.slice(0, 200))
  const lines = [
    `[${signal.category}] Lesson: ${template.lesson}`,
    'What happened: The user pushed back after the assistant response.',
    `Why it mattered: ${template.why}`,
    `Pattern: ${template.pattern}`,
    `Anti-pattern: ${template.antiPattern}`,
    `Next action: ${template.nextAction}`,
    `Evidence: user said "${evidence}"${assistant ? ` after assistant said "${assistant}"` : ''}.`,
  ]
  return lines.join('\n')
}

function lessonTemplate(category: FrictionSignal['category']): {
  lesson: string
  why: string
  pattern: string
  antiPattern: string
  nextAction: string
} {
  if (category === 'complaint') {
    return {
      lesson:
        'Treat explicit failure complaints as evidence that the last result needs diagnosis, not repetition.',
      why: 'The user reported that the delivered behavior or command did not work.',
      pattern: 'User names a broken or non-working result after an assistant action.',
      antiPattern: 'Retrying the same path or moving on without isolating the failure.',
      nextAction:
        'Stop, inspect the failing output or assumption, and propose the smallest verifiable fix.',
    }
  }
  if (category === 'correction') {
    return {
      lesson: 'Update the working assumption when the user corrects the intended direction.',
      why: 'The assistant was using an assumption that did not match what the user wanted.',
      pattern: 'User redirects the implementation or workflow with a correction.',
      antiPattern: 'Continuing with the original plan after the user clarified a different target.',
      nextAction: 'Restate the corrected target as an actionable rule before continuing.',
    }
  }
  return {
    lesson: 'Recalibrate before continuing when the user rejects the assistant’s last step.',
    why: 'The assistant likely violated sequencing, scope, or approval expectations.',
    pattern: 'User immediately rejects an assistant action or proposed next step.',
    antiPattern:
      'Treating the rejected action as acceptable and continuing without changing course.',
    nextAction:
      'Pause, convert the pushback into a workflow constraint, and adjust the next tool use.',
  }
}

function inlineEvidence(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/"/g, "'")
}

function hashSignal(excerpt: string): string {
  // Hash on the lowercased, whitespace-normalised excerpt so trivial
  // formatting differences don't double-count.
  const normalised = excerpt.toLowerCase().replace(/\s+/g, ' ').trim()
  return crypto.createHash('sha256').update(normalised).digest('hex')
}

function projectMemoryHashes(projectPath: string): Set<string> {
  // Read configManager-resolved projectId via the recall API. If we
  // can't get one, return an empty set (every signal is "new"); the
  // caller's MAX_SIGNALS_PER_SESSION cap prevents runaway noise.
  try {
    // We need projectId — recall accepts it directly. Caller should
    // have validated config exists before calling detectFriction; if
    // it didn't, recall throws and we fall through.
    const id = projectIdFromPath(projectPath)
    if (!id) return new Set()
    const entries = projectMemory.recall(id, {
      types: ['improvement-signal'],
      tags: { source: SOURCE_TAG },
      limit: 100,
      dedupeByKey: false,
    })
    const hashes = new Set<string>()
    for (const e of entries) {
      const key = e.tags.key
      if (key) hashes.add(key)
    }
    return hashes
  } catch {
    return new Set()
  }
}

function projectIdFromPath(projectPath: string): string | null {
  // Lightweight sync read avoiding the full config-manager round trip.
  try {
    const fs2 = require('node:fs') as typeof import('node:fs')
    const path2 = require('node:path') as typeof import('node:path')
    const file = path2.join(projectPath, '.prjct', 'prjct.config.json')
    const raw = fs2.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw) as { projectId?: string }
    return parsed.projectId ?? null
  } catch {
    return null
  }
}

export const _internal = {
  parseJsonl,
  extractSignals,
  classify,
  hashSignal,
  textOf,
  formatSignal,
  MAX_SIGNALS_PER_SESSION,
}
