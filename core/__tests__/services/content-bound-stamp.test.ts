/**
 * Content-bound stamp — pure hash + drift verdict (Dynasty D2).
 */

import { describe, expect, it } from 'bun:test'
import {
  BLOB_MISSING,
  buildTreeHash,
  contentBoundDriftVerdict,
  hashBlobContent,
  stampFromContents,
} from '../../services/content-bound-stamp'

describe('content-bound-stamp', () => {
  it('hashes blob content deterministically', () => {
    expect(hashBlobContent('hello')).toBe(hashBlobContent('hello'))
    expect(hashBlobContent('hello')).not.toBe(hashBlobContent('world'))
    expect(hashBlobContent(null)).toBe(BLOB_MISSING)
  })

  it('treeHash is order-independent and content-sensitive', () => {
    const a = buildTreeHash([
      { path: 'b.ts', blobHash: 'bbb' },
      { path: 'a.ts', blobHash: 'aaa' },
    ])
    const b = buildTreeHash([
      { path: 'a.ts', blobHash: 'aaa' },
      { path: 'b.ts', blobHash: 'bbb' },
    ])
    expect(a).toBe(b)
    const c = buildTreeHash([
      { path: 'a.ts', blobHash: 'aaa' },
      { path: 'b.ts', blobHash: 'CHANGED' },
    ])
    expect(c).not.toBe(a)
  })

  it('stampFromContents is stable for same inputs', () => {
    const s1 = stampFromContents(
      [
        { path: './src/x.ts', content: 'export const x = 1\n' },
        { path: 'src/y.ts', content: 'export const y = 2\n' },
      ],
      { stampedAt: 't0' }
    )
    const s2 = stampFromContents(
      [
        { path: 'src/y.ts', content: 'export const y = 2\n' },
        { path: 'src/x.ts', content: 'export const x = 1\n' },
      ],
      { stampedAt: 't1' }
    )
    expect(s1.treeHash).toBe(s2.treeHash)
    expect(s1.pathCount).toBe(2)
    expect(s1.version).toBe(1)
    expect(s1.paths.every((p) => p.blobHash !== BLOB_MISSING)).toBe(true)
  })

  it('stamp changes when file content changes', () => {
    const before = stampFromContents([{ path: 'a.ts', content: 'v1' }], { stampedAt: 't0' })
    const after = stampFromContents([{ path: 'a.ts', content: 'v2' }], { stampedAt: 't1' })
    expect(after.treeHash).not.toBe(before.treeHash)
  })

  it('drift verdict matches / hard-blocks on mismatch', () => {
    const stamp = stampFromContents([{ path: 'a.ts', content: 'ok' }], { stampedAt: 't0' })
    const match = contentBoundDriftVerdict({
      stamp,
      currentTreeHash: stamp.treeHash,
      hard: true,
    })
    expect(match.blocked).toBe(false)
    expect(match.reason).toBe('match')

    const drift = contentBoundDriftVerdict({
      stamp,
      currentTreeHash: 'deadbeef'.repeat(8),
      hard: true,
    })
    expect(drift.blocked).toBe(true)
    expect(drift.reason).toBe('drift')
    expect(drift.message).toMatch(/Content-bound drift|re-approve|judgment approve/i)

    const soft = contentBoundDriftVerdict({
      stamp,
      currentTreeHash: 'deadbeef'.repeat(8),
      hard: false,
    })
    expect(soft.blocked).toBe(false)
    expect(soft.reason).toBe('drift')

    const override = contentBoundDriftVerdict({
      stamp,
      currentTreeHash: 'deadbeef'.repeat(8),
      hard: true,
      override: true,
    })
    expect(override.blocked).toBe(false)
    expect(override.reason).toBe('override')
  })

  it('no-stamp and unverified never hard-block', () => {
    expect(
      contentBoundDriftVerdict({ stamp: null, currentTreeHash: 'x', hard: true }).blocked
    ).toBe(false)
    const stamp = stampFromContents([{ path: 'a.ts', content: 'ok' }], { stampedAt: 't0' })
    const u = contentBoundDriftVerdict({
      stamp,
      currentTreeHash: null,
      hard: true,
    })
    expect(u.blocked).toBe(false)
    expect(u.reason).toBe('unverified')
  })
})
