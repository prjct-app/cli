# AGENTS.md

AI assistant guidance for **prjct-cli** - context layer for AI coding agents. Works with Claude Code, Gemini CLI, and more.

## What This Is

**NOT** project management. NO sprints, story points, ceremonies, or meetings.

**IS** a context layer that gives AI agents the project knowledge they need to work effectively.

---

## Dynamic Agent Generation

Generate agents during `p. sync` based on analysis:

```javascript
await generator.generateDynamicAgent('agent-name', {
  role: 'Role Description',
  expertise: 'Technologies, versions, tools',
  responsibilities: 'What they handle'
})
```

### Guidelines
1. Read `analysis/repo-summary.md` first
2. Create specialists for each major technology
3. Name descriptively: `go-backend` not `be`
4. Include versions and frameworks found
5. Follow project-specific patterns

## Architecture

**Global**: `~/.prjct-cli/projects/{id}/`
```
prjct.db   # SQLite database (all state)
context/   # now.md, next.md
agents/    # domain specialists
```

**Local**: `.prjct/prjct.config.json` (read-only)

## Commands

| Command | Action |
|---------|--------|
| `p. init` | Initialize |
| `p. sync` | Analyze + generate agents |
| `p. task X` | Start task |
| `p. done` | Complete subtask |
| `p. ship` | Ship feature |
| `p. next` | Show queue |

## Intent Detection

| Intent | Command |
|--------|---------|
| Start task | `p. task` |
| Finish | `p. done` |
| Ship | `p. ship` |
| What's next | `p. next` |

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
| Leader | Orchestrator | cyan |
| Implementer | Worker | green |
| Reviewer | Strict auditor | red |

Crew SUBAGENT DISPATCH is Claude Code only (only Claude Code currently exposes an Agent tool that can spawn typed subagents). In Codex / Gemini / Cursor / Windsurf the roster above is informational — the same session plays whichever role the prompt names; identify it explicitly when you reply ("acting as Implementer").
