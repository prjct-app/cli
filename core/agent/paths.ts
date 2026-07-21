/**
 * Path safety for owned-agent tools — stay inside project root.
 */

import fs from 'node:fs'
import path from 'node:path'

const DENY_BASENAME =
  /^(?:\.env(?:\..+)?|.*\.(?:pem|key|p12|pfx)|id_rsa|id_ed25519|credentials\.json|auth\.json)$/i

const DENY_SEGMENT = /(?:^|\/)(?:\.ssh|\.gnupg|\.aws|\.config\/gcloud)(?:\/|$)/i

export class PathDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathDeniedError'
  }
}

/** Resolve user path under root; throws if escapes or hits deny list. */
export function resolveSafePath(root: string, userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new PathDeniedError('path is required')
  }
  const rootAbs = path.resolve(root)
  // Absolute paths must still land under root
  const candidate = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(rootAbs, userPath)

  const rel = path.relative(rootAbs, candidate)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PathDeniedError(`path escapes project root: ${userPath}`)
  }

  const base = path.basename(candidate)
  if (DENY_BASENAME.test(base)) {
    throw new PathDeniedError(`path blocked (secret-like name): ${base}`)
  }
  const posix = candidate.split(path.sep).join('/')
  if (DENY_SEGMENT.test(posix)) {
    throw new PathDeniedError(`path blocked (sensitive directory): ${userPath}`)
  }

  return candidate
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function fileExists(p: string): boolean {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}
