import { pointsToMinutes, suggestFromHistory } from '../domain/fibonacci'
import type { FibonacciPoint } from '../types/domain.js'
import type { TaskEstimate } from '../types/services/extracted'
import { breakdownService } from './breakdown-service'

function complexityToPoints(level: 'low' | 'medium' | 'high'): FibonacciPoint {
  switch (level) {
    case 'low':
      return 2
    case 'medium':
      return 5
    case 'high':
      return 8
  }
}

/**
 * Build a deterministic estimate to be stored on currentTask at start time.
 * Priority:
 * 1) History-based estimate by task type (if enough examples)
 * 2) Heuristic estimate from task complexity
 */
export async function estimateTaskForStart(
  projectId: string,
  description: string
): Promise<TaskEstimate> {
  const taskType = breakdownService.detectTaskType(description)

  const fromHistory = await suggestFromHistory(projectId, taskType)
  if (fromHistory) {
    const minutes = pointsToMinutes(fromHistory.points)
    return {
      taskType,
      estimatedPoints: fromHistory.points,
      estimatedMinutes: minutes.typical,
      source: 'history',
    }
  }

  const complexity = breakdownService.estimateComplexity(description)
  const estimatedPoints = complexityToPoints(complexity.level)
  const minutes = pointsToMinutes(estimatedPoints)

  return {
    taskType,
    estimatedPoints,
    estimatedMinutes: minutes.typical,
    source: 'heuristic',
  }
}

export default estimateTaskForStart
