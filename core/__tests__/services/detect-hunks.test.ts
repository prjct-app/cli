import { describe, expect, it } from 'bun:test'
import { parseChangedLinesFromUnifiedDiff } from '../../services/detect-changes'

describe('parseChangedLinesFromUnifiedDiff', () => {
  it('maps addition lines to new-file line numbers', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -10,0 +11,2 @@',
      '+export function foo() {}',
      '+export function bar() {}',
    ].join('\n')
    const map = parseChangedLinesFromUnifiedDiff(diff)
    expect(map.has('a.ts')).toBe(true)
    const lines = map.get('a.ts')!
    expect(lines.has(11)).toBe(true)
    expect(lines.has(12)).toBe(true)
  })
})
