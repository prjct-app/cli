import { describe, expect, it } from 'bun:test'
import { isRemovedVerb, migrationMessage, REMOVED_VERBS } from '../../commands/removed-verbs'
import { REGISTERED_VERBS_SET } from '../../commands/verb-names'

describe('REMOVED_VERBS', () => {
  it('does not overlap with registered verbs', () => {
    for (const verb of Object.keys(REMOVED_VERBS)) {
      expect(REGISTERED_VERBS_SET.has(verb)).toBe(false)
    }
  })

  it('covers every verb removed during the v2 cleanup', () => {
    const required = [
      'done',
      'pause',
      'resume',
      'reopen',
      'dash',
      'bug',
      'idea',
      'linear',
      'jira',
      'tokens',
      'velocity',
      'plan',
      // 'next' left this list in v3.26: it returned as the work-graph
      // frontier selector (prjct next) — a live verb again.
      // Removed later, with the vault/wiki feature deletion — must get the
      // same clean-error treatment, not silently auto-route to `capture`.
      'vault',
      'regen',
    ]
    for (const verb of required) {
      expect(isRemovedVerb(verb)).toBe(true)
    }
  })

  it('every entry has a non-empty replacement and note', () => {
    for (const [verb, entry] of Object.entries(REMOVED_VERBS)) {
      expect(entry.replacement.length).toBeGreaterThan(0)
      expect(entry.note.length).toBeGreaterThan(0)
      // replacement should start with `prjct ` or name an MCP/alternative
      expect(
        entry.replacement.startsWith('prjct ') || entry.replacement.toLowerCase().includes('mcp')
      ).toBe(true)
      // sanity: note is a full sentence, not just a word
      expect(entry.note.length).toBeGreaterThanOrEqual(20)
      // use verb to silence unused in case a future refactor drops the key
      expect(typeof verb).toBe('string')
    }
  })
})

describe('isRemovedVerb', () => {
  it('returns true for removed workflow verbs', () => {
    expect(isRemovedVerb('done')).toBe(true)
    expect(isRemovedVerb('pause')).toBe(true)
    expect(isRemovedVerb('bug')).toBe(true)
  })

  it('returns false for registered verbs', () => {
    expect(isRemovedVerb('task')).toBe(false)
    expect(isRemovedVerb('status')).toBe(false)
    expect(isRemovedVerb('capture')).toBe(false)
  })

  it('returns false for unknown verbs', () => {
    expect(isRemovedVerb('xyzzy')).toBe(false)
    expect(isRemovedVerb('')).toBe(false)
  })
})

describe('migrationMessage', () => {
  it('returns a message with the v2 replacement for removed verbs', () => {
    const msg = migrationMessage('done')
    expect(msg).not.toBeNull()
    expect(msg).toContain("'prjct done' was removed in v2")
    expect(msg).toContain('prjct status done')
  })

  it('returns null for non-removed verbs', () => {
    expect(migrationMessage('task')).toBeNull()
    expect(migrationMessage('unknown')).toBeNull()
  })
})
