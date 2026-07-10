import { describe, expect, test } from 'bun:test'
import {
  conflictModeWithWeakModel,
  effectiveWeakModelMode,
  qualityFloorWithWeakModel,
  weakModelBanner,
} from '../../services/weak-model-mode'
import type { LocalConfig } from '../../types/config'

describe('weak-model product mode', () => {
  test('off by default', () => {
    expect(effectiveWeakModelMode({ projectId: 'p', dataPath: 'x' })).toBe('off')
  })

  test('on intensifies conflict to strict unless conflictMode off', () => {
    const on: LocalConfig = {
      projectId: 'p',
      dataPath: 'x',
      judgment: { weakModelMode: 'on' },
    }
    expect(conflictModeWithWeakModel(on)).toBe('strict')
    expect(
      conflictModeWithWeakModel({
        projectId: 'p',
        dataPath: 'x',
        judgment: { weakModelMode: 'on', conflictMode: 'off' },
      })
    ).toBe('off')
  })

  test('quality floor elevates under weak mode', () => {
    expect(qualityFloorWithWeakModel('none', 'on')).toBe('standard')
    expect(qualityFloorWithWeakModel('standard', 'on')).toBe('full')
    expect(qualityFloorWithWeakModel('full', 'on')).toBe('full')
    expect(qualityFloorWithWeakModel('none', 'off')).toBe('none')
  })

  test('banner names product mode', () => {
    expect(weakModelBanner()).toContain('WEAK-MODEL')
  })
})
