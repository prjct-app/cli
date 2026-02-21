/**
 * Skill Installer Service
 *
 * Installs skills from remote sources (GitHub repos, local paths).
 * Follows the ecosystem standard of {name}/SKILL.md subdirectory format.
 *
 * Supported sources:
 * - owner/repo — clone from GitHub, discover all SKILL.md files
 * - owner/repo@skill-name — install specific skill from repo
 * - ./local-path — install from local directory
 *
 * Uses graceful degradation for git availability (PRJ-114).
 *
 * @version 1.1.0
 */

import { exec as execCallback } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { glob } from 'glob'
import { getErrorMessage } from '../types/fs'
import type {
  InstalledSkill,
  InstallResult,
  ParsedSource,
  SkillLockEntry,
} from '../types/services.js'
import { getTimeout } from '../utils/constants'
import { dependencyValidator } from './dependency-validator'
import { skillLock } from './skill-lock'

const exec = promisify(execCallback)

// =============================================================================
// Source Parsing
// =============================================================================

/**
 * Parse a source string into a structured source object
 *
 * Formats:
 * - "owner/repo" → GitHub repo, install all skills
 * - "owner/repo@skill-name" → GitHub repo, specific skill
 * - "./path" or "/path" → Local directory
 */
export function parseSource(source: string): ParsedSource {
  // Local path
  if (source.startsWith('./') || source.startsWith('/') || source.startsWith('~')) {
    const resolvedPath = source.startsWith('~')
      ? path.join(os.homedir(), source.slice(1))
      : path.resolve(source)
    return {
      type: 'local',
      localPath: resolvedPath,
      url: resolvedPath,
    }
  }

  // GitHub: owner/repo@skill-name
  const atIndex = source.indexOf('@')
  if (atIndex > 0) {
    const repoPath = source.slice(0, atIndex)
    const skillName = source.slice(atIndex + 1)
    const [owner, repo] = repoPath.split('/')
    if (owner && repo) {
      return {
        type: 'github',
        owner,
        repo,
        skillName,
        url: `https://github.com/${owner}/${repo}`,
      }
    }
  }

  // GitHub: owner/repo
  const parts = source.split('/')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      type: 'github',
      owner: parts[0],
      repo: parts[1],
      url: `https://github.com/${parts[0]}/${parts[1]}`,
    }
  }

  throw new Error(
    `Invalid source format: "${source}". Expected "owner/repo", "owner/repo@skill-name", or "./local-path"`
  )
}

// =============================================================================
// Skill Discovery
// =============================================================================

/**
 * Discover skills in a directory by scanning for SKILL.md files
 */
async function discoverSkills(dir: string): Promise<Array<{ name: string; filePath: string }>> {
  const skills: Array<{ name: string; filePath: string }> = []

  // Pattern 1: {dir}/SKILL.md (root-level skill)
  try {
    const rootSkill = path.join(dir, 'SKILL.md')
    await fs.access(rootSkill)
    const dirName = path.basename(dir)
    skills.push({ name: dirName, filePath: rootSkill })
  } catch {
    // No root SKILL.md
  }

  // Pattern 2: {dir}/*/SKILL.md (subdirectory skills)
  const subdirSkills = await glob('*/SKILL.md', { cwd: dir, absolute: true })
  for (const filePath of subdirSkills) {
    const name = path.basename(path.dirname(filePath))
    // Avoid duplicate if already found as root
    if (!skills.some((s) => s.name === name)) {
      skills.push({ name, filePath })
    }
  }

  // Pattern 3: {dir}/skills/*/SKILL.md (nested skills directory)
  const nestedSkills = await glob('skills/*/SKILL.md', { cwd: dir, absolute: true })
  for (const filePath of nestedSkills) {
    const name = path.basename(path.dirname(filePath))
    if (!skills.some((s) => s.name === name)) {
      skills.push({ name, filePath })
    }
  }

  return skills
}

