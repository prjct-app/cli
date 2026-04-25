# prjct

**Context layer for AI coding agents.**

Works with Claude Code, Gemini CLI, Cursor IDE, Windsurf, OpenAI Codex, Antigravity, and more.

[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)]()
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-7C3AED)]()

## What is prjct?

prjct is the **context layer** your AI agents read before they write code. It keeps project memory (decisions, learnings, gotchas, shipped work) in a local SQLite database, builds code-intelligence indexes (BM25, import graph, git co-change), and feeds the right slice back to your agent through native hooks — no skills to remember, no prompts to copy-paste.

The contract is simple: **prjct exposes the WHAT, the agent decides the HOW.**

```
Claude Code / Gemini / Cursor                prjct
         |                                      |
         | SessionStart hook fires              |
         | -----------------------------------> |  reads .prjct/prjct.config.json
         |                                      |  resolves persona + memory + indexes
         |  You are <role> for <project>.       |
         |  Active task: …                      |
         |  Recent learnings: …                 |
         | <----------------------------------- |
         v                                      |
   Writes code / specs / updates                |
   with full project context                    |
```

State lives in SQLite. prjct also emits an **agent-readable markdown export** at `~/Documents/prjct/<slug>/_generated/` so any tool with `Read`/`Glob` (Claude Code, Gemini CLI, Cursor, your own scripts) can consume project context without a CLI round-trip. The export is a regenerated **snapshot** — never hand-edited; hooks rebuild it from the database. It happens to be a valid Obsidian vault, so you can browse it visually for free.

## Install

```bash
npm install -g prjct-cli
```

Requires Node.js 22.22.2+ or Bun 1.0+.

## Quick Start

```bash
# 1. One-time setup — configure AI providers + install commands into ~/.claude
prjct start

# 2. Initialize a project
cd my-project
prjct init

# 3. Install the 7 passive Claude Code hooks
prjct install

# 4. Open in Claude Code / Gemini CLI / Cursor and run:
p. sync                  # analyze the project; build indexes
```

Hooks now inject persona, active task, and topical memory automatically every session.

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
