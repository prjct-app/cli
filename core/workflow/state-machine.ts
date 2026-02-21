/**
 * Workflow State Machine
 * Explicit states with valid transitions for prjct workflow.
 *
 * States: idle → working → completed → shipped
 *                ↓↑          ↓↑
 *              paused ──────→ shipped (fast-track)
 *         completed ──reopen──→ working
 */

import type { WorkflowCommand, WorkflowState } from '../types/workflow.js'

interface StateDefinition {
  transitions: WorkflowCommand[]
  prompt: string
  description: string
}

interface TransitionResult {
  valid: boolean
  error?: string
  suggestion?: string
}

// =============================================================================
// State Definitions
// =============================================================================

const WORKFLOW_STATES: Record<WorkflowState, StateDefinition> = {
  idle: {
    transitions: ['task', 'next'],
    prompt: 'p. task <description>  Start working',
    description: 'No active task',
  },
  working: {
    transitions: ['done', 'pause'],
    prompt: 'p. done  Complete task  |  p. pause  Switch context',
    description: 'Task in progress',
  },
  paused: {
    transitions: ['resume', 'task', 'ship'],
    prompt: 'p. resume  Continue  |  p. task <new>  Start different  |  p. ship  Ship directly',
    description: 'Task paused',
  },
  completed: {
    transitions: ['ship', 'task', 'next', 'pause', 'reopen'],
    prompt: 'p. ship  Ship it  |  p. task <next>  Start next  |  p. reopen  Reopen for rework',
    description: 'Task completed',
  },
  shipped: {
    transitions: ['task', 'next'],
    prompt: 'p. task <description>  Start new task',
    description: 'Feature shipped',
  },
}

// =============================================================================
// State Machine
// =============================================================================

export class WorkflowStateMachine {
  /**
   * Get current state from storage state
   */
  getCurrentState(storageState: {
    currentTask?: Record<string, unknown> | null
    pausedTasks?: unknown[]
    previousTask?: Record<string, unknown> | null
  }): WorkflowState {
    const task = storageState?.currentTask

    if (!task) {
      // Check if there are paused tasks (array or legacy previousTask)
      const hasPaused =
        (storageState?.pausedTasks?.length || 0) > 0 ||
        storageState?.previousTask?.status === 'paused'
      return hasPaused ? 'paused' : 'idle'
    }

    const status = (typeof task.status === 'string' ? task.status : '').toLowerCase()

    switch (status) {
      case 'in_progress':
      case 'working':
        return 'working'
      case 'paused':
        return 'paused'
      case 'completed':
      case 'done':
        return 'completed'
      case 'shipped':
        return 'shipped'
      default:
        return task ? 'working' : 'idle'
    }
  }

  /**
   * Check if a command is valid for the current state
   */
  canTransition(currentState: WorkflowState, command: WorkflowCommand): TransitionResult {
    const stateConfig = WORKFLOW_STATES[currentState]

    if (stateConfig.transitions.includes(command)) {
      return { valid: true }
    }

    // Build helpful error message
    const validCommands = stateConfig.transitions.map((c) => `p. ${c}`).join(', ')

    return {
      valid: false,
      error: `Cannot run 'p. ${command}' in ${currentState} state`,
      suggestion: `Valid commands: ${validCommands}`,
    }
  }

  /**
   * Get the next state after a command
   */
  getNextState(currentState: WorkflowState, command: WorkflowCommand): WorkflowState {
    switch (command) {
      case 'task':
        return 'working'
      case 'done':
        return 'completed'
      case 'pause':
        return 'paused'
      case 'resume':
        return 'working'
      case 'ship':
        return 'shipped'
      case 'reopen':
        return 'working'
      case 'next':
        return currentState // next doesn't change state
      default:
        return currentState
    }
  }

  /**
   * Get state definition
   */
  getStateInfo(state: WorkflowState): StateDefinition {
    return WORKFLOW_STATES[state]
  }

  /**
   * Get prompt for current state
   */
  getPrompt(state: WorkflowState): string {
    return WORKFLOW_STATES[state].prompt
  }

  /**
   * Get valid commands for current state
   */
  getValidCommands(state: WorkflowState): WorkflowCommand[] {
    return WORKFLOW_STATES[state].transitions
  }

  /**
   * Format next steps for display
   */
  formatNextSteps(state: WorkflowState): string[] {
    const stateConfig = WORKFLOW_STATES[state]
    return stateConfig.transitions.map((cmd) => {
      switch (cmd) {
        case 'task':
          return 'p. task <desc>  Start new task'
        case 'done':
          return 'p. done         Complete current task'
        case 'pause':
          return 'p. pause        Pause and switch context'
        case 'resume':
          return 'p. resume       Continue paused task'
        case 'ship':
          return 'p. ship         Ship the feature'
        case 'reopen':
          return 'p. reopen       Reopen for rework'
        case 'next':
          return 'p. next         View task queue'
        default:
          return `p. ${cmd}`
      }
    })
  }
}

// Singleton
export const workflowStateMachine = new WorkflowStateMachine()
