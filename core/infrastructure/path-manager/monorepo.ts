/**
 * Monorepo detection + package discovery.
 *
 * Pure async functions consumed by the PathManager facade. Supports
 * pnpm, lerna, nx, rush, turborepo, plus npm/yarn `workspaces`.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { globSync } from 'glob'
import type { MonorepoInfo, MonorepoPackage } from '../../types/infrastructure'
import * as fileHelper from '../../utils/file-helper'

export async function detectMonorepo(projectPath: string): Promise<MonorepoInfo> {
  const result: MonorepoInfo = {
    isMonorepo: false,
    type: null,
    rootPath: projectPath,
    packages: [],
  }

  const checks = [
    { file: 'pnpm-workspace.yaml', type: 'pnpm' as const },
    { file: 'lerna.json', type: 'lerna' as const },
    { file: 'nx.json', type: 'nx' as const },
    { file: 'rush.json', type: 'rush' as const },
    { file: 'turbo.json', type: 'turborepo' as const },
  ]

  for (const check of checks) {
    if (await fileHelper.fileExists(path.join(projectPath, check.file))) {
      result.isMonorepo = true
      result.type = check.type
      break
    }
  }

  // Check package.json for workspaces (npm/yarn)
  if (!result.isMonorepo) {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (await fileHelper.fileExists(packageJsonPath)) {
      try {
        const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
        if (pkg.workspaces) {
          result.isMonorepo = true
          result.type = 'npm' // Could be yarn too, but npm is more generic
        }
      } catch {
        // Invalid package.json, ignore
      }
    }
  }

  if (result.isMonorepo) {
    result.packages = await discoverMonorepoPackages(projectPath, result.type)
  }

  return result
}

export async function discoverMonorepoPackages(
  rootPath: string,
  type: MonorepoInfo['type']
): Promise<MonorepoPackage[]> {
  const packages: MonorepoPackage[] = []
  let patterns: string[] = []

  try {
    if (type === 'pnpm') {
      const yaml = await fs.readFile(path.join(rootPath, 'pnpm-workspace.yaml'), 'utf-8')
      const match = yaml.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/)
      if (match) {
        patterns = match[1]
          .split('\n')
          .map((line) => line.replace(/^\s*-\s*['"]?|['"]?\s*$/g, ''))
          .filter(Boolean)
      }
    } else if (type === 'npm' || type === 'lerna') {
      const packageJsonPath = path.join(rootPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      if (Array.isArray(pkg.workspaces)) patterns = pkg.workspaces
      else if (pkg.workspaces?.packages) patterns = pkg.workspaces.packages

      if (type === 'lerna') {
        const lernaPath = path.join(rootPath, 'lerna.json')
        if (await fileHelper.fileExists(lernaPath)) {
          const lerna = JSON.parse(await fs.readFile(lernaPath, 'utf-8'))
          if (lerna.packages) patterns = lerna.packages
        }
      }
    } else if (type === 'nx') {
      patterns = ['apps/*', 'libs/*', 'packages/*']
    } else if (type === 'turborepo') {
      const packageJsonPath = path.join(rootPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      if (Array.isArray(pkg.workspaces)) patterns = pkg.workspaces
    }

    if (patterns.length === 0) {
      patterns = ['packages/*', 'apps/*', 'libs/*']
    }

    for (const pattern of patterns) {
      if (pattern.startsWith('!')) continue

      const matches = globSync(pattern, { cwd: rootPath, absolute: false })

      for (const match of matches) {
        const packagePath = path.join(rootPath, match)
        const packageJsonPath = path.join(packagePath, 'package.json')

        if (await fileHelper.fileExists(packageJsonPath)) {
          try {
            const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
            const prjctMdPath = path.join(packagePath, 'PRJCT.md')

            packages.push({
              name: pkg.name || path.basename(match),
              path: packagePath,
              relativePath: match,
              hasPrjctMd: await fileHelper.fileExists(prjctMdPath),
            })
          } catch {
            // Invalid package.json, skip
          }
        }
      }
    }
  } catch {
    // Error reading monorepo config, return empty
  }

  return packages
}

export async function findContainingPackage(
  currentPath: string,
  monoInfo: MonorepoInfo
): Promise<MonorepoPackage | null> {
  if (!monoInfo.isMonorepo) return null

  const normalizedCurrent = path.resolve(currentPath)

  for (const pkg of monoInfo.packages) {
    const normalizedPkg = path.resolve(pkg.path)
    if (normalizedCurrent.startsWith(normalizedPkg)) return pkg
  }

  return null
}

export async function findMonorepoRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath)
  const root = path.parse(currentPath).root

  while (currentPath !== root) {
    const monoInfo = await detectMonorepo(currentPath)
    if (monoInfo.isMonorepo) return currentPath
    currentPath = path.dirname(currentPath)
  }

  return null
}
