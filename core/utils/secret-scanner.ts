/**
 * Secret scanner shared by `prjct remember`, the wiki ingest service,
 * and (Phase 1.5 / B7) the prjct-cloud server. The cloud reuses this
 * module verbatim to scrub events server-side as a defense-in-depth
 * layer.
 *
 * **Standalone contract** — this file MUST stay free of imports from
 * `path-manager`, `storage/*`, `infrastructure/*`, anything that
 * touches the filesystem or SQLite. Pure regex matching, no I/O.
 * Server-side reuse depends on this. If you add a new dependency
 * here, the cloud's secret-scanner package will fail to load and
 * events containing secrets will leak into the database.
 *
 * Conservative list — any hit triggers a warning and the caller has to
 * pass `--force` (or equivalent) to persist. Better a false positive
 * than a committed key.
 *
 * Public API is intentionally minimal:
 *   - `scanForSecrets(text: string): string[]` — names of patterns hit
 *   - `SECRET_PATTERN_NAMES` — readonly list of detector names
 *
 * The API is treated as load-bearing. Renames or removals must update
 * both prjct-cli and the cloud package in lockstep.
 */

const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'sk-… token', re: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub server PAT', re: /\bghs_[A-Za-z0-9]{30,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[abps]-[A-Za-z0-9-]{10,}/ },
  {
    name: 'bearer JWT-ish',
    re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
]

/**
 * Names of all detectors. Useful for cloud-side telemetry and for
 * surfacing "what secret kinds do we scan for?" without leaking the
 * regex shapes themselves.
 */
export const SECRET_PATTERN_NAMES: ReadonlyArray<string> = SECRET_PATTERNS.map((p) => p.name)

export function scanForSecrets(text: string): string[] {
  const hits: string[] = []
  for (const { name, re } of SECRET_PATTERNS) if (re.test(text)) hits.push(name)
  return hits
}
