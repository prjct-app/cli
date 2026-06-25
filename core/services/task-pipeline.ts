export type TaskPipelineClassification = 'trivial' | 'substantive'

export type TaskPipelineStation =
  | 'direct'
  | 'spec_required'
  | 'test_red'
  | 'implementation'
  | 'verify'

export interface TaskPipelineDecision {
  kind: TaskPipelineClassification
  station: TaskPipelineStation
  requiresSpec: boolean
  requiresTestsFirst: boolean
  reason: string
}

const TRIVIAL_PATTERNS = [
  /\btypo\b/i,
  /\bdocs?\b/i,
  /\breadme\b/i,
  /\bformat\b/i,
  /\bchangelog\b/i,
  /\brerun\b.*\btests?\b/i,
  /\bre-?run\b.*\btests?\b/i,
]

const SUBSTANTIVE_PATTERNS = [
  /\badd\b/i,
  /\bimplement\b/i,
  /\bcreate\b/i,
  /\bbuild\b/i,
  /\bfeature\b/i,
  /\bbilling\b/i,
  /\bauth\b/i,
  /\bsecurity\b/i,
  /\bmigration\b/i,
  /\bretry\b/i,
  /\bfailure\b/i,
  /\brecovery\b/i,
  /\baudit\b/i,
  /\bworkflow\b/i,
  /\borchestrat/i,
]

export function classifyTaskPipeline(description: string): TaskPipelineDecision {
  const trimmed = description.trim()
  const trivial = TRIVIAL_PATTERNS.some((pattern) => pattern.test(trimmed))
  const substantive = SUBSTANTIVE_PATTERNS.some((pattern) => pattern.test(trimmed))

  if (trivial && !substantive) {
    return {
      kind: 'trivial',
      station: 'direct',
      requiresSpec: false,
      requiresTestsFirst: false,
      reason: 'trivial-keyword',
    }
  }

  if (substantive) {
    return {
      kind: 'substantive',
      station: 'spec_required',
      requiresSpec: true,
      requiresTestsFirst: true,
      reason: 'substantive-keyword',
    }
  }

  return {
    kind: 'trivial',
    station: 'direct',
    requiresSpec: false,
    requiresTestsFirst: false,
    reason: 'conservative-default',
  }
}

export function decideTaskPipeline(
  description: string,
  linkedSpecId?: string | null
): TaskPipelineDecision {
  const decision = classifyTaskPipeline(description)
  if (decision.kind === 'substantive' && linkedSpecId) {
    return {
      ...decision,
      station: 'test_red',
      reason: 'linked-spec',
    }
  }
  return decision
}

export function formatTaskPipelineNextAction(decision: TaskPipelineDecision): string {
  switch (decision.station) {
    case 'direct':
      return 'Proceed directly; no spec is required for this trivial task.'
    case 'spec_required':
      return 'Create or link a reviewed spec before implementation; write tests before implementation from the spec acceptance criteria.'
    case 'test_red':
      return 'Write failing tests before implementation, covering the linked spec acceptance criteria and edge cases.'
    case 'implementation':
      return 'Implement the minimum code needed to make the existing tests pass.'
    case 'verify':
      return 'Run verification and keep the task blocked on red tests.'
  }
}
