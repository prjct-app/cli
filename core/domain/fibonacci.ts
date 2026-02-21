/**
 * Fibonacci Estimation Module
 *
 * Provides Fibonacci-based story point estimation with
 * points-to-time conversion and historical suggestion.
 */

import type { FibonacciPoint } from '../types/domain.js'
import outcomeRecorder from '../workflows/outcome-recorder'

// =============================================================================
// Constants
// =============================================================================

/** Valid Fibonacci story points */
export const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const

/** Default points-to-minutes mapping */
const DEFAULT_MINUTES_MAP: Record<FibonacciPoint, { min: number; max: number; typical: number }> = {
  1: { min: 5, max: 15, typical: 10 },
  2: { min: 15, max: 30, typical: 20 },
  3: { min: 30, max: 60, typical: 45 },
  5: { min: 60, max: 120, typical: 90 },
  8: { min: 120, max: 240, typical: 180 },
  13: { min: 240, max: 480, typical: 360 },
  21: { min: 480, max: 960, typical: 720 },
}

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
  return DEFAULT_MINUTES_MAP[points]
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
    return sum + parseDuration(o.actualDuration)
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
    const diff = Math.abs(DEFAULT_MINUTES_MAP[point].typical - minutes)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closest = point
    }
  }

  return closest
}

/** Parse a duration string like "2h 30m" to minutes */
const parseDuration = (duration: string): number => {
  let minutes = 0

  const hourMatch = duration.match(/(\d+)h/)
  if (hourMatch) {
    minutes += Number.parseInt(hourMatch[1], 10) * 60
  }

  const minMatch = duration.match(/(\d+)m/)
  if (minMatch) {
    minutes += Number.parseInt(minMatch[1], 10)
  }

  return minutes
}
