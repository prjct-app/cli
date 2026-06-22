# AGENTS.md

AI assistant guidance for **prjct-cli** - context layer for AI coding agents. Works with Claude Code, Codex, Gemini CLI, OpenCode, Qwen Code, Cline, Cursor, Windsurf, and any AGENTS.md-aware runtime.

## What This Is

**NOT** project management. NO sprints, story points, ceremonies, or meetings.

**IS** a context layer that gives AI agents the project knowledge they need to work effectively.

---

## Agent Contract

Run `prjct <command> --md` and follow the CLI output. Prefer `prjct_*` MCP tools when the active client exposes them.

## Architecture

**Global**: `~/.prjct-cli/projects/{id}/`
```
prjct.db   # SQLite database (all state)
agents/    # domain specialists
```

**Local**: `.prjct/prjct.config.json` (read-only)

## Commands

| Command | Action |
|---------|--------|
| `prjct init` | Initialize |
| `prjct sync --md` | Analyze + refresh agent context |
| `prjct task "X" --md` | Start task |
| `prjct status done --md` | Complete active task |
| `prjct ship --md` | Ship feature |
| `prjct status --md` | Show current task/workflow state |

## Intent Detection

| Intent | Command |
|--------|---------|
| Start task | `prjct task "<desc>" --md` |
| Finish | `prjct status done --md` |
| Ship | `prjct ship --md` |
| What's active | `prjct status --md` |

## Implementation

- Atomic operations via `prjct` CLI
- CLI handles all state persistence (SQLite)
- Handle missing config gracefully

## Crew mode (opt-in)

Projects that want a multi-agent workflow can run `prjct crew install` to drop a leader/implementer/reviewer trio into `.claude/agents/`, a project `CHECKPOINTS.md`, and a CLAUDE.md snippet that locks the main session into orchestrator role. Templates live in `templates/crew/`. Uninstall with `prjct crew uninstall`. Strictly opt-in — not invoked by `init`/`sync`.

### Crew roster

Each member has a stable name + color so you can identify who is acting at a glance, in any LLM. Source of truth: `templates/crew/registry.json`.

| Name | Role | Color |
|---|---|---|
| Leader | Orchestrator | blue |
| Implementer | Worker | purple |
| Reviewer | Strict auditor | pink |

Crew SUBAGENT DISPATCH is Claude Code only (only Claude Code currently exposes an Agent tool that can spawn typed subagents). In Codex / Gemini / Cursor / Windsurf the roster above is informational — the same session plays whichever role the prompt names; identify it explicitly when you reply ("acting as Implementer").
