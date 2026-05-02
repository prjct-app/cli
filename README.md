# prjct

**Project memory + quality workflows for AI coding agents.** prjct gives Claude Code (and any agent) durable memory of your projects: decisions, learnings, gotchas, hot files, recurring bugs. Plus 5 named quality workflows (review, qa, security, investigate, ship) that persist findings back to memory so the next session compounds.

[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)]()
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()

## Install / upgrade — one paste

Copy this prompt and paste it in Claude Code (works for fresh install AND upgrade):

```text
Install or upgrade prjct on this machine: run `curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash` and verify with `prjct -v`. If the cwd is a git repo, also run `prjct sync` to register it.
```

~30 seconds. The script downloads the standalone binary for your platform from GitHub Releases (no Node/npm needed), wires hooks + the lookup-first CLAUDE.md block, and registers the project. Re-running is safe — the script detects existing installs and upgrades to the latest published version.

Prefer terminal? Same effect:

```bash
curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
```

Or via package manager:

```bash
npm install -g prjct-cli@latest
# or: bun install -g prjct-cli@latest
```

### After install — three upgrade paths

| Method | Command | When |
|---|---|---|
| Same prompt | re-paste the install prompt | Default. Works whether installed or not. |
| CLI shortcut | `prjct update` | Already in a terminal. Auto-detects npm/pnpm/bun/yarn/homebrew. |
| Silent (set once) | `prjct config set auto-update on` | Background check 1/hour throttled, logs to `~/.prjct-cli/state/auto-update.log`. |

Full install + upgrade paths documented in [INSTALL_PROMPT.md](./INSTALL_PROMPT.md).

## What you get

After install, **next session in any prjct project**:

- **Lookup-first protocol**: Claude reads `~/Documents/prjct/<slug>/_generated/` (architecture, patterns, decisions, gotchas, recent ships) BEFORE re-exploring source. Cuts ~10K tokens of exploration per session.
- **Auto-capture**: Stop hook scans the assistant transcript and persists durable insights (decisions/learnings/gotchas) tagged for dedup. The next session finds them in the vault.
- **Pattern detection**: Stop hook detects hot files (>3 changes in 7 days), recurring bugs (gotchas with the same topic), tech-debt growth (TODO/FIXME count rising). All persisted as learnings, surfaced next session.
- **5 quality workflows** activated by natural language ("review this branch", "qa the UI", "security check", "investigate this bug"):
  - `review` — Production Bug Hunt + Completeness Gate (3 modes)
  - `qa` — Real Browser, Atomic Fixes, Regression Tests
  - `security` — OWASP Top 10 + STRIDE, 8/10 confidence gate, concrete exploit per finding
  - `investigate` — Iron Law (no fix without investigation), max 3 failed hypotheses
  - `ship` (endurecido) — Coverage Gate + Auto-Document

## How it works

State lives in **SQLite** at `~/.prjct-cli/projects/<id>/`. The vault at `~/Documents/prjct/<slug>/_generated/` is an auto-regenerated Markdown snapshot — agent-readable via `Read`/`Glob`, browsable in Obsidian.

```
Claude Code session                       prjct
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
prjct team --enforce               # pre-commit hook blocks commits without prjct
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
| `prjct ship [name]` | Run the project's ship workflow (commit, push, PR, persist). |
| `prjct sync` | Re-index files, git co-change, imports; refresh project analysis. |
| `prjct regen` | Full rebuild of the Obsidian vault snapshot from SQLite. |
| `prjct suggest` | Smart recommendations based on current project state. |
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

prjct exposes an MCP server with 5 tool groups:

| Group | Tools |
|---|---|
| **memory** | save, list, similar, forget |
| **project** | patterns, status, summary |
| **files** | files, recent |
| **workflow** | list, run, log |
| **code-intel** | related, impact, stale |

The broker model: if you already have `linear`, `jira`, `posthog`, `gmail` MCPs wired, prjct **does not duplicate them** — it tells your agent they're available for the current persona and caches your insights locally.

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
prjct context <files|signatures|imports|recent|summary>  Smart context filters
prjct workflow ["config"]  Configure hooks via natural language
prjct stop / restart     Background daemon control
prjct login / logout / auth   Cloud sync authentication
prjct update             Update CLI system-wide
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

Memory is FTS5-backed (SQLite) and persona-filtered. Every `remember`, `capture`, `ship`, and the SessionStart / Stop hooks regenerate the agent-readable markdown export at `~/Documents/prjct/<slug>/_generated/`.

> SQLite is the source of truth. The export is a snapshot — never hand-edit `_generated/`; if data is missing, fix the pipeline.

### Capture from any markdown editor

Drop a markdown file into `~/Documents/prjct/<slug>/captured/` with a YAML frontmatter:

```markdown
---
type: learning
tags:
  domain: auth
---
JWT refresh rotation needs the prior token's `iat` to detect replay.
```

The Stop hook (or `prjct context wiki sync`) ingests it into SQLite, then moves it to `captured/_ingested/<timestamp>/`. Works from Obsidian, vim, iA Writer, or anything that writes a `.md` file. Frontmatter is scanned for secrets before ingest.

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

Bring your own MCP — prjct doesn't duplicate trackers.

- **Linear**: configure the official Linear MCP in your agent and declare it in `persona.mcps`.
- **Jira**: same — use the official Atlassian MCP.

(The legacy v1 `linear` / `jira` sub-commands were removed in v2; MCP is the only path now.)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PRJCT_CLI_HOME` | `~/.prjct-cli` | Override global storage |
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

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)
- [Changelog](CHANGELOG.md)

## License

MIT
