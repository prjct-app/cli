/**
 * Collection Filter Utilities
 *
 * Reusable filtering and sorting functions for storage collections.
 * Eliminates duplicated filter logic across storage classes.
 */

import type { Priority, TaskSection } from '../schemas/state'

/**
 * Priority order mapping for sorting (highest priority first)
 */
export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Section order mapping for sorting
 */
export const SECTION_ORDER: Record<TaskSection, number> = {
  active: 0,
  previously_active: 1,
  backlog: 2,
}

/**
 * Filter items by a specific field value
 */
export function filterByField<T, K extends keyof T>(
  items: T[],
  field: K,
  value: T[K]
): T[] {
  return items.filter((item) => item[field] === value)
}

/**
 * Filter items by multiple field values (OR logic)
 */
export function filterByFieldIn<T, K extends keyof T>(
  items: T[],
  field: K,
  values: T[K][]
): T[] {
  return items.filter((item) => values.includes(item[field]))
}

/**
 * Filter items excluding a specific field value
 */
export function filterByFieldNot<T, K extends keyof T>(
  items: T[],
  field: K,
  value: T[K]
): T[] {
  return items.filter((item) => item[field] !== value)
}

/**
 * Combined filter: field equals value AND another field is falsy
 * Useful for filtering active items that aren't completed
 */
export function filterActiveByField<T, K extends keyof T>(
  items: T[],
  field: K,
  value: T[K],
  activeField: keyof T
): T[] {
  return items.filter((item) => item[field] === value && !item[activeField])
}

/**
 * Filter items where a field is truthy
 */
export function filterByTruthy<T, K extends keyof T>(items: T[], field: K): T[] {
  return items.filter((item) => Boolean(item[field]))
}

/**
 * Filter items where a field is falsy
 */
export function filterByFalsy<T, K extends keyof T>(items: T[], field: K): T[] {
  return items.filter((item) => !item[field])
}

/**
 * Sort items by priority (highest first)
 */
export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

/**
 * Sort items by section, then priority
 */
export function sortBySectionAndPriority<T extends { section: TaskSection; priority: Priority }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const sectionDiff = SECTION_ORDER[a.section] - SECTION_ORDER[b.section]
    if (sectionDiff !== 0) return sectionDiff
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  })
}

/**
 * Sort items by date field
 */
export function sortByDate<T>(
  items: T[],
  dateField: keyof T,
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a[dateField] as string).getTime()
    const dateB = new Date(b[dateField] as string).getTime()
    return direction === 'desc' ? dateB - dateA : dateA - dateB
  })
}

/**
 * Filter items by date range
 */
export function filterByDateRange<T>(
  items: T[],
  dateField: keyof T,
  startDate: Date,
  endDate: Date
): T[] {
  return items.filter((item) => {
    const date = new Date(item[dateField] as string)
    return date >= startDate && date <= endDate
  })
}

/**
 * Filter items from the last N days
 */
export function filterByLastDays<T>(items: T[], dateField: keyof T, days: number): T[] {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  return filterByDateRange(items, dateField, startDate, new Date())
}

/**
 * Group items by a field value
 */
export function groupByField<T, K extends keyof T>(items: T[], field: K): Map<T[K], T[]> {
  const groups = new Map<T[K], T[]>()

  for (const item of items) {
    const key = item[field]
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  return groups
}

/**
 * Count items by field value
 */
export function countByField<T, K extends keyof T>(items: T[], field: K): Map<T[K], number> {
  const counts = new Map<T[K], number>()

  for (const item of items) {
    const key = item[field]
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return counts
}

/**
 * Get the first N items
 */
export function take<T>(items: T[], count: number): T[] {
  return items.slice(0, count)
}

/**
 * Get the last N items
 */
export function takeLast<T>(items: T[], count: number): T[] {
  return items.slice(-count)
}

/**
 * Find item by field value
 */
export function findByField<T, K extends keyof T>(
  items: T[],
  field: K,
  value: T[K]
): T | undefined {
  return items.find((item) => item[field] === value)
}

/**
 * Check if any item matches field value
 */
export function anyByField<T, K extends keyof T>(items: T[], field: K, value: T[K]): boolean {
  return items.some((item) => item[field] === value)
}

/**
 * Remove duplicates by field
 */
export function uniqueByField<T, K extends keyof T>(items: T[], field: K): T[] {
  const seen = new Set<T[K]>()
  return items.filter((item) => {
    if (seen.has(item[field])) return false
    seen.add(item[field])
    return true
  })
}

// Default export for CommonJS compatibility
export default {
  PRIORITY_ORDER,
  SECTION_ORDER,
  filterByField,
  filterByFieldIn,
  filterByFieldNot,
  filterActiveByField,
  filterByTruthy,
  filterByFalsy,
  sortByPriority,
  sortBySectionAndPriority,
  sortByDate,
  filterByDateRange,
  filterByLastDays,
  groupByField,
  countByField,
  take,
  takeLast,
  findByField,
  anyByField,
  uniqueByField,
}
