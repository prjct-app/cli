/**
 * Config Types
 * Types for project and global configuration.
 */

/**
 * Persona declaration — Claude's role in THIS project.
 *
 * Hooks inject this as additionalContext so Claude enters every session
 * knowing what hat to wear. The human rotates across contexts (PM in
 * project A, Founder in B, DEV in C); the persona makes that switch
 * explicit without ceremony.
 *
 * Declarative only: lists what MCPs/packs exist, never how to use them.
 */
export interface ProjectPersona {
  /** Claude's role label. Freeform, but common: PM / PO / DEV / TDD / Founder / Research / custom */
  role: string
  /** One-line project focus — e.g. "B2B SaaS onboarding optimization" */
  focus?: string
  /** MCP servers this project expects available. Purely informational signal for Claude. */
  mcps?: string[]
  /** Seed packs active in this project (see templates/packs/*.json) */
  packs?: string[]
}

/**
 * Local config - stored in .prjct/prjct.config.json
 * Minimal config that points to global storage
 */
export interface LocalConfig {
  projectId: string
  dataPath: string
  /**
   * Whether to show metrics in command output.
   * Defaults to true for new projects.
   * @see PRJ-70
   */
  showMetrics?: boolean
  /**
   * Verification checks to run after sync.
   * Built-in checks always run; custom checks are additive.
   * @see PRJ-106
   */
  verification?: {
    checks?: Array<{
      name: string
      command?: string
      script?: string
      enabled?: boolean
    }>
    failFast?: boolean
  }
  /**
   * Persona declaration for this project. Read by hooks to inject
   * Claude's role + available MCPs into `additionalContext`.
   */
  persona?: ProjectPersona
  /**
   * Anti-over-engineering ("lean") intensity. Unset / `off` keeps the
   * lean guidance and the Stop-hook lean-debt detector dormant — the
   * capability is strictly opt-in so projects that want completeness
   * over minimalism see zero behaviour change. Higher modes bias the
   * skill guidance toward YAGNI/KISS and arm the detector:
   *   - `lite`  — suggest the leaner alternative, never enforce
   *   - `full`  — apply the decision ladder by default
   *   - `ultra` — YAGNI absolutist; challenge non-essential scope
   * The non-negotiables carve-out (security, input validation,
   * data-loss handling, accessibility, edge-case correctness) holds at
   * every mode. Mirrors ponytail's intensity levels.
   */
  lean?: { mode: 'off' | 'lite' | 'full' | 'ultra' }
  /**
   * Override for the Obsidian-compatible wiki vault location.
   * - Absolute path (e.g. "/Users/jj/Documents/prjct/my-app")
   * - Or tilde-prefixed ("~/Documents/prjct/my-app")
   * - Or project-relative ("./docs/wiki" — kept inside the repo)
   *
   * When unset, defaults to `~/Documents/prjct/<slug>/` where `<slug>` is
   * derived from the repo basename (with a short hash suffix on collision).
   *
   * Reason this exists: the old default `.prjct/wiki/` was a hidden
   * folder inside the repo — Obsidian users couldn't find it in Finder,
   * and committing the repo accidentally shared private decisions/
   * learnings. v2.2.0 moved the default to ~/Documents/prjct/ for
   * visibility + privacy-by-default. Setting this field to `.prjct/wiki`
   * reverts to the pre-2.2.0 behaviour.
   */
  vaultPath?: string

  /**
   * Optional semantic-search layer (phase 3). OFF unless `provider` is set —
   * recall stays pure BM25/keyword by default, zero new dependencies.
   *
   * When enabled, memory entries are embedded and the vectors stored locally
   * in SQLite (`memory_embeddings`); similarity is in-process cosine, so
   * there is NO vector-DB / native dependency. `provider` is an
   * OpenAI-compatible `/embeddings` HTTP endpoint — works with OpenAI,
   * Ollama (`http://localhost:11434/v1`), LM Studio, or any compatible
   * server. The API key (if the endpoint needs one) comes from the
   * `PRJCT_EMBEDDINGS_API_KEY` env var, never from this file.
   */
  embeddings?: {
    provider?: 'openai-compatible'
    /** Base URL of the embeddings endpoint, e.g. https://api.openai.com/v1 */
    baseUrl?: string
    /** Model id, e.g. "text-embedding-3-small" or "nomic-embed-text". */
    model?: string
    /** Expected vector dimensionality (used to invalidate stale vectors). */
    dims?: number
    /** Header carrying the API key. Default `authorization` (Bearer). Set to
     *  `api-key` for Azure OpenAI, or any custom header a gateway expects. */
    authHeader?: string
    /** Scheme/prefix before the key, e.g. `Bearer`. Empty string = raw key. */
    authScheme?: string
    /** Extra static headers sent on every request. */
    headers?: Record<string, string>
    /** Raw query string appended to the URL, e.g. `api-version=2023-05-15`. */
    query?: string
  }

  /**
   * Cloud sync opt-in for THIS project. Absent / `enabled: false` ⇒ the
   * project is local-only and NOTHING leaves the machine — the local-first
   * default. `prjct cloud link` flips `enabled` on; the CLI then pushes the
   * pending queue to the storage API (token in `auth.json`, never here) and
   * pulls remote changes. Safe to commit if a team wants a shared opt-in.
   *
   * Paid enforcement is 100% server-side: the CLI only carries the token and
   * surfaces whatever the API returns (e.g. an upgrade message). There is no
   * paywall logic in this open-source client.
   *
   * `include` is a per-group whitelist (memories, tasks, ideas, shipped,
   * workflows, metrics, archives + the opt-in-only user_prompts /
   * agent_sessions / analysis). Unset groups fall back to the cross-device
   * defaults (sensitive groups off). See `core/sync/entity-map.ts`.
   */
  cloud?: {
    /** Master switch. `false`/absent ⇒ local-only; nothing is pushed/pulled. */
    enabled: boolean
    /** Temporarily stop sync without unlinking (preserves `include`/`linkedAt`). */
    paused?: boolean
    /** ISO timestamp of the first `prjct cloud link`. */
    linkedAt?: string
    /** Per-group sync overrides; merged over the cross-device defaults. */
    include?: Record<string, boolean>
  }
}

/**
 * Global config - stored in ~/.prjct-cli/projects/{id}/project.json
 * Contains all project metadata
 */
export interface GlobalConfig {
  projectId: string
  projectPath?: string
  authors: AuthorEntry[]
  version: string
  created?: string
  lastSync: string
}

/**
 * Author entry in global config
 */
export interface AuthorEntry {
  name: string
  email: string
  github: string
  firstContribution?: string
  lastActivity?: string
}

/**
 * Project config - generic project settings (for registry)
 */
export interface ProjectConfig {
  projectId: string
  name?: string
  createdAt: string
  updatedAt: string
  settings?: ProjectSettings
}

/**
 * Project-specific settings
 */
export interface ProjectSettings {
  autoCommit?: boolean
  commitFooter?: string
  branchNaming?: string
  /** Preferred AI model for this project (e.g., 'opus', 'sonnet', '2.5-pro') */
  preferredModel?: string
}

/**
 * Global settings - user preferences
 */
export interface GlobalSettings {
  defaultAuthor?: string
  theme?: 'light' | 'dark'
  telemetry?: boolean
}
