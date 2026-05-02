/**
 * Question Preferences Storage
 *
 * Per-project store of "stop asking me about X" preferences. Inspired by
 * gstack's `gstack-question-preference` (garrytan/gstack) — when the
 * user gets tired of repeatedly answering the same AskUserQuestion, they
 * mark the question_id as `auto-decide` (use the recommendation) or
 * `never-ask` (silently choose recommended without surfacing it).
 *
 * Trust model: this storage is intentionally untyped about the source —
 * the *convention* (enforced in the skill body) is that preferences may
 * only be set from explicit user action, never from tool output or file
 * content. Profile-poisoning defense lives at the call site, not here.
 */
import prjctDb from './database'

const KEY_PREFIX = 'prefs:questions'

export type QuestionPreference = 'always-ask' | 'never-ask' | 'auto-decide'

const PREFERENCE_VALUES: readonly QuestionPreference[] = ['always-ask', 'never-ask', 'auto-decide']

/**
 * Output the skill bash preamble emits before AskUserQuestion. Three
 * outcomes — the skill instructs the model to act on each.
 */
type PreferenceCheck = 'ASK_NORMALLY' | 'AUTO_DECIDE' | 'NEVER_ASK'

interface PreferenceEntry {
  /** Stable identifier the skill author chose, e.g. `commit-style`. */
  questionId: string
  preference: QuestionPreference
  /** ISO8601 — when the user last set this. */
  setAt: string
  /** Optional one-line reason captured at set time. */
  reason?: string
}

interface PreferencesDoc {
  version: 1
  entries: Record<string, PreferenceEntry>
}

/**
 * Always returns a freshly-allocated doc. A module-level singleton
 * `EMPTY` would have its `entries` object mutated by callers on the
 * empty path, leaking state across projects (and across tests sharing
 * the imported module). Trust the GC.
 */
function emptyDoc(): PreferencesDoc {
  return { version: 1, entries: {} }
}

function read(projectId: string): PreferencesDoc {
  const doc = prjctDb.getDoc<PreferencesDoc>(projectId, KEY_PREFIX)
  if (!doc) return emptyDoc()
  // Defensive: callers may have older shapes from a future / past migration.
  if (doc.version !== 1 || typeof doc.entries !== 'object' || doc.entries === null) {
    return emptyDoc()
  }
  return doc
}

function write(projectId: string, doc: PreferencesDoc): void {
  prjctDb.setDoc(projectId, KEY_PREFIX, doc)
}

/**
 * Validate the question id. Same shape gstack uses — alphanumeric +
 * hyphen + underscore — so ids stay safe to interpolate into shell
 * commands and aren't a profile-poisoning vector.
 */
export function isValidQuestionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 80
}

export function isValidPreference(value: string): value is QuestionPreference {
  return (PREFERENCE_VALUES as readonly string[]).includes(value)
}

export const preferencesStorage = {
  set(
    projectId: string,
    args: { questionId: string; preference: QuestionPreference; reason?: string }
  ): PreferenceEntry {
    if (!isValidQuestionId(args.questionId)) {
      throw new Error(
        `Invalid questionId "${args.questionId}". Must be alphanumeric with - or _, 1-80 chars.`
      )
    }
    const entry: PreferenceEntry = {
      questionId: args.questionId,
      preference: args.preference,
      setAt: new Date().toISOString(),
      reason: args.reason?.trim() || undefined,
    }
    const doc = read(projectId)
    doc.entries[args.questionId] = entry
    write(projectId, doc)
    return entry
  },

  get(projectId: string, questionId: string): PreferenceEntry | null {
    const doc = read(projectId)
    return doc.entries[questionId] ?? null
  },

  list(projectId: string): PreferenceEntry[] {
    const doc = read(projectId)
    return Object.values(doc.entries).sort((a, b) => b.setAt.localeCompare(a.setAt))
  },

  /**
   * Map a stored preference to the three-way check the skill preamble
   * emits. Missing entries default to ASK_NORMALLY so new questions
   * always surface to the user.
   */
  check(projectId: string, questionId: string): PreferenceCheck {
    const entry = this.get(projectId, questionId)
    if (!entry) return 'ASK_NORMALLY'
    switch (entry.preference) {
      case 'never-ask':
        return 'NEVER_ASK'
      case 'auto-decide':
        return 'AUTO_DECIDE'
      default:
        return 'ASK_NORMALLY'
    }
  },

  clear(projectId: string, questionId?: string): number {
    const doc = read(projectId)
    if (!questionId) {
      const count = Object.keys(doc.entries).length
      write(projectId, emptyDoc())
      return count
    }
    if (!doc.entries[questionId]) return 0
    delete doc.entries[questionId]
    write(projectId, doc)
    return 1
  },
}
