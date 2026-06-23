import os from 'node:os'
import path from 'node:path'

/**
 * Resolve the interactive user's home directory per call.
 *
 * Bun and Node can keep os.homedir() tied to the process launch environment,
 * while tests and sandboxed installs often set HOME/USERPROFILE after import.
 * Agent config paths must honor those overrides without freezing at module load.
 */
export function resolveUserHome(): string {
  const override = process.env.HOME?.trim() || process.env.USERPROFILE?.trim()
  return override ? path.resolve(override) : os.homedir()
}

export function resolveUserPath(...segments: string[]): string {
  return path.join(resolveUserHome(), ...segments)
}
