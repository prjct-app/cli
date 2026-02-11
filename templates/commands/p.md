---
description: 'prjct CLI - Context layer for AI agents'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite, WebFetch]
---

# prjct Command Router

**ARGUMENTS**: $ARGUMENTS

All commands use the `p.` prefix.

## Quick Reference

| Command | Description |
|---------|-------------|
| `p. task <desc>` | Start a task |
| `p. done` | Complete current subtask |
| `p. ship [name]` | Ship feature with PR + version bump |
| `p. sync` | Analyze project, regenerate agents |
| `p. pause` | Pause current task |
| `p. resume` | Resume paused task |
| `p. next` | Show priority queue |
| `p. idea <desc>` | Quick idea capture |
| `p. bug <desc>` | Report bug with auto-priority |
| `p. linear` | Linear integration (via SDK) |
| `p. jira` | JIRA integration (via REST API) |

## Execution

```
1. PARSE: $ARGUMENTS → extract command (first word)
2. GET npm root: npm root -g
3. LOAD template: {npmRoot}/prjct-cli/templates/commands/{command}.md
4. EXECUTE template
```

## Command Aliases

| Input | Redirects To |
|-------|--------------|
| `p. undo` | `p. history undo` |
| `p. redo` | `p. history redo` |

## State Context

All state is managed by the `prjct` CLI via SQLite (prjct.db).
Templates should use CLI commands for data operations — never read/write JSON storage files directly.

## Error Handling

| Error | Action |
|-------|--------|
| Unknown command | "Unknown command: {command}. Run `p. help` for available commands." |
| No project | "No prjct project. Run `p. init` first." |
| Template not found | "Template not found: {command}.md" |

## NOW: Execute

1. Parse command from $ARGUMENTS
2. Handle aliases (undo → history undo, redo → history redo)
3. Run `npm root -g` to get template path
4. Load and execute command template
