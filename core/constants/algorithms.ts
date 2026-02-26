import type { FibonacciPoint } from '../types/domain.js'

/** BM25 tuning: term frequency saturation */
export const BM25_K1 = 1.2

/** BM25 tuning: document length normalization */
export const BM25_B = 0.75

/** Minimum Jaccard similarity to include in co-change matrix */
export const COCHANGE_MIN_SIMILARITY = 0.1

/** Minimum times a file must appear in commits for co-change analysis */
export const COCHANGE_MIN_FILE_OCCURRENCES = 2

/** Maximum files in a single commit to consider (skip merges/bulk) */
export const COCHANGE_MAX_FILES_PER_COMMIT = 30

/** Valid Fibonacci story points */
export const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const

/** Default points-to-minutes mapping */
export const FIBONACCI_MINUTES_MAP: Record<
  FibonacciPoint,
  { min: number; max: number; typical: number }
> = {
  1: { min: 5, max: 15, typical: 10 },
  2: { min: 15, max: 30, typical: 20 },
  3: { min: 30, max: 60, typical: 45 },
  5: { min: 60, max: 120, typical: 90 },
  8: { min: 120, max: 240, typical: 180 },
  13: { min: 240, max: 480, typical: 360 },
  21: { min: 480, max: 960, typical: 720 },
}

/** Day-of-week index (0=Sunday, 1=Monday, ..., 6=Saturday) */
export const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}
