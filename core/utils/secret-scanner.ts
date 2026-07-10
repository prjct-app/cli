/**
 * Secret scanner shared by `prjct remember`, the wiki ingest service,
 * PreToolUse credential guard, and (Phase 1.5 / B7) the prjct-cloud server.
 *
 * **Standalone contract** — this file MUST stay free of imports from
 * `path-manager`, `storage/*`, `infrastructure/*`, anything that
 * touches the filesystem or SQLite. Pure regex matching, no I/O.
 * Server-side reuse depends on this. If you add a new dependency
 * here, the cloud's secret-scanner package will fail to load and
 * events containing secrets will leak into the database.
 *
 * Conservative list — any hit triggers a warning (or PreToolUse deny).
 * Better a false positive than a committed / exfiltrated key.
 *
 * Public API is intentionally load-bearing:
 *   - `scanForSecrets(text: string): string[]` — names of patterns hit
 *   - `scanHookToolInput(input: unknown): string[]` — flatten agent tool
 *     payloads (Claude + Gemini shapes) then scan
 *
 * The API is treated as load-bearing. Renames or removals must update
 * both prjct-cli and the cloud package in lockstep.
 */

const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'sk-… token', re: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { name: 'prjct live token', re: /\bprjct_sk_(?:live|test)_[A-Za-z0-9_-]{8,}/ },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub server PAT', re: /\bghs_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[abps]-[A-Za-z0-9-]{10,}/ },
  { name: 'Supabase access token', re: /\bsbp_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI project key', re: /\bsk-proj-[A-Za-z0-9_-]{20,}/ },
  {
    name: 'bearer JWT-ish',
    re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: 'PEM private key',
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
]

export function scanForSecrets(text: string): string[] {
  if (!text) return []
  const hits: string[] = []
  for (const { name, re } of SECRET_PATTERNS) if (re.test(text)) hits.push(name)
  return hits
}

/**
 * Walk an unknown tool payload and collect string leaves for scanning.
 * Host-agnostic: Claude (`command`, `file_path`, `content`) and Gemini
 * (`run_shell_command` args, `write_file` contents) all flatten the same way.
 * Caps total size so a huge paste cannot OOM the hook.
 */
export function flattenToolInputText(input: unknown, maxChars = 200_000): string {
  const parts: string[] = []
  let used = 0

  const push = (s: string) => {
    if (!s || used >= maxChars) return
    const slice = s.length + used > maxChars ? s.slice(0, maxChars - used) : s
    parts.push(slice)
    used += slice.length
  }

  const walk = (v: unknown, depth: number) => {
    if (used >= maxChars || depth > 8) return
    if (typeof v === 'string') {
      push(v)
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1)
      return
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        // Keys sometimes carry secret names; scan both key and value path labels lightly
        if (/token|secret|password|api[_-]?key|authorization/i.test(k) && typeof val === 'string') {
          push(`${k}=${val}`)
        } else {
          walk(val, depth + 1)
        }
      }
    }
  }

  walk(input, 0)
  return parts.join('\n')
}

/**
 * Scan a PreToolUse / BeforeTool payload for credential material.
 * Accepts the full hook stdin object or just `tool_input`.
 */
export function scanHookToolInput(payload: unknown): string[] {
  if (payload == null) return []
  // Prefer tool_input / toolInput when present; also scan top-level for Gemini variants
  const obj = payload as Record<string, unknown>
  const toolInput = obj.tool_input ?? obj.toolInput ?? obj.parameters ?? payload
  const text = flattenToolInputText(toolInput)
  // Also scan shell command fields that hosts put at top level
  const extra = [obj.command, obj.prompt, obj.content]
    .filter((x): x is string => typeof x === 'string')
    .join('\n')
  return scanForSecrets(extra ? `${text}\n${extra}` : text)
}

/**
 * Managed hook commands must not reference host-specific env like `$PPID`.
 * Gemini (and other sanitized-env hosts) refuse hooks whose commands require
 * env vars they do not inject — which silently skips security MUST hooks.
 */
export function hookCommandUsesFragileEnv(command: string): boolean {
  // PPID is shell-special but NOT in Gemini's sanitized env allowlist.
  // Also flag bare ${VAR} required-env patterns that are not portable GEMINI_/PRJCT_ vars.
  if (/\$\{?PPID\}?/.test(command)) return true
  if (/\$\{SUPACODE_[A-Z0-9_]+\}/.test(command)) return true
  if (/\$\{P_TERM_[A-Z0-9_]+\}/.test(command)) return true
  return false
}
