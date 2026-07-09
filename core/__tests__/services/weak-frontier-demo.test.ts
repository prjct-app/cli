/**
 * Demo A/B weak vs frontier — pure scoring + markdown shape.
 */

import { describe, expect, test } from 'bun:test'
import {
  buildDemoRows,
  formatDemoMarkdown,
  routeIntent,
  routeIntentBare,
} from '../../services/weak-frontier-demo'

describe('weak-frontier-demo', () => {
  test('harness intent router beats bare wrap-as-work on bin verbs', () => {
    expect(routeIntent('sync the project')).toBe('sync')
    expect(routeIntentBare('sync the project')).toBe('work')
    expect(routeIntent('search for auth')).toBe('search')
    expect(routeIntentBare('search for auth')).toBe('work')
  })

  test('buildDemoRows marks every weak+prjct SLO', () => {
    const rows = buildDemoRows()
    expect(rows.length).toBeGreaterThanOrEqual(6)
    const failed = rows.filter((r) => !r.weakOk)
    expect(failed).toEqual([])
  })

  test('markdown table is public-demo shaped', () => {
    const md = formatDemoMarkdown(buildDemoRows())
    expect(md).toContain('Weak model + prjct')
    expect(md).toContain('Frontier (no harness)')
    expect(md).toContain('Passive capture')
    expect(md).toContain('Land hand-off')
    expect(md).toContain('demo:weak-vs-frontier')
  })
})
