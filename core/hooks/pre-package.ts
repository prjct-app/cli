/**
 * PreToolUse package legitimacy — SUPERIOR to ship-only slopcheck.
 *
 * When the agent runs npm/pnpm/yarn/bun add|install <pkgs>, flag packages
 * not already in package.json BEFORE the install runs. Strict packs DENY;
 * advisory packs inject context (warn). Fail-open on parse/IO errors.
 */

import configManager from '../infrastructure/config-manager'
import {
  loadKnownDependencyNames,
  parsePackageInstallCommand,
} from '../services/package-legitimacy'
import { evaluatePackageInstallTrust } from '../services/trust-boundary'
import { type HookIo, runHook } from './_runner'

interface HookInput {
  tool_name?: string
  tool_input?: unknown
  toolInput?: unknown
  command?: string
  [key: string]: unknown
}

function extractCommand(input: HookInput): string {
  const ti = (input.tool_input ?? input.toolInput) as Record<string, unknown> | undefined
  if (ti && typeof ti.command === 'string') return ti.command
  if (typeof input.command === 'string') return input.command
  if (ti && typeof ti.command_line === 'string') return ti.command_line as string
  return ''
}

function isStrictPackageMode(
  config: Awaited<ReturnType<typeof configManager.readConfig>>
): boolean {
  if (!config) return false
  return (
    config.sdd?.mode === 'strict' ||
    config.tdd?.mode === 'strict' ||
    config.deliveryGeometry?.mode === 'strict'
  )
}

export function runPrePackageHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PreToolUse',
      projectPath,
      decide: async (input) => {
        try {
          const cmd = extractCommand(input)
          const parsed = parsePackageInstallCommand(cmd)
          if (!parsed) return null

          const known = await loadKnownDependencyNames(projectPath)
          const verdict = evaluatePackageInstallTrust(parsed.packages, known)
          if (verdict.allow) return null

          const config = await configManager.readConfig(projectPath).catch(() => null)
          if (!isStrictPackageMode(config)) return null
          return { deny: verdict.denyMessage }
        } catch {
          return null
        }
      },
      build: async (input) => {
        try {
          const cmd = extractCommand(input)
          const parsed = parsePackageInstallCommand(cmd)
          if (!parsed) return null
          const known = await loadKnownDependencyNames(projectPath)
          const verdict = evaluatePackageInstallTrust(parsed.packages, known)
          if (verdict.allow) return null
          const config = await configManager.readConfig(projectPath).catch(() => null)
          if (isStrictPackageMode(config)) return null
          const msg = verdict.decision?.message ?? verdict.denyMessage
          return `# prjct: package legitimacy (advisory)\n${msg}`
        } catch {
          return null
        }
      },
    },
    io
  )
}
