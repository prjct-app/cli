/**
 * State Machine Tests
 *
 * Tests for workflow state machine transitions:
 * - All valid transitions work
 * - Invalid transitions are rejected
 * - New transitions: completed→paused, paused→shipped, completed→reopen
 * - getCurrentState detects paused tasks from pausedTasks array
 */

import { describe, expect, it } from 'bun:test'
import type { WorkflowCommand, WorkflowState } from '../../types/workflow'
import { WorkflowStateMachine } from '../../workflow/state-machine'

const sm = new WorkflowStateMachine()

// =============================================================================
// getCurrentState
// =============================================================================

describe('getCurrentState', () => {
  it('returns idle when no task and no paused tasks', () => {
    expect(sm.getCurrentState({ currentTask: null })).toBe('idle')
    expect(sm.getCurrentState({})).toBe('idle')
  })

  it('returns working for in_progress status', () => {
    expect(sm.getCurrentState({ currentTask: { status: 'in_progress' } })).toBe('working')
    expect(sm.getCurrentState({ currentTask: { status: 'working' } })).toBe('working')
  })

  it('returns completed for completed/done status', () => {
    expect(sm.getCurrentState({ currentTask: { status: 'completed' } })).toBe('completed')
    expect(sm.getCurrentState({ currentTask: { status: 'done' } })).toBe('completed')
  })

  it('returns shipped for shipped status', () => {
    expect(sm.getCurrentState({ currentTask: { status: 'shipped' } })).toBe('shipped')
  })

  it('returns paused when currentTask has paused status', () => {
    expect(sm.getCurrentState({ currentTask: { status: 'paused' } })).toBe('paused')
  })

  it('returns paused when no currentTask but pausedTasks array has entries', () => {
    expect(sm.getCurrentState({ currentTask: null, pausedTasks: [{ id: '1' }] })).toBe('paused')
  })

  it('returns paused when no currentTask but legacy previousTask is paused', () => {
    expect(sm.getCurrentState({ currentTask: null, previousTask: { status: 'paused' } })).toBe(
      'paused'
    )
  })

  it('returns idle when no currentTask and empty pausedTasks', () => {
    expect(sm.getCurrentState({ currentTask: null, pausedTasks: [] })).toBe('idle')
  })

  it('returns working for unknown status when task exists', () => {
    expect(sm.getCurrentState({ currentTask: { status: 'active' } })).toBe('working')
    expect(sm.getCurrentState({ currentTask: {} })).toBe('working')
  })
})

// =============================================================================
// canTransition - valid transitions
// =============================================================================

describe('canTransition - valid', () => {
  const validTransitions: [WorkflowState, WorkflowCommand][] = [
    // idle
    ['idle', 'task'],
    // working
    ['working', 'done'],
    ['working', 'pause'],
    // paused
    ['paused', 'resume'],
    ['paused', 'task'],
    ['paused', 'ship'], // fast-track ship
    // completed
    ['completed', 'ship'],
    ['completed', 'task'],
    ['completed', 'pause'], // reopen for review
    ['completed', 'reopen'], // reopen for rework
    // shipped
    ['shipped', 'task'],
  ]

  for (const [state, command] of validTransitions) {
    it(`${state} → ${command} is valid`, () => {
      const result = sm.canTransition(state, command)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  }
})

// =============================================================================
// canTransition - invalid transitions
// =============================================================================

describe('canTransition - invalid', () => {
  const invalidTransitions: [WorkflowState, WorkflowCommand][] = [
    ['idle', 'done'],
    ['idle', 'pause'],
    ['idle', 'resume'],
    ['idle', 'ship'],
    ['idle', 'reopen'],
    ['working', 'task'],
    ['working', 'ship'],
    ['working', 'resume'],
    ['working', 'reopen'],
    ['paused', 'done'],
    ['paused', 'pause'],
    ['paused', 'reopen'],
    ['shipped', 'done'],
    ['shipped', 'pause'],
    ['shipped', 'resume'],
    ['shipped', 'ship'],
    ['shipped', 'reopen'],
  ]

  for (const [state, command] of invalidTransitions) {
    it(`${state} → ${command} is invalid`, () => {
      const result = sm.canTransition(state, command)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.suggestion).toBeDefined()
    })
  }
})

// =============================================================================
// getNextState
// =============================================================================

describe('getNextState', () => {
  it('task → working', () => {
    expect(sm.getNextState('idle', 'task')).toBe('working')
    expect(sm.getNextState('paused', 'task')).toBe('working')
    expect(sm.getNextState('completed', 'task')).toBe('working')
  })

  it('done → completed', () => {
    expect(sm.getNextState('working', 'done')).toBe('completed')
  })

  it('pause → paused', () => {
    expect(sm.getNextState('working', 'pause')).toBe('paused')
    expect(sm.getNextState('completed', 'pause')).toBe('paused')
  })

  it('resume → working', () => {
    expect(sm.getNextState('paused', 'resume')).toBe('working')
  })

  it('ship → shipped', () => {
    expect(sm.getNextState('completed', 'ship')).toBe('shipped')
    expect(sm.getNextState('paused', 'ship')).toBe('shipped')
  })

  it('reopen → working', () => {
    expect(sm.getNextState('completed', 'reopen')).toBe('working')
  })
})

// =============================================================================
// getValidCommands
// =============================================================================

describe('getValidCommands', () => {
  it('idle allows task', () => {
    expect(sm.getValidCommands('idle')).toEqual(['task'])
  })

  it('working allows done, pause', () => {
    expect(sm.getValidCommands('working')).toEqual(['done', 'pause'])
  })

  it('paused allows resume, task, ship', () => {
    expect(sm.getValidCommands('paused')).toEqual(['resume', 'task', 'ship'])
  })

  it('completed allows ship, task, pause, reopen', () => {
    expect(sm.getValidCommands('completed')).toEqual(['ship', 'task', 'pause', 'reopen'])
  })

  it('shipped allows task', () => {
    expect(sm.getValidCommands('shipped')).toEqual(['task'])
  })
})

// =============================================================================
// formatNextSteps
// =============================================================================

describe('formatNextSteps', () => {
  it('includes reopen (as prjct status active) in completed state steps', () => {
    const steps = sm.formatNextSteps('completed')
    expect(steps.some((s) => s.toLowerCase().includes('reopen'))).toBe(true)
  })

  it('includes ship in paused state steps', () => {
    const steps = sm.formatNextSteps('paused')
    expect(steps.some((s) => s.includes('ship'))).toBe(true)
  })

  it('emits executable prjct invocations (no p. skill notation)', () => {
    for (const state of ['idle', 'working', 'paused', 'completed', 'shipped'] as const) {
      const steps = sm.formatNextSteps(state)
      for (const step of steps) {
        expect(step.startsWith('prjct ')).toBe(true)
        expect(step).not.toContain('p. ')
      }
    }
  })

  it('maps done/pause/resume/reopen to status primitive', () => {
    expect(sm.formatNextSteps('working').join(' ')).toContain('prjct status done')
    expect(sm.formatNextSteps('working').join(' ')).toContain('prjct status paused')
    expect(sm.formatNextSteps('paused').join(' ')).toContain('prjct status active')
    expect(sm.formatNextSteps('completed').join(' ')).toContain('prjct status active')
  })
})
