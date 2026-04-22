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
    transitions: ['task'],
    prompt: 'prjct task <description>   Start working',
    description: 'No active task',
  },
  working: {
    transitions: ['done', 'pause'],
    prompt: 'prjct status done   Complete task  |  prjct status paused   Switch context',
    description: 'Task in progress',
  },
  paused: {
    transitions: ['resume', 'task', 'ship'],
    prompt:
      'prjct status active   Continue  |  prjct task <new>   Start different  |  prjct ship   Ship directly',
    description: 'Task paused',
  },
  completed: {
    transitions: ['ship', 'task', 'pause', 'reopen'],
    prompt:
      'prjct ship   Ship it  |  prjct task <next>   Start next  |  prjct status active   Reopen',
    description: 'Task completed',
  },
  shipped: {
    transitions: ['task'],
    prompt: 'prjct task <description>   Start new task',
    description: 'Feature shipped',
  },
}

// =============================================================================
// State Machine
// =============================================================================

export class WorkflowStateMachine {
  /**
   * Get current state from storage state.
   * When workspaceId is provided, looks up the task in activeTasks[] first
   * (multi-agent parallel mode). Falls back to currentTask for legacy/single mode.
   */
  getCurrentState(
    storageState: {
      currentTask?: Record<string, unknown> | null
      pausedTasks?: unknown[]
      previousTask?: Record<string, unknown> | null
      activeTasks?: Array<Record<string, unknown>>
    },
    workspaceId?: string
  ): WorkflowState {
    // Multi-agent mode: look up task by workspaceId in activeTasks
    let task: Record<string, unknown> | null | undefined = null
    if (workspaceId && storageState?.activeTasks?.length) {
      task = storageState.activeTasks.find((t) => t.workspaceId === workspaceId)
    }

    // Fallback to single-task mode
    if (!task) {
      task = storageState?.currentTask
    }

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

    // Error phrasing is about the lifecycle transition, not a CLI verb —
    // callers pass internal WorkflowCommand tokens. formatNextSteps()
    // produces the executable `prjct …` invocations for the suggestion.
    const suggestion = this.formatNextSteps(currentState).join('  |  ')

    return {
      valid: false,
      error: `Cannot transition to '${command}' from '${currentState}' state`,
      suggestion: `Valid next steps: ${suggestion}`,
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
   * Format next steps for display — emits executable `prjct` invocations
   * that match the v2 CLI surface. Internal WorkflowCommand tokens
   * (done/pause/resume/reopen/next) map to the v2 `status` primitive.
   */
  formatNextSteps(state: WorkflowState): string[] {
    const stateConfig = WORKFLOW_STATES[state]
    return stateConfig.transitions.map((cmd) => {
      switch (cmd) {
        case 'task':
          return 'prjct task <desc>       Start new task'
        case 'done':
          return 'prjct status done       Complete current task'
        case 'pause':
          return 'prjct status paused     Pause and switch context'
        case 'resume':
          return 'prjct status active     Continue paused task'
        case 'ship':
          return 'prjct ship              Ship the feature'
        case 'reopen':
          return 'prjct status active     Reopen completed task'
        default:
          return `prjct ${cmd}`
      }
    })
  }
}

// Singleton
export const workflowStateMachine = new WorkflowStateMachine()
