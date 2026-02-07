/**
 * Chain of Thought Reasoning
 * Implements step-by-step reasoning for complex commands
 *
 * @module agentic/chain-of-thought
 * @version 1.0.0
 */

import type { ContextState, ProjectContext } from '../types'

// Type aliases for compatibility with ProjectContext from contextBuilder.build()
type Context = Pick<ProjectContext, 'projectId' | 'projectPath' | 'params'>
type State = ContextState

interface ReasoningStep {
  step: string
  passed: boolean
  details?: string
}

interface ReasoningResult {
  commandName: string
  reasoning: {
    steps: ReasoningStep[]
    allPassed: boolean
    criticalIssues: string[]
  } | null
  plan: string[]
  confidence: number
}

/**
 * Commands that require chain of thought reasoning
 */
const REASONING_REQUIRED_COMMANDS = ['ship', 'feature', 'spec', 'cleanup', 'migrate']

/**
 * Check if command requires reasoning
 */
function requiresReasoning(commandName: string): boolean {
  return REASONING_REQUIRED_COMMANDS.includes(commandName)
}

/**
 * Reason through a command before execution
 */
async function reason(
  commandName: string,
  context: Context,
  state: State
): Promise<ReasoningResult> {
  const steps: ReasoningStep[] = []
  const plan: string[] = []
  const criticalIssues: string[] = []

  switch (commandName) {
    case 'ship':
      // Check prerequisites
      if (state.now && !state.now.includes('No current task')) {
        steps.push({ step: 'Has active task', passed: true })
      } else {
        steps.push({ step: 'Has active task', passed: false, details: 'No active task to ship' })
        criticalIssues.push('No active task')
      }

      // Check if there's content to ship
      if (state.shipped) {
        steps.push({ step: 'Shipped log accessible', passed: true })
      } else {
        steps.push({
          step: 'Shipped log accessible',
          passed: false,
          details: 'shipped.md not found',
        })
      }

      // Plan
      plan.push('Read current task from now.md')
      plan.push('Calculate duration')
      plan.push('Append to shipped.md')
      plan.push('Clear now.md')
      plan.push('Update metrics')
      break

    case 'feature':
      // Check if description provided
      if (context.params.description || context.params.feature) {
        steps.push({ step: 'Has feature description', passed: true })
      } else {
        steps.push({
          step: 'Has feature description',
          passed: false,
          details: 'No description provided',
        })
        criticalIssues.push('Missing feature description')
      }

      // Check roadmap accessibility
      if (state.analysis) {
        steps.push({ step: 'Project analyzed', passed: true })
      } else {
        steps.push({ step: 'Project analyzed', passed: false, details: 'Run /p:sync first' })
      }

      // Plan
      plan.push('Parse feature description')
      plan.push('Generate tasks breakdown')
      plan.push('Add to roadmap.md')
      plan.push('Add tasks to next.md')
      plan.push('Suggest starting first task')
      break

    case 'spec':
      // Check if feature name provided
      if (context.params.feature || context.params.name) {
        steps.push({ step: 'Has spec name', passed: true })
      } else {
        steps.push({ step: 'Has spec name', passed: false, details: 'No spec name provided' })
        criticalIssues.push('Missing spec name')
      }

      // Plan
      plan.push('Generate spec template')
      plan.push('Analyze requirements')
      plan.push('Create spec file')
      plan.push('Link to roadmap')
      break

    case 'cleanup':
      // Check for analysis
      if (state.analysis) {
        steps.push({ step: 'Has code analysis', passed: true })
      } else {
        steps.push({ step: 'Has code analysis', passed: false, details: 'Run /p:analyze first' })
      }

      // Plan
      plan.push('Scan for unused code')
      plan.push('Identify dead imports')
      plan.push('List files to clean')
      plan.push('Show preview')
      plan.push('Wait for approval')
      plan.push('Execute cleanup')
      break

    case 'migrate':
      // Always warn for migrate
      steps.push({
        step: 'Migration safety check',
        passed: true,
        details: 'Will require manual approval',
      })

      // Plan
      plan.push('Analyze current state')
      plan.push('Generate migration plan')
      plan.push('Show affected files')
      plan.push('Request approval')
      plan.push('Execute migration')
      plan.push('Verify results')
      break

    default:
      // Generic plan
      plan.push('Execute command')
      break
  }

  // Calculate confidence
  const passedSteps = steps.filter((s) => s.passed).length
  const totalSteps = steps.length
  const confidence = totalSteps > 0 ? passedSteps / totalSteps : 1

  return {
    commandName,
    reasoning:
      steps.length > 0
        ? {
            steps,
            allPassed: criticalIssues.length === 0,
            criticalIssues,
          }
        : null,
    plan,
    confidence,
  }
}

/**
 * Format reasoning plan for display
 */
function formatPlan(result: ReasoningResult): string {
  const lines: string[] = []

  lines.push(`📋 Chain of Thought: ${result.commandName}`)
  lines.push('')

  if (result.reasoning) {
    lines.push('Steps:')
    result.reasoning.steps.forEach((step) => {
      const icon = step.passed ? '✅' : '❌'
      lines.push(`  ${icon} ${step.step}`)
      if (step.details) {
        lines.push(`      ${step.details}`)
      }
    })
    lines.push('')

    if (result.reasoning.criticalIssues.length > 0) {
      lines.push('Critical Issues:')
      result.reasoning.criticalIssues.forEach((issue) => {
        lines.push(`  ⚠️  ${issue}`)
      })
      lines.push('')
    }
  }

  if (result.plan.length > 0) {
    lines.push('Plan:')
    result.plan.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step}`)
    })
    lines.push('')
  }

  lines.push(`Confidence: ${Math.round(result.confidence * 100)}%`)

  return lines.join('\n')
}

export { requiresReasoning, reason, formatPlan, REASONING_REQUIRED_COMMANDS }

const chainOfThought = { requiresReasoning, reason, formatPlan, REASONING_REQUIRED_COMMANDS }
export default chainOfThought
