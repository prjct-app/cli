import { describe, expect, it } from 'bun:test'
import { DEFAULT_MCP_TOOL_TIER } from '../../mcp/server'
import { PROVIDER_CAPABILITY_MODELS } from '../../schemas/model'
import {
  computeHarnessScore,
  renderHarnessScoreMd,
  WORLD_CLASS,
} from '../../services/harness-score'
import { MINIMAL_ROUTING_BODY } from '../../services/routing-block'
import { buildPrjctSkill, emptySkillContext } from '../../services/skill-generator/prjct-skill-body'
import { countTokens } from '../../tools/context/token-counter'

describe('harness score', () => {
  it('defaults MCP tier to core', () => {
    expect(DEFAULT_MCP_TOOL_TIER).toBe('core')
  })

  it('keeps always-on skill under the token SLO', () => {
    expect(countTokens(buildPrjctSkill(emptySkillContext()))).toBeLessThanOrEqual(
      WORLD_CLASS.skillTokensMax
    )
  })

  it('keeps routing body under the byte SLO', () => {
    expect(Buffer.byteLength(MINIMAL_ROUTING_BODY, 'utf-8')).toBeLessThanOrEqual(
      WORLD_CLASS.routingBodyBytesMax
    )
  })

  it('exposes at least 6 provider capability maps', () => {
    expect(Object.keys(PROVIDER_CAPABILITY_MODELS).length).toBeGreaterThanOrEqual(
      WORLD_CLASS.providerMapsMin
    )
  })

  it('scores green on structural criteria', () => {
    const report = computeHarnessScore()
    expect(report.grade).toBeGreaterThanOrEqual(4)
    expect(report.criteria.every((c) => c.score >= 3)).toBe(true)
    expect(report.criteria.find((c) => c.id === 'skill-tokens')?.status).toBe('green')
    expect(report.criteria.find((c) => c.id === 'mcp-default')?.status).toBe('green')
    expect(report.programDone).toBe(true)
  })

  it('renders markdown scorecard', () => {
    const md = renderHarnessScoreMd(computeHarnessScore())
    expect(md).toContain('# Harness score')
    expect(md).toContain('Always-on skill tokens')
    expect(md).toMatch(/done|in progress/)
  })
})
