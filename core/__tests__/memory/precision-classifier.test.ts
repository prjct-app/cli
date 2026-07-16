/**
 * Precision classifier — client signal-quality corpus + shape rules.
 */

import { describe, expect, it } from 'bun:test'
import {
  classifyCapturePrecision,
  classifySpecCreate,
  isBareIdBody,
  isEmptySpecMirror,
  isOpenGotchaNarration,
  lacksInboxSubstance,
  parseSpecMirrorContent,
  stripPipelineLabelsForHuman,
} from '../../memory/precision-classifier'

describe('empty spec mirror', () => {
  it('flags goal identical to title (client UUID lookup pattern)', () => {
    const title = 'get 3a9aa714-ffda-42cc-adea-afe158155a90'
    const goal = 'get 3a9aa714-ffda-42cc-adea-afe158155a90'
    expect(isEmptySpecMirror(title, goal)).toBe(true)
    const v = classifySpecCreate(title, goal)
    expect(v.action).toBe('refuse')
    expect(['empty_spec_mirror', 'bare_id_body']).toContain(v.reasonCode)
  })

  it('flags memory mirror body title===goal (no living graduation)', () => {
    const body = 'Crew mode migration\n\nGoal: Crew mode migration'
    const v = classifyCapturePrecision(body, 'spec')
    expect(v.action).toBe('refuse')
    expect(v.reasonCode).toBe('empty_spec_mirror')
  })

  it('allows draft create when goal seeds as title (CLI ergonomics)', () => {
    const v = classifySpecCreate('rate limiting', 'rate limiting')
    expect(v.action).toBe('accept')
  })

  it('allows real specs with distinct goals', () => {
    const v = classifySpecCreate(
      'Signal-quality substrate',
      'Raise living-memory signal with a precision classifier before graduation'
    )
    expect(v.action).toBe('accept')
    expect(v.reasonCode).toBe('ok')
  })

  it('flags bare id / UUID goals without action verbs', () => {
    expect(isBareIdBody('3a9aa714-ffda-42cc-adea-afe158155a90')).toBe(true)
    expect(isBareIdBody('get 3a9aa714-ffda-42cc-adea-afe158155a90')).toBe(true)
    const v = classifySpecCreate('Lookup', 'get 3a9aa714-ffda-42cc-adea-afe158155a90')
    expect(v.action).toBe('refuse')
    expect(['empty_spec_mirror', 'bare_id_body']).toContain(v.reasonCode)
  })
})

describe('gotcha vs open narration', () => {
  it('demotes in-progress narration with open colon (client example)', () => {
    const body = 'Reviso cómo refrescan hoy para no meter un bug:'
    expect(isOpenGotchaNarration(body)).toBe(true)
    const v = classifyCapturePrecision(body, 'gotcha')
    expect(v.action).toBe('demote')
    expect(v.demoteTo).toBe('context')
    expect(v.reasonCode).toBe('gotcha_open_narration')
  })

  it('retypes closed not-the-cause gotchas to red-herring', () => {
    const body =
      'It was not RLS — the RPC is SECURITY DEFINER and bypasses policies; fix: gate with can_access_company'
    expect(isOpenGotchaNarration(body)).toBe(false)
    const v = classifyCapturePrecision(body, 'gotcha')
    expect(v.action).toBe('demote')
    expect(v.demoteTo).toBe('red-herring')
  })

  it('accepts short imperative traps', () => {
    const v = classifyCapturePrecision(
      'Never call router.refresh() after inventory save — it resets scroll',
      'gotcha'
    )
    expect(v.action).toBe('accept')
  })

  it('retypes Spanish closed negative knowledge to red-herring', () => {
    const v = classifyCapturePrecision(
      'No era RLS: el bug era cache stale en search_inventory; fix: invalidar tag de compañía',
      'gotcha'
    )
    expect(v.action).toBe('demote')
    expect(v.demoteTo).toBe('red-herring')
    expect(v.reasonCode).toBe('gotcha_is_red_herring')
  })

  it('accepts closed gotcha that is not negative knowledge', () => {
    const v = classifyCapturePrecision(
      'Never call router.refresh() after inventory save — it resets scroll',
      'gotcha'
    )
    expect(v.action).toBe('accept')
  })
})

describe('inbox substance', () => {
  it('refuses sub-substance inbox', () => {
    expect(lacksInboxSubstance('upgrade')).toBe(true)
    expect(lacksInboxSubstance('fix later')).toBe(true)
    const v = classifyCapturePrecision('upgrade', 'inbox')
    expect(v.action).toBe('refuse')
    // junk single-token may fire first, or substance — either is refuse
    expect(['junk', 'inbox_no_substance']).toContain(v.reasonCode)
  })

  it('allows short two-token inbox notes', () => {
    expect(lacksInboxSubstance('random thought')).toBe(false)
    const v = classifyCapturePrecision('random thought', 'inbox')
    expect(v.action).toBe('accept')
  })

  it('allows real inbox capture', () => {
    const v = classifyCapturePrecision(
      'Investigate why stock audits cannot reopen after complete in mobile',
      'inbox'
    )
    expect(v.action).toBe('accept')
  })
})

describe('stripPipelineLabelsForHuman', () => {
  it('removes Context synthesis prefix from user-facing text', () => {
    const raw =
      'Context synthesis: Passive land hand-off from durable signals. · Key data: source=land-auto'
    const out = stripPipelineLabelsForHuman(raw)
    expect(out).not.toMatch(/Context synthesis:/i)
    expect(out).toContain('Passive land hand-off')
    expect(out).toContain('Key data:')
  })

  it('strips mid-string Context synthesis labels', () => {
    const raw = 'Session close done · Context synthesis: Shipped P0 · Key data: pr=537'
    const out = stripPipelineLabelsForHuman(raw)
    expect(out).not.toMatch(/Context synthesis:/i)
    expect(out).toContain('Shipped P0')
  })
})

describe('parseSpecMirrorContent', () => {
  it('splits title and goal', () => {
    const p = parseSpecMirrorContent('My feature\n\nGoal: Implement X safely')
    expect(p).toEqual({ title: 'My feature', goal: 'Implement X safely' })
  })
})

describe('force override', () => {
  it('accepts when force is set', () => {
    const v = classifyCapturePrecision('upgrade', 'inbox', { force: true })
    expect(v.action).toBe('accept')
    expect(v.reasonCode).toBe('forced')
  })
})
