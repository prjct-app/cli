/**
 * Tech Normalizer (PRJ-300)
 *
 * Normalized matching for tech stack / framework names.
 * Handles:
 * - Compound names: "React + TypeScript" → ["react", "typescript"]
 * - Framework aliases: "nextjs" → "next.js"
 * - Framework families: "Next.js" → react family
 * - Case-insensitive, whitespace-insensitive matching
 */

// =============================================================================
// Framework Families
// =============================================================================

/**
 * Map framework names to their family (meta-framework → base framework).
 * Used to verify that "Next.js" matches expected "react".
 */
const FRAMEWORK_FAMILIES: Record<string, string> = {
  'next.js': 'react',
  nextjs: 'react',
  remix: 'react',
  gatsby: 'react',
  'react native': 'react',
  expo: 'react',
  nuxt: 'vue',
  'nuxt.js': 'vue',
  nuxtjs: 'vue',
  sveltekit: 'svelte',
  analog: 'angular',
  astro: 'multi',
  vite: 'multi',
}

/**
 * Aliases that normalize to a canonical name.
 */
const FRAMEWORK_ALIASES: Record<string, string> = {
  nextjs: 'next.js',
  nuxtjs: 'nuxt.js',
  expressjs: 'express',
  fastifyjs: 'fastify',
  'react.js': 'react',
  'vue.js': 'vue',
  'svelte.js': 'svelte',
  'angular.js': 'angular',
  angularjs: 'angular',
  'node.js': 'node',
  nodejs: 'node',
  ts: 'typescript',
  js: 'javascript',
  pg: 'postgres',
  postgresql: 'postgres',
  mongo: 'mongodb',
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Normalize a single framework/tech name.
 * Strips whitespace, lowercases, resolves aliases.
 *
 * @example
 * normalizeFrameworkName("Next.js") → "next.js"
 * normalizeFrameworkName("  TypeScript ") → "typescript"
 * normalizeFrameworkName("NodeJS") → "node"
 */
export function normalizeFrameworkName(name: string): string {
  const trimmed = name.trim().toLowerCase()

  // Check aliases
  const aliasKey = trimmed.replace(/[.\s-]/g, '')
  if (FRAMEWORK_ALIASES[aliasKey]) {
    return FRAMEWORK_ALIASES[aliasKey]
  }
  if (FRAMEWORK_ALIASES[trimmed]) {
    return FRAMEWORK_ALIASES[trimmed]
  }

  return trimmed
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
 * Returns the base framework or the name itself if no family exists.
 *
 * @example
 * getFrameworkFamily("next.js") → "react"
 * getFrameworkFamily("nuxt") → "vue"
 * getFrameworkFamily("express") → "express"
 */
export function getFrameworkFamily(name: string): string {
  const normalized = normalizeFrameworkName(name)
  return FRAMEWORK_FAMILIES[normalized] || normalized
}

/**
 * Check if two tech names match (direct or via family).
 *
 * @example
 * matchesTech("Next.js", "react") → true (Next.js is React family)
 * matchesTech("React + TypeScript", "react") → true (contains react)
 * matchesTech("Vue", "react") → false
 */
export function matchesTech(actual: string, expected: string): boolean {
  const expectedNorm = normalizeFrameworkName(expected)

  // Extract all tech names from actual (handles compound names)
  const actualNames = extractTechNames(actual)

  for (const name of actualNames) {
    // Direct match
    if (name === expectedNorm) return true
    // Family match
    if (getFrameworkFamily(name) === expectedNorm) return true
    // Reverse family match
    if (getFrameworkFamily(expectedNorm) === name) return true
  }

  return false
}

/**
 * Deduplicate a tech stack list using normalized matching.
 * Preserves the first occurrence's original casing.
 *
 * @example
 * deduplicateTechStack(["React", "react", "Next.js"]) → ["React", "Next.js"]
 * deduplicateTechStack(["TypeScript", "ts"]) → ["TypeScript"]
 */
export function deduplicateTechStack(stack: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const name of stack) {
    const normalized = normalizeFrameworkName(name)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(name)
    }
  }

  return result
}
