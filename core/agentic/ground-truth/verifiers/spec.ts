/**
 * Spec Command Verifier
 * Verify spec can be created
 */

import fs from 'fs/promises'
import type { Context, VerificationResult } from '../types'

export async function verifySpec(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check specs directory exists
  const specsPath = context.paths.specs
  try {
    await fs.access(specsPath)
    actual.specsExists = true

    // List existing specs
    const files = await fs.readdir(specsPath)
    actual.existingSpecs = files.filter((f) => f.endsWith('.md'))
    actual.specCount = (actual.existingSpecs as string[]).length
  } catch {
    actual.specsExists = false
    actual.specCount = 0
  }

  // 2. Check for duplicate spec name
  const featureName = context.params.feature || context.params.name || context.params.description
  if (featureName && actual.existingSpecs) {
    const slug = featureName.toLowerCase().replace(/\s+/g, '-')
    if ((actual.existingSpecs as string[]).includes(`${slug}.md`)) {
      warnings.push(`Spec "${featureName}" already exists`)
      recommendations.push('Use a different name or edit existing spec')
    }
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
