# prjct-cli

**Project memory + quality workflows for AI coding agents.** prjct-cli gives Claude Code (and any agent) durable memory of your projects: decisions, learnings, gotchas, hot files, recurring bugs. Plus 5 named quality workflows (review, qa, security, investigate, ship) that persist findings back to memory so the next session compounds.

[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)]()
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()

## Install / upgrade — one paste

Copy this prompt and paste it in Claude Code (works for fresh install AND upgrade — Claude picks YOUR package manager, doesn't force npm):

```text
Install or upgrade prjct-cli on this machine. First detect which package manager I use globally (check `command -v pnpm`, `command -v bun`, `command -v yarn`, `command -v npm` in that order; also check where any existing `prjct` install lives via `command -v prjct` and use the SAME package manager so we don't create parallel installs). Then run the matching install:
- pnpm: `pnpm install -g prjct-cli@latest`
- bun:  `bun install -g prjct-cli@latest`
- yarn: `yarn global add prjct-cli@latest`
- npm:  `npm install -g prjct-cli@latest`

After install, run `prjct install` to verify/repair required native dependencies and hooks, then `prjct setup` to wire providers, then `prjct sync` if the cwd is a git repo. Verify with `prjct -v` and tell me which package manager you used.
```

~30 seconds. Claude detects YOUR package manager (pnpm, bun, yarn, npm) and uses it — critical so we don't end up with parallel installs in different package managers' bin dirs. Re-pasting upgrades to the latest published version.

> **Why detection matters:** if you have `pnpm` globally and Claude runs `npm install -g prjct-cli@latest`, you end up with TWO installs in PATH. The earlier one wins, `prjct -v` reports the wrong version, and aggressive cleanup risks bricking your shell. The detection-first prompt avoids this entirely.

### Prefer no Node/npm? (run in your own terminal)

If you'd rather have the standalone binary (Bun runtime embedded, no Node ecosystem needed), run this **yourself in a terminal** — it's a `curl | bash` install which Claude Code's harness intentionally blocks for safety:

```bash
curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
```

The script auto-detects platform (mac arm64/intel + linux x64), downloads the right binary from GitHub Releases, sets up `~/.local/bin/prjct` on your PATH, runs `prjct setup` + `prjct sync`, and warns you if a stale package-manager install is shadowing the new binary.

### Updating prjct-cli (built-in)

prjct-cli updates itself. The canonical command is **`prjct update`**, with
**`prjct upgrade`** as an identical alias:

```bash
prjct update            # = prjct upgrade
prjct update --dry-run  # show exactly what would change, touch nothing
prjct upgrade --yes     # non-interactive (skip the consolidation prompt)
```

What it does, in three phases (`core/commands/update.ts`):

1. **Package update** — auto-detects the package manager that owns your install
   (npm / pnpm / bun / yarn / homebrew), resolves the **true registry-latest**
   version and pins it exactly (so a stale `@latest` cache can't downgrade you),
   and migrates a homebrew install to your detected PM if needed.
2. **Global cleanup & consolidation** — migrates legacy state to SQLite,
   reinstalls editor commands/config, and **consolidates parallel installs** so
   you don't end up with shadowing copies in different PM bin dirs.
3. **Daemon restart** — stops the stale background daemon and respawns it from
   the freshly installed code.

Flags: `--dry-run`, `--yes`/`-y`, `--cleanup` / `--no-cleanup` (default `auto`),
`--md` (machine-readable output for agents/CI).

**Knowing an update exists:** prjct-cli checks at most once every 24h (cached, fully
non-blocking — never delays a command) and, after the command's own output,
prints a one-line banner: `Update available! x.y.z → a.b.c — Run: prjct upgrade`.
Or set it and forget it: `prjct config set auto-update on` (throttled background
check, logs to `~/.prjct-cli/state/auto-update.log`).

Full install + upgrade paths: [INSTALL_PROMPT.md](./INSTALL_PROMPT.md).

### Zero native dependencies

prjct-cli uses SQLite for local project memory through the runtime's **built-in**
driver — `bun:sqlite` on Bun, `node:sqlite` on Node (≥22.5). No native addon, no
`node-gyp`, no postinstall script. It installs cleanly under `--ignore-scripts`
and locked-down CI, which closes the supply-chain surface a native rebuild opens.

## What you get

After install, **next session in any prjct-cli project**:

- **Lookup-first protocol**: Claude reads `~/Documents/prjct/<slug>/_generated/` (architecture, patterns, decisions, gotchas, recent ships) BEFORE re-exploring source. Cuts ~10K tokens of exploration per session.
- **Auto-capture**: Stop hook scans the assistant transcript and persists durable insights (decisions/learnings/gotchas) tagged for dedup. The next session finds them in the vault.
- **Pattern detection**: Stop hook detects hot files (>3 changes in 7 days), recurring bugs (gotchas with the same topic), tech-debt growth (TODO/FIXME count rising). All persisted as learnings, surfaced next session.
- **5 quality workflows** activated by natural language ("review this branch", "qa the UI", "security check", "investigate this bug"):
  - `review` — Production Bug Hunt + Completeness Gate (3 modes)
  - `qa` — Real Browser, Atomic Fixes, Regression Tests
  - `security` — OWASP Top 10 + STRIDE, 8/10 confidence gate, concrete exploit per finding
  - `investigate` — Iron Law (no fix without investigation), max 3 failed hypotheses
  - `ship` (endurecido) — Coverage Gate + Auto-Document
- **Delivery-geometry advisory** (`prjct review-risk`): reads the committed changeset vs the merge-base and suggests a size tier (trivial/normal/large) + whether to ship direct, as one PR, or split — with the touched top-level dirs as natural split lines. Purely advisory: never gates, never mutates git.

## How it works

State lives in **SQLite** at `~/.prjct-cli/projects/<id>/`. The vault at `~/Documents/prjct/<slug>/_generated/` is an auto-regenerated Markdown snapshot — agent-readable via `Read`/`Glob`, browsable in Obsidian.

```
Claude Code session                       prjct-cli
       |                                    |
       | SessionStart hook fires            |
       | --------------------------------> |  self-heal CLAUDE.md, regen vault
       |                                    |  (opt-in: silent auto-update check)
       |                                    |
       | Lookup-first protocol kicks in:    |
       | reads _generated/* before source   |
       v                                    |
  Writes code, makes decisions              |
       |                                    |
       | Stop hook fires                    |
       | --------------------------------> |  ingest captured/, ingest workflows/,
       |                                    |  scan transcript → memory,
       |                                    |  detect hot files / recurring bugs
       |                                    |  / tech-debt growth → memory,
       |                                    |  regen vault
```

State is the source of truth; the vault is recall. New knowledge enters via `prjct remember <type>`, `prjct capture`, or — automatically — the Stop hook's transcript scan.

### Where data actually lives

Not "all in a local `.prjct/` folder" — that's the pre-v1.24.1 model. Three tiers:

| Tier | Location | Commit it? |
|---|---|---|
| Config / identity | `<repo>/.prjct/prjct.config.json` (`projectId`, persona) | **Yes** — small, machine-independent |
| State (source of truth) | `~/.prjct-cli/projects/<projectId>/prjct.db` (SQLite) | No — per-device |
| Vault (recall snapshot) | `~/Documents/prjct/<slug>/_generated/` (Markdown) | No — regenerated |

Find a project's data: read `projectId` from `.prjct/prjct.config.json`, then the
DB is `~/.prjct-cli/projects/<projectId>/`, the vault is
`~/Documents/prjct/<slug>/` (`<slug>` = repo dir name lowercased; `PRJCT_CLI_HOME`
relocates the global store). Teammates share knowledge via optional cloud sync
(`prjct login` + `prjct sync`), **not** git — git never carries state. Full
detail, worktrees, monorepos: **[docs/storage-and-paths.md](./docs/storage-and-paths.md)**.

## Execution environments (zero-config)

The same binary runs in a plain shell, inside Claude Code, in an OpenAI Codex sandbox, or in CI, and **adapts output automatically with no configuration**. Detection signals (env vars, MCP, `CLAUDE.md`, `~/.claude/`, the `codex` binary on PATH, `process.stdout.isTTY`) are read silently; `--md` / `--json` are the only overrides. Full per-environment table, source-file references, and the detection order: **[docs/environments.md](./docs/environments.md)**.

### What it looks like

In a real terminal — branded, animated, colored:

```text
$ prjct task "add OAuth refresh"
⚡ prjct  ✓ Task started: add OAuth refresh
         branch: task/add-oauth-refresh · status: active
```

Inside Claude Code / Codex / CI (non-TTY) — the same line, **static** (no
animation), so logs stay clean. With `--md`, output is plain markdown an agent
can consume directly:

```text
$ prjct task "add OAuth refresh" --md
> Task started: **add OAuth refresh**
> branch `task/add-oauth-refresh` · status `active`
```

## Quick start (post-install)

```bash
# In any git repo
prjct sync                                  # register the project (auto on first prjct command)
prjct task "add OAuth refresh"              # start tracking work
prjct remember decision "we chose JWT + refresh rotation"
prjct status done                           # close the active task
prjct ship                                  # bump version, commit, push, open PR
```

In Claude Code, ask naturally:
- "review my changes" → activates the `review` workflow with Production Bug Hunt methodology
- "what patterns does this project use?" → Claude reads `_generated/patterns.md` directly (no `grep`)
- "investigate why tests intermittently fail" → activates `investigate` with Iron Law

Optional flags:
```bash
prjct config set auto-update on    # silent self-update (1/hour throttled)
prjct team --enforce               # pre-commit hook blocks commits without prjct-cli
```

## Inside Claude Code / Gemini CLI

```bash
p. capture "llamar a Ana re: pricing"        # GTD inbox — anything goes
p. task "add OAuth refresh"                   # start tracking work
p. remember decision "we chose JWT + refresh rotation"
p. status done                                # close the active task
p. ship                                       # commit, push, open PR
```

Cursor / Windsurf use the same commands with a `/` prefix: `/capture`, `/task`, `/ship`.

### Core verbs

| Verb | What it does |
|---|---|
| `prjct capture "<text>"` | GTD-style universal inbox. Bare `prjct "<text>"` also routes here. |
| `prjct task ["<desc>"]` | Register a task or show the active one. |
| `prjct status <value>` | Inline status change on the active task (`done`, `paused`, `active`, …). |
| `prjct tag <k:v>` | Tag the active task (`type:bug`, `domain:auth`, …). |
| `prjct remember <type> "<content>"` | Persist a memory entry (decision, learning, gotcha, …). |
| `prjct embeddings <set\|status\|test\|clear>` | Configure the global BYOT embeddings provider — any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, Azure, …), one secure key, all projects. |
| `prjct ship [name]` | Run the project's ship workflow (commit, push, PR, persist). |
| `prjct sync` | Re-index files, git co-change, imports; refresh project analysis. |
| `prjct regen` | Full rebuild of the Obsidian vault snapshot from SQLite. |
| `prjct suggest` | Smart recommendations based on current project state. |
| `prjct review-risk` | Advisory change-size + delivery-geometry signal for the branch (read-only; never gates, never splits). |
| `prjct seed <add\|list>` | Manage packs (persona, memory types, workflow slots). |

## Personas & Packs

`.prjct/prjct.config.json` declares the persona. Hooks inject it every session.

```json
{
  "projectId": "…",
  "persona": {
    "role": "PM",
    "focus": "B2B SaaS onboarding optimization",
    "mcps": ["linear", "posthog", "gmail"],
    "packs": ["pm", "research", "daily"]
  }
}
```

Five built-in packs (manifests, not bash pipelines):

| Pack | Persona | Memory types enabled | Workflow slots |
|---|---|---|---|
| `code` | DEV | `fact`, `decision`, `learning`, `gotcha`, `pattern`, `anti-pattern`, `shipped` | `ship`, `review` |
| `daily` | — | `inbox`, `todo`, `idea` | `morning`, `clarify`, `review` |
| `pm` | PM | `decision`, `insight`, `question`, `stakeholder` | `spec`, `triage`, `update` |
| `founder` | Founder | `goal`, `okr`, `person`, `stakeholder`, `decision` | `ship`, `review` |
| `research` | Research | `source`, `claim`, `question`, `insight` | `research`, `review` |

Slots ship **empty** — the human or the agent fills them on demand.

## Hooks (opt-in)

`prjct install` writes 7 passive hooks to `~/.claude/settings.json`. They inject `additionalContext`; none block by default.

| Event | Injects |
|---|---|
| `SessionStart` | Persona + active task + recent learnings; regenerates vault from DB |
| `UserPromptSubmit` | Topical recall from memory matching the prompt |
| `PreToolUse` (Bash git commit) | Anti-patterns tagged with touched files |
| `PostToolUse` (Edit/Write) | Silently annotates `files_touched` on active task |
| `Stop` | Async prompt: "learn anything reusable?"; ingests captured/ then regenerates vault |
| `SubagentStart` | Persona + memories for fresh-brain subagents |
| `CwdChanged` | Re-contextualizes on project switch |

Remove with `prjct claude uninstall` (hooks only) or `prjct uninstall` (everything).

## MCP Server

prjct-cli exposes an MCP server with 5 tool groups:

| Group | Tools |
|---|---|
| **memory** | save, list, similar, forget |
| **project** | patterns, status, summary |
| **files** | files, recent |
| **workflow** | list, run, log |
| **code-intel** | related, impact, stale |

The broker model: if you already have `linear`, `jira`, `posthog`, `gmail` MCPs wired, prjct-cli **does not duplicate them** — it tells your agent they're available for the current persona and caches your insights locally.

## CLI

```bash
prjct start              First-time setup wizard (AI providers + commands)
prjct init               Initialize project in current directory
prjct install            Install Claude Code hooks (merge-safe)
prjct uninstall          Complete system removal
prjct sync               Sync project state, rebuild indexes
prjct regen              Full vault rebuild from SQLite
prjct watch              Auto-sync on file changes
prjct doctor             Check system health
prjct hooks <install|uninstall|status>  Git hooks for auto-sync
prjct context <memory|learnings|wiki>  Recall memory / sync the vault
prjct review-risk        Advisory change-size + delivery-geometry hint (read-only)
prjct workflow ["config"]  Configure hooks via natural language
prjct stop / restart     Background daemon control (self-reloads on stale code; manual restart rarely needed)
prjct login / logout / auth   Cloud sync authentication
prjct update             Update CLI system-wide (alias: prjct upgrade)
prjct --version / --help
```

Every command supports `--md` to emit LLM-optimized markdown for agent consumption.

## Memory

14 built-in types + user-defined lowercase identifiers:

`fact`, `decision`, `learning`, `gotcha`, `pattern`, `anti-pattern`, `shipped`, `inbox`, `todo`, `idea`, `insight`, `question`, `source`, `person` — plus anything you invent (`recipe`, `workout`, `interview`, …).

```bash
prjct remember decision "we chose SQLite because the app is local"
prjct capture "check why webhook retries on 502"
prjct context memory "auth refresh"
```

Memory is FTS5-backed (SQLite) and persona-filtered. Recall blends three signals — BM25 lexical, semantic vectors, and a usefulness ledger that reinforces what the project keeps building on. Capture **dedups** automatically: a verbatim re-capture of the same `(type, content)` is skipped, so detectors firing each session can't bloat the store. Every `remember`, `capture`, `ship`, and the SessionStart / Stop hooks regenerate the agent-readable markdown export at `~/Documents/prjct/<slug>/_generated/`.

> SQLite is the source of truth. The export is a snapshot — never hand-edit `_generated/`; if data is missing, fix the pipeline.

### Semantic recall (embeddings)

On by default for **every** project — no setup, no key, no native dependency. A built-in pure-JS embedder (feature-hashed character n-grams) vectorizes memory into SQLite so recall catches morphological / cross-vocabulary matches BM25 misses (`auth`≈`authentication`).

Want higher quality? Bring your own key once, globally:

```bash
prjct embeddings set --key sk-...      # stored in the macOS Keychain (else a 0600 file), never in config
prjct embeddings test                  # validate connectivity (full error + hint on failure)
prjct embeddings status                # show provider, model, base URL + key location
prjct embeddings clear                 # forget the key AND settings (falls back to local)
```

One key applies to every project. **Any OpenAI-compatible `/embeddings` provider works** — just point `--base-url` at its root:

```bash
# OpenAI (default)
prjct embeddings set --key sk-...      --base-url https://api.openai.com/v1
# OpenRouter
prjct embeddings set --key sk-or-v1-... --base-url https://openrouter.ai/api/v1
# Ollama (local, no key) / LM Studio / Together / Mistral / Voyage / Jina / DeepInfra …
prjct embeddings set --model nomic-embed-text --base-url http://localhost:11434/v1
```

Providers that don't use `Authorization: Bearer` are supported too via auth flags — e.g. **Azure OpenAI** (`api-key` header + `api-version` query):

```bash
prjct embeddings set --key "$AZURE_KEY" \
  --base-url https://RESOURCE.openai.azure.com/openai/deployments/DEPLOYMENT \
  --auth-header api-key --auth-scheme none --query "api-version=2023-05-15"
```

| Flag | Purpose |
| --- | --- |
| `--key <k>` | API key — stored in the Keychain (else a 0600 file), never in config |
| `--base-url <u>` | Provider's OpenAI-compatible root (default `https://api.openai.com/v1`) |
| `--model <m>` | Model id (default `text-embedding-3-small`) |
| `--auth-header <h>` | Header carrying the key (default `authorization`; `api-key` for Azure) |
| `--auth-scheme <s\|none>` | Prefix before the key (default `Bearer`; `none` = raw key) |
| `--headers "k=v,k2=v2"` | Extra static headers (gateways, attribution) |
| `--query <qs>` | Raw query string appended to the URL (e.g. `api-version=2023-05-15`) |

Without a key the built-in local embedder is used. Vector dimensionality is detected from the provider's response (no hardcoded size). Each project re-vectorizes on its next session.

### Drop files into the vault (bidirectional)

Drop a file into `~/Documents/prjct/<slug>/captured/` — it becomes memory, vectorized into the DB. Two shapes:

```markdown
---
type: learning
tags: { domain: auth }
---
JWT refresh rotation needs the prior token's `iat` to detect replay.
```

- **Structured** — a markdown file WITH frontmatter → one typed entry.
- **Raw document** — any text file with no frontmatter (`.txt`, `.json`, `.csv`, `.md`, …) → a `source` entry, auto-chunked when long. Binary/rich docs (`.pdf`, `.docx`, `.rtf`, images) are extracted via tools you already have — `textutil` (macOS), `pdftotext` (poppler), `tesseract` (OCR) — with zero bundled dependency; without the tool the file waits for a re-sync after you install it.

The Stop hook (or `prjct context wiki sync`) ingests, vectorizes, then moves the file to `captured/_ingested/<timestamp>/`. Content is scanned for secrets and prompt-injection before ingest.

### Why a markdown export?

Two reasons: (1) any agent with `Read`/`Glob` consumes it without an SDK or MCP handshake — the markdown tree is paged into ~5K-token chunks so a single file read stays cheap; (2) it survives `prjct uninstall` and remains human-readable. Obsidian compatibility is a side effect — `prjct install` auto-registers the vault so `obsidian://open?vault=<slug>` works in one click, but Obsidian is never required.

## Code Intelligence

`prjct sync` builds three indexes:

| Index | Purpose |
|---|---|
| BM25 | Full-text search over names, symbols, comments |
| Import graph | Forward + reverse dependency edges |
| Git co-change | Files that change together |

A combined ranker fuses the three signals (`core/domain/file-ranker.ts`) and powers `prjct context files`, plus `prjct_related`, `prjct_impact`, and `prjct_stale` in the MCP server.

## Issue Tracker Integration

Bring your own MCP — prjct-cli doesn't duplicate trackers.

- **Linear**: configure the official Linear MCP in your agent and declare it in `persona.mcps`.
- **Jira**: same — use the official Atlassian MCP.

(The legacy v1 `linear` / `jira` sub-commands were removed in v2; MCP is the only path now.)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PRJCT_CLI_HOME` | `~/.prjct-cli` | Override global storage |
| `PRJCT_EMBEDDINGS_API_KEY` | — | Embeddings API key (overrides `prjct embeddings set`; prefer the keychain-backed command) |
| `PRJCT_DEBUG` | — | Enable debug logging (`1`, `true`, log level) |
| `PRJCT_NO_DAEMON` | — | Force non-daemon path (debugging) |
| `DEBUG` | — | Fallback debug flag |
| `CI` | — | Skip interactive prompts |

## Architecture

```
prjct-cli/
  bin/prjct              Thin JS shim (daemon-first)
  core/
    cli/                 CLI command handlers + dispatcher
    hooks/               7 passive Claude Code hook subcommands
    packs/               Pack manifests + pack-manager
    mcp/                 MCP server (5 tool groups)
    domain/              BM25, import-graph, git-cochange, file-ranker
    services/            wiki-generator, wiki-ingest, sync, skill-generator
    storage/             SQLite (one DB per project) — source of truth
    schemas/             Zod — runtime validation
    infrastructure/      path-manager, ai-provider, command-installer
    daemon/              Background daemon (file watching)
    sync/                Cloud sync client + auth-config
  templates/
    commands/            Thin per-command templates (defer to CLI --md)
    packs/               JSON pack manifests
    global/              Per-editor router templates
```

## Requirements

- Node.js 22.22.2+ or Bun 1.0+
- One of: Claude Code, Gemini CLI, Cursor IDE, Windsurf, OpenAI Codex, Antigravity

## Common questions

**How do I initialize / register a new project?**
In any git repo, run `prjct sync` (it auto-runs on the first `prjct` command) or
`prjct init`. This creates `.prjct/prjct.config.json` with a `projectId`, builds
the SQLite store at `~/.prjct-cli/projects/<projectId>/`, and generates the vault.

**How do I add a development task?**
Run `prjct task "<description>"` from the repo. It registers the task in SQLite,
creates a branch, and marks it active — worked example:

```bash
$ prjct task "add OAuth refresh"
⚡ prjct  ✓ Task started: add OAuth refresh
         branch: task/add-oauth-refresh · status: active

$ prjct tag type:feature domain:auth     # optional: categorize it
$ prjct status done                       # close it when finished
$ prjct ship                              # bump version, commit, PR
```

Inside an agent you don't type the command — say it: `p. task "add OAuth
refresh"` in Claude Code, `/task "…"` in Cursor/Windsurf. `prjct task` with no
argument prints the currently active task.

**How do I get AI assistance for a coding problem?**
Inside Claude Code (or any wired agent) describe the problem in natural
language — prjct-cli maps the intent to a quality workflow and runs its methodology,
persisting findings to memory. Concrete examples:

| You say… | Workflow activated | What it does |
|---|---|---|
| "review my changes" | `review` | Production Bug Hunt + Completeness Gate over the diff |
| "investigate why tests flake" | `investigate` | Iron Law — no fix without a root cause first |
| "is this safe to ship?" | `security` | OWASP Top 10 + STRIDE, concrete exploit per finding |
| "qa the checkout page" | `qa` | Real browser, atomic fixes, regression tests |

You can also pull project knowledge directly: ask "what patterns does this
project use?" and the agent reads `~/Documents/prjct/<slug>/_generated/patterns.md`
instead of grepping source (the lookup-first protocol). Outside an agent, every
command takes `--md` to emit agent-ready markdown.

**What does prjct-cli output look like in a normal terminal?**
A branded, **animated** spinner with full colors and interactive prompts (the
native human experience). See [What it looks like](#what-it-looks-like).

**How do I check for and apply updates?**
`prjct update` (alias `prjct upgrade`) — auto-detects your package manager, pins
the true registry-latest, consolidates parallel installs, restarts the daemon.
A non-blocking 24h-cached banner tells you when one is available. See
[Updating prjct-cli](#updating-prjct-cli-built-in).

**How does prjct-cli tailor its output for Claude Code specifically?**
Once it detects Claude (env vars / MCP / `CLAUDE.md` / `~/.claude/`) and sees
piped stdio (non-TTY), it adapts on every axis, with no flag:

- **Status line** — a single **static** `⚡ prjct …` line instead of the
  animated, carriage-return-redrawn spinner, so the transcript stays clean.
- **Prompts** — interactive confirmations are suppressed (nothing blocks on
  stdin that the agent can't answer).
- **`requiresLlm` commands** — run transparently (piped stdin means
  `isLlmContext` is already true; in a raw human terminal they'd refuse without
  `--md`).
- **`--md`** — when passed, the branding header/footer is stripped and output is
  structured markdown the model consumes directly.
- **Context injection** — the installed hooks feed Claude persona + active task
  + topical memory at `SessionStart`/`UserPromptSubmit`, and the lookup-first
  protocol points it at the regenerated vault before it re-reads source.

Full per-environment table: [docs/environments.md](./docs/environments.md).

**What's the output in an OpenAI Codex sandbox?**
Codex is detected by the `codex` CLI on PATH (context file `AGENTS.md`). The
sandbox is non-interactive/non-TTY, so prjct-cli emits the same static, prompt-free
status line as any agent; add `--md` for fully markdown-structured output.

**How do I quickly find the local `.prjct/` directory?**
It's in your **project repo root** (created by `prjct init` / first `prjct`
command) and is `.gitignore`d — that's why `git status` never shows it. Find it:

```bash
ls -la .prjct/                                    # from the repo root
cat .prjct/prjct.config.json                      # projectId + persona
ls -la "$(git rev-parse --show-toplevel)/.prjct/" # from any subdirectory
git check-ignore -v .prjct                         # why git ignores it
```

The path is always `<repoRoot>/.prjct/` (strictly relative to the project — no
env var, no global lookup). Read `projectId` from `prjct.config.json` to reach
the *other* tiers: DB at `~/.prjct-cli/projects/<projectId>/prjct.db`, vault at
`~/Documents/prjct/<slug>/_generated/` (`PRJCT_CLI_HOME` overrides the global
base). The in-repo `.prjct/` holds only config, not state — full detail in
[docs/storage-and-paths.md](./docs/storage-and-paths.md).

**How does prjct-cli detect its environment with no configuration?**
Every signal is something the host sets itself — Claude exports env vars and
pipes stdio, Codex puts `codex` on PATH, a real terminal has a TTY, CI doesn't.
prjct-cli reads those ambient facts (precedence in
[docs/environments.md](./docs/environments.md)) rather than asking you to declare
anything.

**Is all project data really in a local `.prjct/` directory? Team/VCS implications?**
No — only `.prjct/prjct.config.json` (small, **committable** identity) is in the
repo. State is per-device SQLite under `~/.prjct-cli` (never committed); the
vault is regenerated. Teams coordinate via optional cloud sync, not git. Full
tradeoffs: [docs/storage-and-paths.md](./docs/storage-and-paths.md).

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)
- [Changelog](CHANGELOG.md)
- [Architecture](./docs/architecture.md) · [Execution environments](./docs/environments.md) · [Storage & paths](./docs/storage-and-paths.md) · [SQLite migration](./docs/sqlite-migration.md)

## License

MIT
