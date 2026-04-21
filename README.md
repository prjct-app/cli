# prjct

**Persona-aware context broker for AI coding agents.**

Works with Claude Code, Gemini CLI, OpenAI Codex, Antigravity, Cursor IDE, Windsurf, and more.

[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)]()
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![OpenAI Codex](https://img.shields.io/badge/OpenAI%20Codex-Ready-10A37F)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-7C3AED)]()

> **v2.x is alpha.** Install with `npm install -g prjct-cli@alpha`. v1.56.x remains on `latest` while the v2 surface stabilizes.

## What is prjct?

prjct is a **context broker**, not a task manager. It declares **who your agent is in this project** (PM, founder, DEV, research…), routes the right MCPs + memory types + workflow slots for that persona, and feeds everything back to the LLM through native hooks — no skills to remember, no prescriptive pipelines.

The contract is simple: **prjct exposes the WHAT, the agent decides the HOW.**

```
Claude Code / Gemini / Cursor                prjct
         |                                      |
         | SessionStart hook fires              |
         | -----------------------------------> |  reads .prjct/prjct.config.json
         |                                      |  resolves persona + memory + MCPs
         |  You are <role> for <project>.       |
         |  MCPs: Linear, PostHog.              |
         |  Recent insights: …                  |
         | <----------------------------------- |
         v                                      |
   Writes code / specs / updates                |
   with full project context                    |
```

## Install

```bash
# v2 alpha (recommended for early adopters)
npm install -g prjct-cli@alpha

# v1 stable (backwards-compatible)
npm install -g prjct-cli
```

## Quick Start

```bash
# 1. One-time global setup (installs routers, MCP config, skills)
prjct start

# 2. Initialize your project with a persona + pack
cd my-project
prjct init --pack code,daily            # DEV persona, default
prjct init --pack pm,research,daily     # PM persona
prjct init --pack founder,daily         # Founder persona

# 3. Install Claude Code hooks (7 passive hooks in ~/.claude/settings.json)
prjct install

# 4. Open in your agent and work normally — hooks inject context automatically.
```

### Core verbs

| Verb | What it does |
|---|---|
| `prjct capture "<anything>"` | GTD-style universal inbox. Bare `prjct "<text>"` also routes here. |
| `prjct task "<desc>"` / `prjct task` | Register a task or show the active one. |
| `prjct tag <k:v>` | Tag the active task (`type:bug`, `domain:auth`, …). |
| `prjct status <value>` | Inline status change on the active task. |
| `prjct remember <type> "<content>"` | Persist a memory entry (fact, decision, learning, insight, …). |
| `prjct ship [name]` | Run the project's `ship` workflow (commit, push, PR, persist shipped). |
| `prjct workflow run <name>` | Run any registered workflow (`script`, `mcp`, `persona:context` steps). |
| `prjct seed <add\|list>` | Manage packs (persona, memory types, workflow slots). |
| `prjct sync` | Sync project state and regenerate skills / wiki. |

### Inside Claude Code / Gemini CLI

```bash
p. capture "llamar a Ana re: pricing"
p. task "add OAuth refresh"
p. remember decision "we chose JWT + refresh rotation"
p. ship "auth"
```

Cursor / Windsurf use the same commands with `/` prefix: `/capture`, `/task`, `/ship`.

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

Slots ship **empty** — the human or the agent authors the scripts on demand.

## Hooks (v2, opt-in)

`prjct install` writes 7 passive hooks to `~/.claude/settings.json`. They inject `additionalContext`; none of them block unless a hand-rolled workflow rule says so.

| Event | Injects |
|---|---|
| `SessionStart` | Persona + active task + last 3 learnings |
| `UserPromptSubmit` | Topical recall from memory (≤500 chars) |
| `PreToolUse` (Bash git commit) | Surfaces anti-patterns tagged with touched files |
| `PostToolUse` (Edit/Write) | Silently annotates `files_touched` on active task |
| `Stop` | Async prompt: "learned anything reusable?" |
| `SubagentStart` | Injects persona + memories for fresh-brain subagents |
| `CwdChanged` | Re-contextualizes on project switch |

`prjct uninstall` cleanly removes them.

## MCP Server

prjct exposes an MCP server with 5 tool groups (was 9 in v1):

| Group | Tools |
|---|---|
| **memory** | `prjct_mem_save`, `_list`, `_similar`, `_forget` |
| **project** | `prjct_patterns`, status, summary |
| **files** | `prjct_files`, `prjct_recent` |
| **workflow** | `prjct_workflow_list`, `_run`, `_log` |
| **code-intel** | `prjct_related`, `_impact`, `_stale` |

The broker model: if you already have `linear`, `jira`, `posthog`, `gmail` MCPs wired, prjct **does not duplicate them** — it just tells Claude they're available for the current persona and caches your insights locally.

## CLI

```bash
prjct start              First-time setup wizard
prjct init [--pack …]    Initialize project with persona + packs
prjct install            Install Claude Code hooks
prjct uninstall          Remove hooks / complete uninstall
prjct sync               Sync project state + regenerate wiki
prjct serve              Start web dashboard (port 3478)
prjct watch              Auto-sync on file changes
prjct doctor             Check system health
prjct hooks              Manage git hooks for auto-sync
prjct context            Smart context filtering for agents
prjct stop / restart     Background daemon control
prjct update             Update CLI system-wide
prjct --version / --help
```

## Memory

14 built-in types + user-defined lowercase identifiers:

`fact`, `decision`, `learning`, `gotcha`, `pattern`, `anti-pattern`, `shipped`, `inbox`, `todo`, `idea`, `insight`, `question`, `source`, `person` — plus anything you invent (`recipe`, `workout`, `interview`, …).

```bash
prjct remember decision "we chose SQLite because app is local"
prjct capture "check why webhook retries on 502"
prjct memory list --type insight --since 2026-04-01
prjct memory similar "auth refresh"
```

Memory is FTS5-backed (SQLite), persona-filtered by default, and regenerated into an Obsidian-compatible wiki at `.prjct/wiki/_generated/` on each `remember` / `ship` / `sync`.

## Workflows

Workflow slots declared by packs are **empty scripts**. You (or the agent) fill them:

```bash
prjct workflow list             # shows `ship (unassigned)`, `review (unassigned)`, …
prjct workflow edit ship        # opens in $EDITOR

# Or: ask the agent — "Claude, author me a ship.sh for investor updates"
# It reads the pack manifest + memory, authors the script, you approve.
```

Three step types beyond plain bash actions:

- `script:<path>` — runs `.prjct/workflows/<path>.sh` with `PRJCT_BRANCH`, `PRJCT_FILES_CHANGED`, `PRJCT_TAGS` in env.
- `mcp:<server>:<tool>` — calls an MCP tool and passes the result to the next step.
- `persona:context` — re-injects the persona block mid-workflow.

Declarative `when_expr` filters (`tags:key=value`, `branch~main`, `files:*.ts`) survived the v2 sweep — the bilingual NL parser did not.

## Code Intelligence

`prjct sync` builds three indexes:

| Index | Purpose |
|---|---|
| BM25 | Full-text search over names, symbols, comments |
| Import graph | Forward + reverse dependency edges |
| Git co-change | Files that change together |

These power `prjct_related`, `prjct_impact`, and `prjct_stale` in the MCP.

## Web Dashboard

```bash
prjct serve
```

Hono-based HTTP server on port 3478. REST API for tasks / ideas / roadmap / shipped, SSE for real-time updates, status bar endpoint for IDE integration.

## Issue Tracker Integration

Bring your own MCP — prjct doesn't duplicate trackers.

- **Linear**: configure the official Linear MCP in your agent, declare it in `persona.mcps`.
- **Jira**: same — use the official Atlassian MCP.
- The `linear` and `jira` CLI sub-commands are v1 helpers kept for backwards compat; MCP is the v2 path.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PRJCT_CLI_HOME` | `~/.prjct-cli` | Override global storage |
| `PRJCT_DEBUG` | — | Enable debug logging (`1`, `true`, log level) |
| `PRJCT_NO_DAEMON` | — | Force non-daemon path (debugging) |
| `DEBUG` | — | Fallback debug flag |
| `CI` | — | Skips interactive prompts |

## Architecture

```
prjct-cli/
  bin/prjct              Thin JS shim (daemon-first)
  core/
    commands/            CLI command handlers
    hooks/               7 passive Claude Code hook subcommands
    packs/               Pack manifests + pack-manager
    mcp/                 MCP server (5 tool groups)
    memory/              projectMemory (v2 unified surface)
    workflow/            Engine + state-machine + when-evaluator
    domain/              BM25, import-graph, git-cochange
    services/            sync, skill-generator, wiki-generator
    storage/             SQLite (one DB per project)
    schemas/             Zod — source of truth
    daemon/              Background daemon (file watching)
    server/              Hono HTTP + SSE
    sync/                Cloud sync client
  templates/
    packs/               JSON pack manifests
    global/              Per-editor router templates
```

## Requirements

- Node.js 22.22.2+ or Bun 1.0+
- One of: Claude Code, Gemini CLI, OpenAI Codex, Antigravity, Cursor IDE, Windsurf

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)
- [Changelog](CHANGELOG.md)

## License

MIT
