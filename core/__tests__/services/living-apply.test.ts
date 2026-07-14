import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import {
  buildLiveModSuggestion,
  buildLivingApplyBlock,
  classifyLivingRole,
  extractCitedFiles,
  formatLivingApplyLine,
} from '../../services/retention/living-apply'

const entry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  id: 'mem_1',
  type: 'decision',
  content: 'we use soft-delete only after archive for judgment types',
  tags: {},
  rememberedAt: new Date().toISOString(),
  provenance: 'declared',
  ...over,
})

describe('living-apply SoT vs suggest', () => {
  it('classifies decisions/gotchas as sot', () => {
    expect(classifyLivingRole(entry({ type: 'decision' }))).toBe('sot')
    expect(classifyLivingRole(entry({ type: 'gotcha' }))).toBe('sot')
  })

  it('classifies anti-pattern and distill as suggest', () => {
    expect(classifyLivingRole(entry({ type: 'anti-pattern' }))).toBe('suggest')
    expect(
      classifyLivingRole(entry({ type: 'learning', tags: { source: 'retention-distill' } }))
    ).toBe('suggest')
  })

  it('extracts cited files and builds live mod', () => {
    const e = entry({
      type: 'anti-pattern',
      content:
        'Anti-pattern: never bare-push from worktree. Always fix in core/services/task-service.ts. Next action: gate ship on worktree detect.',
    })
    expect(extractCitedFiles(e.content)).toContain('core/services/task-service.ts')
    expect(buildLiveModSuggestion(e)).toMatch(/task-service|Apply in/)
  })

  it('formatLivingApplyLine marks SoT as binding', () => {
    const line = formatLivingApplyLine(entry({ type: 'decision' }))
    expect(line.role).toBe('sot')
    expect(line.line).toMatch(/SoT|BINDING/i)
  })

  it('buildLivingApplyBlock orders SoT then suggest', () => {
    const block = buildLivingApplyBlock([
      entry({
        id: 'mem_2',
        type: 'anti-pattern',
        content: 'Anti-pattern: avoid mock SQLite in tests — use real tmpdb',
      }),
      entry({
        id: 'mem_1',
        type: 'decision',
        content: 'Decision: always use real SQLite in unit tests via tmpdir',
      }),
    ])
    expect(block).toBeTruthy()
    expect(block!.indexOf('Source of truth')).toBeLessThan(block!.indexOf('Live modification'))
  })
})
