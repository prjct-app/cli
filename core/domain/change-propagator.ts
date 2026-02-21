/**
 * Change Propagator — Import-Based Change Detection
 *
 * When a file changes, files that import it may also need re-analysis.
 * Uses the import graph (PRJ-304) to propagate changes 1 level deep
 * through the reverse dependency chain.
 *
 * Example: If `auth.ts` changes, and `user-service.ts` imports `auth.ts`,
 * then `user-service.ts` is also marked as "affected" even though its
 * content hash didn't change.
 *
 * @module domain/change-propagator
 * @version 1.0.0
 */

import type { FileDiff, PropagatedChanges } from '../types/domain.js'
import { loadGraph } from './import-graph'

// =============================================================================
// Propagation
// =============================================================================

/**
 * Given a file diff, propagate changes through the import graph.
 *
 * For each changed file, find all files that import it (reverse edges)
 * at depth 1. These "affected" files should be re-analyzed because
 * their imports have changed behavior.
 *
 * @param diff - The raw file diff from hash comparison
 * @param projectId - Project ID for loading the import graph
 * @returns Propagated changes including affected importers
 */
export function propagateChanges(diff: FileDiff, projectId: string): PropagatedChanges {
  const directlyChanged = [...diff.added, ...diff.modified]
  const directSet = new Set(directlyChanged)
  const affected = new Set<string>()

  // Try to load import graph for reverse-edge lookup
  const graph = loadGraph(projectId)

  if (graph) {
    // For each directly changed file, find its reverse edges (files that import it)
    for (const changedFile of directlyChanged) {
      const importers = graph.reverse[changedFile]
      if (importers) {
        for (const importer of importers) {
          // Only add if not already directly changed
          if (!directSet.has(importer)) {
            affected.add(importer)
          }
        }
      }
    }
  }

  const affectedByImports = Array.from(affected)
  const allAffected = [...directlyChanged, ...affectedByImports]

  return {
    directlyChanged,
    affectedByImports,
    deleted: diff.deleted,
    allAffected,
  }
}

/**
 * Determine which domain agents need regeneration based on changed files.
 *
 * Maps file extensions and paths to domains:
 * - .tsx/.jsx/.css/.scss/.html/.vue/.svelte → frontend
 * - .ts/.js (non-test, non-config) → backend
 * - .test.ts/.spec.ts → testing
 * - Dockerfile/.dockerignore → devops
 * - .sql/prisma/drizzle → database
 *
 * Returns the set of domain names that have affected files.
 */
export function affectedDomains(changedFiles: string[]): Set<string> {
  const domains = new Set<string>()

  for (const file of changedFiles) {
    const lower = file.toLowerCase()

    // Frontend indicators
    if (
      lower.endsWith('.tsx') ||
      lower.endsWith('.jsx') ||
      lower.endsWith('.css') ||
      lower.endsWith('.scss') ||
      lower.endsWith('.vue') ||
      lower.endsWith('.svelte') ||
      lower.includes('/components/') ||
      lower.includes('/pages/') ||
      lower.includes('/app/')
    ) {
      domains.add('frontend')
      domains.add('uxui')
    }

    // Testing indicators
    if (
      lower.includes('.test.') ||
      lower.includes('.spec.') ||
      lower.includes('__tests__') ||
      lower.includes('/test/')
    ) {
      domains.add('testing')
    }

    // DevOps indicators
    if (
      lower.includes('dockerfile') ||
      lower.includes('docker-compose') ||
      lower.includes('.dockerignore') ||
      lower.includes('.github/') ||
      lower.includes('ci/') ||
      lower.includes('cd/')
    ) {
      domains.add('devops')
    }

    // Database indicators
    if (
      lower.endsWith('.sql') ||
      lower.includes('prisma') ||
      lower.includes('drizzle') ||
      lower.includes('migration') ||
      lower.includes('/db/')
    ) {
      domains.add('database')
    }

    // Backend indicators (TypeScript/JavaScript that isn't clearly frontend/test)
    if (
      (lower.endsWith('.ts') || lower.endsWith('.js')) &&
      !lower.includes('.test.') &&
      !lower.includes('.spec.') &&
      !lower.endsWith('.d.ts')
    ) {
      domains.add('backend')
    }
  }

  return domains
}
