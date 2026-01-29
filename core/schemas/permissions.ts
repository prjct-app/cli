/**
 * Permissions Schema
 *
 * Defines granular permission controls for bash commands and file operations.
 * Inspired by opencode's glob-based permission system.
 *
 * @version 1.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

/** Permission level for an action */
export const PermissionLevelSchema = z.enum(['allow', 'deny', 'ask'])

/** File operation types */
export const FileOperationSchema = z.enum(['read', 'write', 'delete', 'create'])

/** Bash command permission entry - glob pattern to permission level */
export const BashPermissionSchema = z.record(z.string(), PermissionLevelSchema)

/** File permission entry - glob pattern to permission level */
export const FilePermissionSchema = z.record(z.string(), PermissionLevelSchema)

/** Web fetch permission */
export const WebPermissionSchema = z.object({
  enabled: z.boolean().default(true),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
})

/** Complete permissions configuration */
export const PermissionsConfigSchema = z.object({
  /** Bash command permissions - glob patterns */
  bash: BashPermissionSchema.optional(),

  /** File operation permissions - glob patterns */
  files: z
    .object({
      read: FilePermissionSchema.optional(),
      write: FilePermissionSchema.optional(),
      delete: FilePermissionSchema.optional(),
    })
    .optional(),

  /** Web fetch permissions */
  web: WebPermissionSchema.optional(),

  /** Skill invocation permissions */
  skills: z.record(z.string(), PermissionLevelSchema).optional(),

  /** Doom loop protection - prevent infinite retries */
  doomLoop: z
    .object({
      enabled: z.boolean().default(true),
      maxRetries: z.number().default(3),
    })
    .optional(),

  /** External directory access */
  externalDirectories: PermissionLevelSchema.default('ask'),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type PermissionLevel = z.infer<typeof PermissionLevelSchema>
export type FileOperation = z.infer<typeof FileOperationSchema>
export type BashPermission = z.infer<typeof BashPermissionSchema>
export type FilePermission = z.infer<typeof FilePermissionSchema>
export type WebPermission = z.infer<typeof WebPermissionSchema>
export type PermissionsConfig = z.infer<typeof PermissionsConfigSchema>

// =============================================================================
// Default Permission Presets
// =============================================================================

/** Default safe bash patterns - always allowed */
export const DEFAULT_BASH_ALLOW: string[] = [
  'git status*',
  'git log*',
  'git diff*',
  'git branch*',
  'git remote*',
  'ls*',
  'pwd',
  'cat*',
  'head*',
  'tail*',
  'grep*',
  'find*',
  'which*',
  'echo*',
  'node -e*',
  'bun -e*',
  'npm list*',
  'npm view*',
  'npx tsc --noEmit*',
]

/** Dangerous bash patterns - always ask */
export const DEFAULT_BASH_ASK: string[] = [
  'rm -rf*',
  'rm -r*',
  'git push*',
  'git reset --hard*',
  'git clean*',
  'npm publish*',
  'chmod*',
  'chown*',
  'sudo*',
  'curl*|*sh',
  'wget*|*sh',
]

/** Dangerous bash patterns - always deny */
export const DEFAULT_BASH_DENY: string[] = [
  'rm -rf /*',
  'rm -rf ~/*',
  ':(){ :|:& };:*', // Fork bomb
  'mkfs*',
  'dd if=*of=/dev/*',
]

/** Build default permissions config */
export function buildDefaultPermissions(): PermissionsConfig {
  const bash: BashPermission = {}

  // Add allow patterns
  for (const pattern of DEFAULT_BASH_ALLOW) {
    bash[pattern] = 'allow'
  }

  // Add ask patterns
  for (const pattern of DEFAULT_BASH_ASK) {
    bash[pattern] = 'ask'
  }

  // Add deny patterns
  for (const pattern of DEFAULT_BASH_DENY) {
    bash[pattern] = 'deny'
  }

  return {
    bash,
    files: {
      read: { '**/*': 'allow' },
      write: { '**/*': 'allow' },
      delete: { '**/*': 'ask' },
    },
    web: {
      enabled: true,
    },
    doomLoop: {
      enabled: true,
      maxRetries: 3,
    },
    externalDirectories: 'ask',
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate permissions config */
export const parsePermissions = (data: unknown): PermissionsConfig =>
  PermissionsConfigSchema.parse(data)

export const safeParsePermissions = (data: unknown) => PermissionsConfigSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_PERMISSIONS: PermissionsConfig = buildDefaultPermissions()
