import { describe, expect, test } from 'bun:test'
import {
  formatProjectStyleDiffMd,
  generateProjectStyleDiff,
} from '../../services/project-style-diff'
import { buildProjectStyleSnapshot } from '../../services/project-style-profile'

const stack = {
  hasFrontend: false,
  hasBackend: true,
  hasDatabase: true,
  hasDocker: false,
  hasTesting: true,
  frontendType: null as null,
  frameworks: [] as string[],
}

const stats = {
  fileCount: 50,
  version: '1.0.0',
  name: 'x',
  ecosystem: 'JavaScript',
  projectType: 'simple',
  languages: ['TypeScript'],
  frameworks: [] as string[],
}

describe('project-style-diff', () => {
  test('first snapshot is pure added', () => {
    const after = buildProjectStyleSnapshot({
      stats,
      stack,
      packageDeps: { zod: '1' },
      commitHash: 'aaa',
    })
    const diff = generateProjectStyleDiff(null, after)
    expect(diff.hasChanges).toBe(true)
    expect(diff.summary.added).toBeGreaterThan(0)
  })

  test('detects added framework / library', () => {
    const before = buildProjectStyleSnapshot({
      stats,
      stack: { ...stack, frameworks: [] },
      packageDeps: {},
      commitHash: 'aaa',
      capturedAt: '2026-07-01T00:00:00.000Z',
      id: 'style_before',
    })
    const after = buildProjectStyleSnapshot({
      stats,
      stack: { ...stack, frameworks: ['Hono'] },
      packageDeps: { hono: '4', zod: '3' },
      commitHash: 'bbb',
      capturedAt: '2026-07-02T00:00:00.000Z',
      id: 'style_after',
    })
    const diff = generateProjectStyleDiff(before, after)
    expect(diff.hasChanges).toBe(true)
    const fields = diff.items.map((i) => `${i.type}:${i.field}:${i.after ?? i.before}`)
    expect(fields.some((f) => f.includes('Frameworks') || f.includes('Key libraries'))).toBe(true)
    const md = formatProjectStyleDiffMd(diff)
    expect(md).toContain('Project evolution')
  })

  test('identical snapshots → no changes', () => {
    const a = buildProjectStyleSnapshot({
      stats,
      stack: { ...stack, frameworks: ['Hono'] },
      packageDeps: { hono: '4' },
      commitHash: 'aaa',
      capturedAt: '2026-07-01T00:00:00.000Z',
      id: 'style_a',
    })
    const b = buildProjectStyleSnapshot({
      stats,
      stack: { ...stack, frameworks: ['Hono'] },
      packageDeps: { hono: '4' },
      commitHash: 'aaa',
      capturedAt: '2026-07-02T00:00:00.000Z',
      id: 'style_b',
    })
    // force same payload content by copying
    b.payload = structuredClone(a.payload)
    b.patternCount = a.patternCount
    const diff = generateProjectStyleDiff(a, b)
    expect(diff.hasChanges).toBe(false)
  })
})
