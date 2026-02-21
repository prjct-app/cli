/**
 * PermissionManager - Granular permission control for CLI operations
 *
 * Implements glob-based permission matching inspired by opencode.
 * Checks bash commands, file operations, and web access against
 * configurable permission rules.
 *
 * @version 1.0.0
 */

import {
  buildDefaultPermissions,
  type PermissionLevel,
  type PermissionsConfig,
} from '../schemas/permissions'
import type { PermissionCheckResult } from '../types/infrastructure'

/**
 * Simple glob pattern matching
 * Supports * (any chars) and ? (single char)
 */
function matchGlobPattern(pattern: string, text: string): boolean {
  // Escape regex special chars except * and ?
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(text)
}

/**
 * Find the most specific matching pattern
 * More specific = longer pattern without wildcards
 */
function findBestMatch(
  patterns: Record<string, PermissionLevel>,
  text: string
): { pattern: string; level: PermissionLevel } | null {
  let bestMatch: { pattern: string; level: PermissionLevel; specificity: number } | null = null

  for (const [pattern, level] of Object.entries(patterns)) {
    if (matchGlobPattern(pattern, text)) {
      // Calculate specificity: longer patterns without wildcards are more specific
      const wildcardCount = (pattern.match(/\*/g) || []).length
      const specificity = pattern.length - wildcardCount * 10

      if (!bestMatch || specificity > bestMatch.specificity) {
        bestMatch = { pattern, level, specificity }
      }
    }
  }

  return bestMatch ? { pattern: bestMatch.pattern, level: bestMatch.level } : null
}

class PermissionManager {
  private config: PermissionsConfig

  constructor(config?: PermissionsConfig) {
    this.config = config || buildDefaultPermissions()
  }

  /**
   * Update the permissions configuration
   */
  setConfig(config: PermissionsConfig): void {
    this.config = config
  }

  /**
   * Merge custom permissions with defaults
   */
  mergeWithDefaults(custom: Partial<PermissionsConfig>): PermissionsConfig {
    const defaults = buildDefaultPermissions()
    return {
      ...defaults,
      ...custom,
      bash: { ...defaults.bash, ...custom.bash },
      files: {
        read: { ...defaults.files?.read, ...custom.files?.read },
        write: { ...defaults.files?.write, ...custom.files?.write },
        delete: { ...defaults.files?.delete, ...custom.files?.delete },
      },
      web: {
        enabled: custom.web?.enabled ?? defaults.web?.enabled ?? true,
        allowedDomains: custom.web?.allowedDomains ?? defaults.web?.allowedDomains,
        blockedDomains: custom.web?.blockedDomains ?? defaults.web?.blockedDomains,
      },
      doomLoop: {
        enabled: custom.doomLoop?.enabled ?? defaults.doomLoop?.enabled ?? true,
        maxRetries: custom.doomLoop?.maxRetries ?? defaults.doomLoop?.maxRetries ?? 3,
      },
    }
  }

  /**
   * Check if a bash command is allowed
   */
  checkBashCommand(command: string): PermissionCheckResult {
    if (!this.config.bash) {
      return { allowed: true, level: 'allow', reason: 'No bash permissions configured' }
    }

    const match = findBestMatch(this.config.bash, command)

    if (!match) {
      // Default: allow if no pattern matches
      return { allowed: true, level: 'allow', reason: 'No matching pattern' }
    }

    return {
      allowed: match.level === 'allow',
      level: match.level,
      matchedPattern: match.pattern,
      reason:
        match.level === 'deny'
          ? `Command denied by pattern: ${match.pattern}`
          : match.level === 'ask'
            ? `Command requires approval: ${match.pattern}`
            : undefined,
    }
  }

  /**
   * Check if a file operation is allowed
   */
  checkFileOperation(
    operation: 'read' | 'write' | 'delete',
    filePath: string
  ): PermissionCheckResult {
    const filePerms = this.config.files?.[operation]

    if (!filePerms) {
      return { allowed: true, level: 'allow', reason: 'No file permissions configured' }
    }

    const match = findBestMatch(filePerms, filePath)

    if (!match) {
      return { allowed: true, level: 'allow', reason: 'No matching pattern' }
    }

    return {
      allowed: match.level === 'allow',
      level: match.level,
      matchedPattern: match.pattern,
      reason:
        match.level === 'deny'
          ? `File operation denied: ${operation} on ${match.pattern}`
          : match.level === 'ask'
            ? `File operation requires approval: ${operation}`
            : undefined,
    }
  }

  /**
   * Check if web fetch is allowed for a domain
   */
  checkWebFetch(url: string): PermissionCheckResult {
    const webConfig = this.config.web

    if (!webConfig?.enabled) {
      return {
        allowed: false,
        level: 'deny',
        reason: 'Web fetch is disabled',
      }
    }

    try {
      const domain = new URL(url).hostname

      // Check blocked domains
      if (webConfig.blockedDomains?.some((d) => domain.includes(d))) {
        return {
          allowed: false,
          level: 'deny',
          matchedPattern: domain,
          reason: `Domain is blocked: ${domain}`,
        }
      }

      // Check allowed domains (if specified, only those are allowed)
      if (webConfig.allowedDomains && webConfig.allowedDomains.length > 0) {
        const isAllowed = webConfig.allowedDomains.some((d) => domain.includes(d))
        if (!isAllowed) {
          return {
            allowed: false,
            level: 'deny',
            matchedPattern: domain,
            reason: `Domain not in allowed list: ${domain}`,
          }
        }
      }

      return { allowed: true, level: 'allow' }
    } catch (_error) {
      return {
        allowed: false,
        level: 'deny',
        reason: 'Invalid URL',
      }
    }
  }

  /**
   * Check if a skill can be invoked
   */
  checkSkill(skillName: string): PermissionCheckResult {
    if (!this.config.skills) {
      return { allowed: true, level: 'allow', reason: 'No skill permissions configured' }
    }

    const match = findBestMatch(this.config.skills, skillName)

    if (!match) {
      return { allowed: true, level: 'allow', reason: 'No matching pattern' }
    }

    return {
      allowed: match.level === 'allow',
      level: match.level,
      matchedPattern: match.pattern,
    }
  }

  /**
   * Check if external directory access is allowed
   */
  checkExternalDirectory(path: string, projectRoot: string): PermissionCheckResult {
    const isExternal = !path.startsWith(projectRoot)

    if (!isExternal) {
      return { allowed: true, level: 'allow', reason: 'Path is within project' }
    }

    const level = this.config.externalDirectories || 'ask'

    return {
      allowed: level === 'allow',
      level,
      reason:
        level === 'deny'
          ? 'External directory access denied'
          : level === 'ask'
            ? 'External directory access requires approval'
            : undefined,
    }
  }

  /**
   * Get current permissions config
   */
  getConfig(): PermissionsConfig {
    return this.config
  }

  /**
   * Check doom loop protection
   */
  checkDoomLoop(retryCount: number): PermissionCheckResult {
    const doomLoop = this.config.doomLoop

    if (!doomLoop?.enabled) {
      return { allowed: true, level: 'allow', reason: 'Doom loop protection disabled' }
    }

    const maxRetries = doomLoop.maxRetries || 3

    if (retryCount >= maxRetries) {
      return {
        allowed: false,
        level: 'deny',
        reason: `Doom loop detected: ${retryCount} retries exceeded limit of ${maxRetries}`,
      }
    }

    return { allowed: true, level: 'allow' }
  }
}

// Singleton instance
const permissionManager = new PermissionManager()
export default permissionManager

// Export class for testing
export { PermissionManager }
