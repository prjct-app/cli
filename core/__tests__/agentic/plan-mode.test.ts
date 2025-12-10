/**
 * Plan Mode Tests
 * P3.4: Plan Mode + Approval Flow
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import planMode, {
  PLAN_STATUS,
  PLAN_REQUIRED_COMMANDS,
  DESTRUCTIVE_COMMANDS,
  PLANNING_TOOLS
} from '../../agentic/plan-mode'

describe('PlanMode P3.4', () => {
  const TEST_PROJECT_ID = 'test-plan-mode'

  beforeEach(() => {
    planMode.activePlans.clear()
  })

  describe('requiresPlanning', () => {
    it('should return true for feature command', () => {
      expect(planMode.requiresPlanning('feature')).toBe(true)
    })

    it('should return true for spec command', () => {
      expect(planMode.requiresPlanning('spec')).toBe(true)
    })

    it('should return false for now command', () => {
      expect(planMode.requiresPlanning('now')).toBe(false)
    })

    it('should return false for done command', () => {
      expect(planMode.requiresPlanning('done')).toBe(false)
    })
  })

  describe('isDestructive', () => {
    it('should return true for ship command', () => {
      expect(planMode.isDestructive('ship')).toBe(true)
    })

    it('should return true for cleanup command', () => {
      expect(planMode.isDestructive('cleanup')).toBe(true)
    })

    it('should return false for feature command', () => {
      expect(planMode.isDestructive('feature')).toBe(false)
    })
  })

  describe('isToolAllowedInPlanning', () => {
    it('should allow Read in planning mode', () => {
      expect(planMode.isToolAllowedInPlanning('Read')).toBe(true)
    })

    it('should allow Glob in planning mode', () => {
      expect(planMode.isToolAllowedInPlanning('Glob')).toBe(true)
    })

    it('should not allow Write in planning mode', () => {
      expect(planMode.isToolAllowedInPlanning('Write')).toBe(false)
    })

    it('should not allow Bash in planning mode', () => {
      expect(planMode.isToolAllowedInPlanning('Bash')).toBe(false)
    })
  })

  describe('getAllowedTools', () => {
    it('should filter to read-only tools in planning mode', () => {
      const templateTools = ['Read', 'Write', 'Glob', 'Bash', 'Grep']
      const allowed = planMode.getAllowedTools(true, templateTools)

      expect(allowed).toContain('Read')
      expect(allowed).toContain('Glob')
      expect(allowed).toContain('Grep')
      expect(allowed).not.toContain('Write')
      expect(allowed).not.toContain('Bash')
    })

    it('should return all template tools when not in planning mode', () => {
      const templateTools = ['Read', 'Write', 'Glob', 'Bash']
      const allowed = planMode.getAllowedTools(false, templateTools)

      expect(allowed).toEqual(templateTools)
    })
  })

  describe('startPlanning', () => {
    it('should create a new plan with correct initial state', () => {
      const plan = planMode.startPlanning(TEST_PROJECT_ID, 'feature', { description: 'Add dark mode' })

      expect(plan.id).toMatch(/^plan_/)
      expect(plan.projectId).toBe(TEST_PROJECT_ID)
      expect(plan.command).toBe('feature')
      expect(plan.status).toBe(PLAN_STATUS.GATHERING)
      expect(plan.gatheredInfo).toEqual([])
    })

    it('should store plan in activePlans', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})

      expect(planMode.getActivePlan(TEST_PROJECT_ID)).not.toBeNull()
    })
  })

  describe('isInPlanningMode', () => {
    it('should return true when gathering info', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})

      expect(planMode.isInPlanningMode(TEST_PROJECT_ID)).toBe(true)
    })

    it('should return true when pending approval', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { summary: 'Test', steps: [] })

      expect(planMode.isInPlanningMode(TEST_PROJECT_ID)).toBe(true)
    })

    it('should return false when no active plan', () => {
      expect(planMode.isInPlanningMode('non-existent-project')).toBe(false)
    })

    it('should return false when plan is executing', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { summary: 'Test', steps: [{ description: 'Step 1' }] })
      planMode.approvePlan(TEST_PROJECT_ID)
      planMode.startExecution(TEST_PROJECT_ID)

      expect(planMode.isInPlanningMode(TEST_PROJECT_ID)).toBe(false)
    })
  })

  describe('recordGatheredInfo', () => {
    it('should add info to gatheredInfo array', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.recordGatheredInfo(TEST_PROJECT_ID, { type: 'file', source: 'src/index.js', data: 'content' })

      const plan = planMode.getActivePlan(TEST_PROJECT_ID)
      expect(plan!.gatheredInfo.length).toBe(1)
      expect(plan!.gatheredInfo[0].type).toBe('file')
    })
  })

  describe('proposePlan', () => {
    it('should set status to pending approval', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, {
        summary: 'Add dark mode feature',
        approach: 'CSS variables with theme context',
        steps: [{ description: 'Create theme context' }, { description: 'Add toggle' }]
      })

      const plan = planMode.getActivePlan(TEST_PROJECT_ID)
      expect(plan!.status).toBe(PLAN_STATUS.PENDING_APPROVAL)
    })

    it('should return formatted plan for display', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      const formatted = planMode.proposePlan(TEST_PROJECT_ID, {
        summary: 'Test plan',
        approach: 'Test approach',
        steps: [{ description: 'Step 1' }]
      })

      expect(formatted!.summary).toBe('Test plan')
      expect(formatted!.approach).toBe('Test approach')
      expect(formatted!.requiresConfirmation).toBe(true)
    })
  })

  describe('approvePlan', () => {
    it('should change status to approved', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { steps: [{ description: 'Step 1' }] })
      const result = planMode.approvePlan(TEST_PROJECT_ID)

      expect(result!.approved).toBe(true)
      const plan = planMode.getActivePlan(TEST_PROJECT_ID)
      expect(plan!.status).toBe(PLAN_STATUS.APPROVED)
    })

    it('should convert proposed steps to executable steps', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, {
        steps: [{ description: 'Step 1' }, { description: 'Step 2' }]
      })
      const result = planMode.approvePlan(TEST_PROJECT_ID)

      expect(result!.steps.length).toBe(2)
      expect(result!.steps[0].status).toBe('pending')
    })

    it('should return null if not pending approval', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      const result = planMode.approvePlan(TEST_PROJECT_ID)

      expect(result).toBeNull()
    })
  })

  describe('rejectPlan', () => {
    it('should mark plan as rejected', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { steps: [] })
      const result = planMode.rejectPlan(TEST_PROJECT_ID, 'Not the right approach')

      expect(result!.rejected).toBe(true)
      expect(result!.reason).toBe('Not the right approach')
    })

    it('should clear active plan after rejection', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { steps: [] })
      planMode.rejectPlan(TEST_PROJECT_ID)

      expect(planMode.getActivePlan(TEST_PROJECT_ID)).toBeNull()
    })
  })

  describe('execution flow', () => {
    beforeEach(() => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, {
        steps: [
          { description: 'Step 1', tool: 'Write' },
          { description: 'Step 2', tool: 'Bash' }
        ]
      })
      planMode.approvePlan(TEST_PROJECT_ID)
    })

    it('should start execution and return first step', () => {
      const step = planMode.startExecution(TEST_PROJECT_ID)

      expect(step!.stepNumber).toBe(1)
      expect(step!.totalSteps).toBe(2)
      expect(step!.progress).toBe(0)
    })

    it('should advance to next step on completion', () => {
      planMode.startExecution(TEST_PROJECT_ID)
      const nextStep = planMode.completeStep(TEST_PROJECT_ID, { success: true })

      expect(nextStep!.stepNumber).toBe(2)
      expect(nextStep!.progress).toBe(50)
    })

    it('should complete plan when all steps done', () => {
      planMode.startExecution(TEST_PROJECT_ID)
      planMode.completeStep(TEST_PROJECT_ID)
      const result = planMode.completeStep(TEST_PROJECT_ID)

      expect(result).toBeNull()
      expect(planMode.getActivePlan(TEST_PROJECT_ID)).toBeNull()
    })
  })

  describe('abortPlan', () => {
    it('should abort and clear active plan', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, { steps: [{ description: 'Step 1' }] })
      planMode.approvePlan(TEST_PROJECT_ID)
      planMode.startExecution(TEST_PROJECT_ID)

      const result = planMode.abortPlan(TEST_PROJECT_ID, 'User cancelled')

      expect(result!.aborted).toBe(true)
      expect(result!.reason).toBe('User cancelled')
      expect(planMode.getActivePlan(TEST_PROJECT_ID)).toBeNull()
    })
  })

  describe('generateApprovalPrompt', () => {
    it('should generate ship approval prompt', () => {
      const prompt = planMode.generateApprovalPrompt('ship', {
        branch: 'feature/dark-mode',
        changedFiles: ['a.js', 'b.js'],
        commitMessage: 'Add dark mode'
      })

      expect(prompt.title).toBe('Ship Confirmation')
      expect(prompt.details).toContain('Branch: feature/dark-mode')
      expect(prompt.options.length).toBe(3)
    })

    it('should generate cleanup approval prompt', () => {
      const prompt = planMode.generateApprovalPrompt('cleanup', {
        filesToDelete: ['temp.js'],
        linesOfCode: 50
      })

      expect(prompt.title).toBe('Cleanup Confirmation')
      expect(prompt.message).toContain('delete')
    })

    it('should generate default prompt for unknown commands', () => {
      const prompt = planMode.generateApprovalPrompt('unknown', {})

      expect(prompt.title).toBe('Confirmation Required')
      expect(prompt.options.length).toBe(2)
    })
  })

  describe('formatStatus', () => {
    it('should format gathering status', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      const status = planMode.formatStatus(TEST_PROJECT_ID)

      expect(status).toContain('🔍')
      expect(status).toContain('feature')
      expect(status).toContain('gathering')
    })

    it('should show progress during execution', () => {
      planMode.startPlanning(TEST_PROJECT_ID, 'feature', {})
      planMode.proposePlan(TEST_PROJECT_ID, {
        steps: [{ description: 'Step 1' }, { description: 'Step 2' }]
      })
      planMode.approvePlan(TEST_PROJECT_ID)
      planMode.startExecution(TEST_PROJECT_ID)

      const status = planMode.formatStatus(TEST_PROJECT_ID)

      expect(status).toContain('⚡')
      expect(status).toContain('Progress')
    })

    it('should return message for no active plan', () => {
      const status = planMode.formatStatus('non-existent')

      expect(status).toBe('No active plan')
    })
  })
})