// =============================================================================
// Frontmatter Injection
// =============================================================================

/**
 * Add _prjct source tracking metadata to a skill's frontmatter
 */
function injectSourceMetadata(content: string, source: ParsedSource, sha?: string): string {
  const now = new Date().toISOString()
  const prjctBlock = [
    `_prjct:`,
    `  sourceUrl: ${source.url}`,
    `  sourceType: ${source.type}`,
    `  installedAt: ${now}`,
  ]
  if (sha) {
    prjctBlock.push(`  sha: ${sha}`)
  }

  // Check if file has existing frontmatter
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)

  if (match) {
    // Remove existing _prjct block if present
    let frontmatter = match[1]
    frontmatter = frontmatter.replace(/\n?_prjct:[\s\S]*?(?=\n[a-zA-Z]|\n---|\s*$)/g, '')

    // Append _prjct block
    const updatedFrontmatter = `${frontmatter.trimEnd()}\n${prjctBlock.join('\n')}`
    return content.replace(frontmatterRegex, `---\n${updatedFrontmatter}\n---`)
  }

  // No frontmatter — add one
  return `---\n${prjctBlock.join('\n')}\n---\n\n${content}`
}

// =============================================================================
// Installation
// =============================================================================

/**
 * Get the default install directory for skills
 */
function getInstallDir(): string {
  return path.join(os.homedir(), '.claude', 'skills')
}

/**
 * Install a single skill file to the target directory
 */
async function installSkillFile(
  sourcePath: string,
  name: string,
  source: ParsedSource,
  sha?: string
): Promise<InstalledSkill> {
  const installDir = getInstallDir()
  const targetDir = path.join(installDir, name)
  const targetPath = path.join(targetDir, 'SKILL.md')

  // Read source content
  const content = await fs.readFile(sourcePath, 'utf-8')

  // Inject source metadata
  const enrichedContent = injectSourceMetadata(content, source, sha)

  // Write to target (ecosystem standard: {name}/SKILL.md)
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(targetPath, enrichedContent, 'utf-8')

  return {
    name,
    filePath: targetPath,
    source,
    sha,
  }
}

/**
 * Install skills from a GitHub repository
 * PRJ-114: Checks git availability with graceful error handling
 */
