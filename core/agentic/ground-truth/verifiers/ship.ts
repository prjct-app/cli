/**
 * Ship Command Verifier
 * Verify feature is ready to ship
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import type { Context, VerificationResult } from '../types'
import { escapeRegex } from '../utils'

export async function verifyShip(context: Context): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check for uncommitted changes
  try {
    const gitStatus = execSync('git status --porcelain', {
      cwd: context.projectPath,
      encoding: 'utf-8',
    })
    actual.hasUncommittedChanges = gitStatus.trim().length > 0
    actual.uncommittedFiles = gitStatus.trim().split('\n').filter(Boolean).length

    if (actual.hasUncommittedChanges) {
      warnings.push(`${actual.uncommittedFiles} uncommitted file(s)`)
      recommendations.push('Commit changes before shipping')
    }
  } catch {
    actual.gitAvailable = false
    // Not a git repo or git not available - not a blocker
  }

  // 2. Check for package.json version (if exists)
  const pkgPath = path.join(context.projectPath, 'package.json')
  try {
    const pkgContent = await fs.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(pkgContent)
    actual.currentVersion = pkg.version
    actual.hasPackageJson = true
  } catch {
    actual.hasPackageJson = false
  }

  // 3. Check shipped.md for duplicate feature names
  const shippedPath = context.paths.shipped
  try {
    const shippedContent = await fs.readFile(shippedPath, 'utf-8')
    actual.shippedExists = true

    // Check if feature name already shipped today
    const featureName = context.params.feature || context.params.description
    if (featureName) {
      const today = new Date().toISOString().split('T')[0]
      const todayPattern = new RegExp(`${today}.*${escapeRegex(featureName)}`, 'i')
      if (todayPattern.test(shippedContent)) {
        warnings.push(`Feature "${featureName}" already shipped today`)
        recommendations.push('Use a different feature name or skip /p:ship')
      }
    }
  } catch {
    actual.shippedExists = false
  }

  // 4. Check for test failures (if test script exists)
  if (actual.hasPackageJson) {
    try {
      const pkgContent = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent)
      actual.hasTestScript = !!pkg.scripts?.test
      // Note: We don't run tests here, just check if they exist
      // Running tests is the user's responsibility
    } catch {
      actual.hasTestScript = false
    }
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}
