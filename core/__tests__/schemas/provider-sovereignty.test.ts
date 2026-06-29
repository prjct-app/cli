/**
 * Cross-provider rig sovereignty (harness pillar 5).
 *
 * Roles map to provider-agnostic capability classes; each provider maps those
 * classes to its own models. The same per-role policy therefore runs on Claude,
 * Gemini, or any future rig — the brain is intercambiable, the harness is not.
 */

import { describe, expect, it } from 'bun:test'
import {
  AGENT_MODEL_POLICY,
  type AgentRole,
  renderModelDirectiveForProvider,
  resolveProviderModel,
} from '../../schemas/model'

describe('resolveProviderModel — model is intercambiable', () => {
  it('maps roles to each provider concrete model', () => {
    expect(resolveProviderModel('implementer', 'claude').model).toBe('opus')
    expect(resolveProviderModel('orchestrator', 'claude').model).toBe('haiku')
    expect(resolveProviderModel('review', 'claude').model).toBe('sonnet')

    expect(resolveProviderModel('implementer', 'gemini').model).toBe('2.5-pro')
    expect(resolveProviderModel('orchestrator', 'gemini').model).toBe('2.0-flash')
    expect(resolveProviderModel('review', 'gemini').model).toBe('2.5-flash')
  })

  it('degrades within a provider when the preferred model is unavailable', () => {
    const r = resolveProviderModel('implementer', 'claude', new Set(['sonnet', 'haiku']))
    expect(r.model).toBe('sonnet')
    expect(r.degraded).toBe(true)

    const g = resolveProviderModel('implementer', 'gemini', new Set(['2.5-flash', '2.0-flash']))
    expect(g.model).toBe('2.5-flash')
    expect(g.degraded).toBe(true)
  })

  it('returns model=null for multi-model rigs and unknown providers (rig selects)', () => {
    expect(resolveProviderModel('implementer', 'cursor').model).toBeNull()
    expect(resolveProviderModel('implementer', 'something-new').model).toBeNull()
  })

  // The new provider-agnostic layer must stay in lockstep with the existing
  // Claude-tier policy so the two can never diverge.
  it('keeps the claude provider map consistent with AGENT_MODEL_POLICY', () => {
    for (const role of Object.keys(AGENT_MODEL_POLICY) as AgentRole[]) {
      expect(resolveProviderModel(role, 'claude').model).toBe(AGENT_MODEL_POLICY[role].model)
    }
  })
})

describe('renderModelDirectiveForProvider — provider-aware dispatch prose', () => {
  it('emits the concrete model id for a fixed-model provider', () => {
    expect(renderModelDirectiveForProvider('implementer', 'gemini')).toContain('model "2.5-pro"')
    expect(renderModelDirectiveForProvider('implementer', 'gemini')).toContain('frontier')
  })

  it('names the capability and defers to the rig for multi-model providers', () => {
    const d = renderModelDirectiveForProvider('implementer', 'cursor')
    expect(d).toContain('select your strongest model')
    expect(d).toContain('cursor')
  })

  it('surfaces degradation in the prose', () => {
    const d = renderModelDirectiveForProvider('implementer', 'claude', new Set(['sonnet', 'haiku']))
    expect(d).toContain('model "sonnet"')
    expect(d).toContain('degraded')
  })
})
