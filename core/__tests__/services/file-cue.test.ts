import { describe, expect, it } from 'bun:test'
import { formatLikelyFileForAgent, type LikelyFileHit } from '../../services/file-cue'

describe('file-cue agent surface', () => {
  it('renders a path with a one-line reason and signals so the agent reads it instead of grep-walking', () => {
    const hit: LikelyFileHit = {
      path: 'core/commands/workflow.ts',
      signals: ['bm25', 'imports'],
      reason: 'matches your task terms',
    }
    const line = formatLikelyFileForAgent(hit)
    expect(line).toBe('`core/commands/workflow.ts` — matches your task terms (bm25+imports)')
  })

  it('still renders the reason when no signals are present', () => {
    const hit: LikelyFileHit = {
      path: 'core/x.ts',
      signals: [],
      reason: 'related by prjct index',
    }
    expect(formatLikelyFileForAgent(hit)).toBe('`core/x.ts` — related by prjct index')
  })
})
