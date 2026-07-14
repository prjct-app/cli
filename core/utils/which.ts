/**
 * Cross-platform "is this command on PATH?" helpers.
 *
 * Windows has no POSIX `which` / `command -v`. Use `where.exe` there.
 * Unix uses `which` with a soft fallback to `command -v` via /bin/sh.
 *
 * Always returns the PATH-winning path (first hit), never throws.
 */

import { execFileSync } from 'node:child_process'
import { execFileAsync } from './exec'

function firstNonEmptyLine(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim()
    if (t) return t
  }
  return null
}

/** Synchronous resolve of the PATH-winning binary, or null. */
export function whichSync(command: string): string | null {
  if (!command || command.includes('\0')) return null

  try {
    if (process.platform === 'win32') {
      // where.exe prints one path per line; first is PATH winner.
      const stdout = execFileSync('where.exe', [command], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      })
      return firstNonEmptyLine(stdout)
    }

    try {
      const stdout = execFileSync('which', [command], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return firstNonEmptyLine(stdout)
    } catch {
      // Busybox / stripped PATH: `command -v` via /bin/sh -c with a single
      // argv payload. JSON.stringify keeps the token shell-safe (no injection).
      // Prefer execFile over execSync({shell}) so we never inherit a free-form shell.
      const stdout = execFileSync('/bin/sh', ['-c', `command -v ${JSON.stringify(command)}`], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return firstNonEmptyLine(stdout)
    }
  } catch {
    return null
  }
}

/** Async resolve of the PATH-winning binary, or null. */
export async function whichAsync(command: string): Promise<string | null> {
  if (!command || command.includes('\0')) return null

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('where.exe', [command], {
        encoding: 'utf-8',
        windowsHide: true,
      })
      return firstNonEmptyLine(String(stdout))
    }

    try {
      const { stdout } = await execFileAsync('which', [command])
      return firstNonEmptyLine(String(stdout))
    } catch {
      // Fall back to sync shell path for rare environments without `which`.
      return whichSync(command)
    }
  } catch {
    return null
  }
}

export function commandOnPath(command: string): boolean {
  return whichSync(command) !== null
}

export async function commandOnPathAsync(command: string): Promise<boolean> {
  return (await whichAsync(command)) !== null
}
