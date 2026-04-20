/**
 * Secret scanner shared by `prjct remember` and the wiki ingest service.
 *
 * Conservative list — any hit triggers a warning and the caller has to
 * pass `--force` (or equivalent) to persist. Better a false positive than
 * a committed key.
 */

export const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
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

export function scanForSecrets(text: string): string[] {
  const hits: string[] = []
  for (const { name, re } of SECRET_PATTERNS) if (re.test(text)) hits.push(name)
  return hits
}
