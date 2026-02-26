/**
 * Tech Normalizer (PRJ-300)
 *
 * Normalized matching for tech stack / framework names.
 * Handles:
 * - Compound names: "React + TypeScript" → ["react", "typescript"]
 * - Case-insensitive, whitespace-insensitive matching
 */

import { uniqueBy } from '../utils/collection-filters'

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Normalize a single framework/tech name.
 * Strips whitespace and lowercases.
 *
 * @example
 * normalizeFrameworkName("Next.js") → "next.js"
 * normalizeFrameworkName("  TypeScript ") → "typescript"
 */
export function normalizeFrameworkName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Extract individual tech names from a compound string.
 * Handles separators: +, /, comma, parentheses, "with", "and".
 *
 * @example
 * extractTechNames("React + TypeScript") → ["react", "typescript"]
 * extractTechNames("Next.js (React)") → ["next.js", "react"]
 * extractTechNames("Hono with Zod") → ["hono", "zod"]
 */
export function extractTechNames(compound: string): string[] {
  // Replace parentheses with comma separators to split them out
  const parts = compound
    .replace(/[()]/g, ',')
    .split(/[+/,]|\bwith\b|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return parts.map(normalizeFrameworkName)
}

/**
 * Get the framework family for a tech name.
 * Returns the normalized name — the LLM already knows framework relationships.
 *
 * @example
 * getFrameworkFamily("next.js") → "next.js"
 * getFrameworkFamily("Express") → "express"
 */
export function getFrameworkFamily(name: string): string {
  return normalizeFrameworkName(name)
}

/**
 * Check if two tech names match (direct match or compound contains).
 *
 * @example
 * matchesTech("React", "react") → true
 * matchesTech("React + TypeScript", "react") → true (contains react)
 * matchesTech("Vue", "react") → false
 */
export function matchesTech(actual: string, expected: string): boolean {
  const expectedNorm = normalizeFrameworkName(expected)

  // Extract all tech names from actual (handles compound names)
  const actualNames = extractTechNames(actual)

  for (const name of actualNames) {
    if (name === expectedNorm) return true
  }

  return false
}

/**
 * Deduplicate a tech stack list using normalized matching.
 * Preserves the first occurrence's original casing.
 *
 * @example
 * deduplicateTechStack(["React", "react", "Next.js"]) → ["React", "Next.js"]
 * deduplicateTechStack(["TypeScript", "typescript"]) → ["TypeScript"]
 */
export function deduplicateTechStack(stack: string[]): string[] {
  return uniqueBy(stack, normalizeFrameworkName)
}