async function installFromGitHub(source: ParsedSource): Promise<InstallResult> {
  const result: InstallResult = { installed: [], skipped: [], errors: [] }

  // PRJ-114: Check git availability before attempting clone
  if (!dependencyValidator.isAvailable('git')) {
    const gitStatus = dependencyValidator.checkTool('git')
    result.errors.push(
      `Cannot install from GitHub: git is not available. ${gitStatus.error?.hint || 'Install git and try again.'}`
    )
    return result
  }

  // Create temp directory
  const tmpDir = path.join(os.tmpdir(), `prjct-skill-${Date.now()}`)

  try {
    // Clone with depth 1 for speed
    // PRJ-111: Configurable timeout (default: 60s, override via PRJCT_TIMEOUT_GIT_CLONE)
    const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`
    await exec(`git clone --depth 1 ${cloneUrl} ${tmpDir}`, { timeout: getTimeout('GIT_CLONE') })

    // Get the commit SHA
    let sha: string | undefined
    try {
      const { stdout } = await exec('git rev-parse HEAD', {
        cwd: tmpDir,
        timeout: getTimeout('TOOL_CHECK'),
      })
      sha = stdout.trim()
    } catch {
      // Non-critical
    }

    // Discover skills in the cloned repo
    const discoveredSkills = await discoverSkills(tmpDir)

    if (discoveredSkills.length === 0) {
      result.errors.push(`No SKILL.md files found in ${source.owner}/${source.repo}`)
      return result
    }

    // Filter to specific skill if requested
    const skillsToInstall = source.skillName
      ? discoveredSkills.filter((s) => s.name === source.skillName)
      : discoveredSkills

    if (source.skillName && skillsToInstall.length === 0) {
      result.errors.push(`Skill "${source.skillName}" not found in ${source.owner}/${source.repo}`)
      return result
    }

    // Install each skill
    for (const skill of skillsToInstall) {
      try {
        const installed = await installSkillFile(skill.filePath, skill.name, source, sha)

        // Update lock file
        const lockEntry: SkillLockEntry = {
          name: skill.name,
          source: {
            type: 'github',
            url: `${source.owner}/${source.repo}`,
            sha,
          },
          installedAt: new Date().toISOString(),
          filePath: installed.filePath,
        }
        await skillLock.addEntry(lockEntry)

        result.installed.push(installed)
      } catch (error) {
        result.errors.push(`Failed to install ${skill.name}: ${getErrorMessage(error)}`)
      }
    }
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // Best effort cleanup
    }
  }

  return result
}

/**
 * Install skills from a local directory
 */
async function installFromLocal(source: ParsedSource): Promise<InstallResult> {
  const result: InstallResult = { installed: [], skipped: [], errors: [] }
  const localPath = source.localPath!

  try {
    await fs.access(localPath)
  } catch {
    result.errors.push(`Local path not found: ${localPath}`)
    return result
  }

  const stat = await fs.stat(localPath)

  if (stat.isFile()) {
    // Single SKILL.md file
    const name = path.basename(path.dirname(localPath))
    try {
      const installed = await installSkillFile(localPath, name, source)
      const lockEntry: SkillLockEntry = {
        name,
        source: { type: 'local', url: localPath },
        installedAt: new Date().toISOString(),
        filePath: installed.filePath,
      }
      await skillLock.addEntry(lockEntry)
      result.installed.push(installed)
    } catch (error) {
      result.errors.push(`Failed to install from ${localPath}: ${getErrorMessage(error)}`)
    }
  } else {
    // Directory — discover skills
    const discoveredSkills = await discoverSkills(localPath)

    if (discoveredSkills.length === 0) {
      result.errors.push(`No SKILL.md files found in ${localPath}`)
      return result
    }

    for (const skill of discoveredSkills) {
      try {
        const installed = await installSkillFile(skill.filePath, skill.name, source)
        const lockEntry: SkillLockEntry = {
          name: skill.name,
          source: { type: 'local', url: localPath },
          installedAt: new Date().toISOString(),
          filePath: installed.filePath,
        }
        await skillLock.addEntry(lockEntry)
        result.installed.push(installed)
      } catch (error) {
        result.errors.push(`Failed to install ${skill.name}: ${getErrorMessage(error)}`)
      }
    }
  }

  return result
}

/**
 * Remove an installed skill
 */
async function remove(name: string): Promise<boolean> {
  const installDir = getInstallDir()

  // Remove subdirectory format
  const subdirPath = path.join(installDir, name)
  try {
    await fs.rm(subdirPath, { recursive: true, force: true })
  } catch {
    // May not exist in subdir format
  }

  // Remove flat file format
  const flatPath = path.join(installDir, `${name}.md`)
  try {
    await fs.rm(flatPath, { force: true })
  } catch {
    // May not exist in flat format
  }

  // Remove from lock file
  return skillLock.removeEntry(name)
}

// =============================================================================
// Main Install Function
// =============================================================================

/**
 * Install skills from a source string
 *
 * @param source - Source string (e.g., "owner/repo", "owner/repo@skill", "./path")
 * @returns Installation result with installed, skipped, and error lists
 */
async function install(sourceStr: string): Promise<InstallResult> {
  const source = parseSource(sourceStr)

  switch (source.type) {
    case 'github':
      return installFromGitHub(source)
    case 'local':
      return installFromLocal(source)
    default:
      return {
        installed: [],
        skipped: [],
        errors: [`Unsupported source type: ${source.type}`],
      }
  }
}

export const skillInstaller = {
  install,
  remove,
  parseSource,
  getInstallDir,
}

export default skillInstaller
