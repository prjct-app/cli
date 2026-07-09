/**
 * Package legitimacy gate — steal GSD slopcheck intent without a new verb:
 * when package.json gains dependencies, surface a structured risk before ship.
 *
 * Precision over recall: only flags *new* dep names not previously in
 * package.json history (git show HEAD:package.json). Never auto-installs
 * alternatives (anti-slopsquatting). Strict packs can block ship.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileAsync } from '../utils/exec'

export interface PackageLegitimacyResult {
  newDependencies: string[]
  /** True when any new dep was introduced vs HEAD. */
  risky: boolean
  message: string | null
}

interface PkgJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function depNames(pkg: PkgJson | null): Set<string> {
  const out = new Set<string>()
  if (!pkg) return out
  for (const key of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const block = pkg[key]
    if (block) for (const name of Object.keys(block)) out.add(name)
  }
  return out
}

async function readJsonFile(file: string): Promise<PkgJson | null> {
  try {
    const raw = await readFile(file, 'utf-8')
    return JSON.parse(raw) as PkgJson
  } catch {
    return null
  }
}

async function headPackageJson(projectPath: string): Promise<PkgJson | null> {
  try {
    const { stdout } = await execFileAsync('git', ['show', 'HEAD:package.json'], {
      cwd: projectPath,
    })
    return JSON.parse(stdout) as PkgJson
  } catch {
    return null
  }
}

/**
 * Compare working-tree package.json to HEAD. No git / no package.json → clean.
 */
export async function checkPackageLegitimacy(
  projectPath: string
): Promise<PackageLegitimacyResult> {
  const pkgPath = path.join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) {
    return { newDependencies: [], risky: false, message: null }
  }
  if (!existsSync(path.join(projectPath, '.git'))) {
    return { newDependencies: [], risky: false, message: null }
  }

  const current = await readJsonFile(pkgPath)
  const baseline = await headPackageJson(projectPath)
  const now = depNames(current)
  const before = depNames(baseline)
  const added = [...now].filter((n) => !before.has(n)).sort()

  if (added.length === 0) {
    return { newDependencies: [], risky: false, message: null }
  }

  return {
    newDependencies: added,
    risky: true,
    message: [
      `Package legitimacy: ${added.length} new dependenc${added.length === 1 ? 'y' : 'ies'} vs HEAD:`,
      ...added.map((n) => `  - ${n}`),
      'Verify each on the registry (age, downloads, source). Do not substitute similar names.',
      'Strict packs block ship until you confirm or revert. (Dominance vs GSD slopcheck.)',
    ].join('\n'),
  }
}
