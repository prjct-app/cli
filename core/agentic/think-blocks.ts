/**
 * Think Blocks
 * Dynamic reasoning blocks for complex decisions
 *
 * @module agentic/think-blocks
 * @version 1.0.0
 */

interface Context {
  params: Record<string, unknown>
  [key: string]: unknown
}

interface State {
  now?: string | null
  analysis?: string | null
  codePatterns?: string | null
  [key: string]: unknown
}

interface ThinkTrigger {
  type: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface ThinkBlock {
  trigger: ThinkTrigger
  commandName: string
  conclusions: string[]
  plan: string[]
  confidence: number
  generatedAt: string
}

/**
 * Detect if a think block is needed
 */
function detectTrigger(commandName: string, context: Context, state: State): ThinkTrigger | null {
  // High-priority triggers (always think)
  const highPriorityCommands = ['ship', 'cleanup', 'migrate']
  if (highPriorityCommands.includes(commandName)) {
    return {
      type: 'critical_command',
      reason: `${commandName} is a critical command requiring careful planning`,
      priority: 'high',
    }
  }

  // Check for complex task
  const taskDescription = (context.params.task as string) || (context.params.description as string) || ''
  if (taskDescription.length > 100) {
    return {
      type: 'complex_task',
      reason: 'Task description is complex, requiring analysis',
      priority: 'medium',
    }
  }

  // Check for existing task (potential conflict)
  if (state.now && !state.now.includes('No current task') && commandName === 'now') {
    return {
      type: 'task_conflict',
      reason: 'Already has active task, need to decide how to handle',
      priority: 'medium',
    }
  }

  // Check if analysis exists (context-aware)
  if (!state.analysis && ['feature', 'spec', 'design'].includes(commandName)) {
    return {
      type: 'missing_context',
      reason: 'No project analysis available, may need /p:sync first',
      priority: 'low',
    }
  }

  // Check for code patterns
  if (!state.codePatterns && ['now', 'build', 'fix'].includes(commandName)) {
    return {
      type: 'missing_patterns',
      reason: 'No code patterns detected, may produce inconsistent code',
      priority: 'low',
    }
  }

  return null
}

/**
 * Generate a think block
 */
async function generate(
  trigger: ThinkTrigger,
  commandName: string,
  context: Context,
  state: State
): Promise<ThinkBlock> {
  const conclusions: string[] = []
  const plan: string[] = []
  let confidence = 0.8

  switch (trigger.type) {
    case 'critical_command':
      conclusions.push(`${commandName} requires careful execution`)
      conclusions.push('Will verify state before proceeding')
      plan.push('Check current state')
      plan.push('Verify prerequisites')
      plan.push('Execute with confirmation')
      plan.push('Verify results')
      confidence = 0.9
      break

    case 'complex_task':
      conclusions.push('Task appears complex, breaking down')
      conclusions.push('Will analyze dependencies first')
      plan.push('Parse task requirements')
      plan.push('Identify affected components')
      plan.push('Create execution plan')
      plan.push('Execute incrementally')
      confidence = 0.7
      break

    case 'task_conflict':
      conclusions.push('Existing task detected')
      conclusions.push('Should complete or pause current task first')
      plan.push('Check current task status')
      plan.push('Decide: complete, pause, or replace')
      plan.push('Update task state')
      plan.push('Proceed with new task')
      confidence = 0.6
      break

    case 'missing_context':
      conclusions.push('Project analysis not available')
      conclusions.push('May produce less optimal results')
      plan.push('Proceed with available context')
      plan.push('Note recommendation to run /p:sync')
      confidence = 0.5
      break

    case 'missing_patterns':
      conclusions.push('Code patterns not detected')
      conclusions.push('Will use best-effort pattern matching')
      plan.push('Read existing code for patterns')
      plan.push('Match detected style')
      plan.push('Generate consistent code')
      confidence = 0.6
      break

    default:
      conclusions.push('Standard execution path')
      plan.push('Execute command as specified')
      confidence = 0.8
  }

  return {
    trigger,
    commandName,
    conclusions,
    plan,
    confidence,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Format think block for display
 */
function format(thinkBlock: ThinkBlock | null, verbose: boolean = false): string {
  if (!thinkBlock) {
    return ''
  }

  const lines: string[] = []

  if (verbose) {
    lines.push(`🧠 Think Block: ${thinkBlock.commandName}`)
    lines.push(`Trigger: ${thinkBlock.trigger.type} (${thinkBlock.trigger.priority})`)
    lines.push(`Reason: ${thinkBlock.trigger.reason}`)
    lines.push('')
  }

  lines.push('Conclusions:')
  thinkBlock.conclusions.forEach((c) => {
    lines.push(`  → ${c}`)
  })

  lines.push('')
  lines.push('Plan:')
  thinkBlock.plan.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p}`)
  })

  lines.push('')
  lines.push(`Confidence: ${Math.round(thinkBlock.confidence * 100)}%`)

  return lines.join('\n')
}

export { detectTrigger, generate, format }
export default { detectTrigger, generate, format }
