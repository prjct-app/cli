/**
 * Fibonacci Estimation Module
 *
 * Provides Fibonacci-based story point estimation with
 * points-to-time conversion and historical suggestion.
 */

import { FIBONACCI_MINUTES_MAP, FIBONACCI_POINTS } from '../constants/algorithms'
import type { FibonacciPoint } from '../types/domain.js'
import { parseDurationMinutes } from '../utils/date-helper'
import outcomeRecorder from '../workflows/outcome-recorder'

// =============================================================================
// Validation
// =============================================================================

/** Check if a number is a valid Fibonacci point */
export const isValidPoint = (n: number): n is FibonacciPoint =>
  FIBONACCI_POINTS.includes(n as FibonacciPoint)

// =============================================================================
// Points-to-Time Conversion
// =============================================================================

/** Get the time range for a given point value */
export const pointsToMinutes = (
  points: FibonacciPoint
): { min: number; max: number; typical: number } => {
  return FIBONACCI_MINUTES_MAP[points]
}

/** Format a minute count as a human-readable duration */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Get a human-readable time range for a point value */
export const pointsToTimeRange = (points: FibonacciPoint): string => {
  const range = pointsToMinutes(points)
  return `${formatMinutes(range.min)}–${formatMinutes(range.max)}`
}

// =============================================================================
// Historical Suggestion
// =============================================================================

/**
 * Suggest a point estimate based on historical outcomes for similar task types.
 * Returns null if not enough data (< 3 outcomes).
 */
export const suggestFromHistory = async (
  projectId: string,
  taskType: string
): Promise<{ points: FibonacciPoint; basedOn: number } | null> => {
  const outcomes = await outcomeRecorder.getAll(projectId)

  // Filter by task type tag
  const relevant = outcomes.filter((o) => o.tags?.includes(taskType))

  if (relevant.length < 3) return null

  // Calculate average actual duration in minutes
  const totalMinutes = relevant.reduce((sum, o) => {
    return sum + parseDurationMinutes(o.actualDuration)
  }, 0)
  const avgMinutes = totalMinutes / relevant.length

  // Find closest Fibonacci point by typical time
  const closest = findClosestPoint(avgMinutes)

  return { points: closest, basedOn: relevant.length }
}

// =============================================================================
// Helpers
// =============================================================================

/** Find the Fibonacci point whose typical time is closest to the given minutes */
export const findClosestPoint = (minutes: number): FibonacciPoint => {
  let closest: FibonacciPoint = 1
  let smallestDiff = Number.POSITIVE_INFINITY

  for (const point of FIBONACCI_POINTS) {
    const diff = Math.abs(FIBONACCI_MINUTES_MAP[point].typical - minutes)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closest = point
    }
  }

  return closest
}
