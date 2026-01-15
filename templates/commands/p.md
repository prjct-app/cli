---
description: 'prjct CLI - Developer momentum tool'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite, WebFetch]
---

# prjct Command Router

**ARGUMENTS**: $ARGUMENTS

## Instructions

1. Parse ARGUMENTS: first word = `command`, rest = `commandArgs`
2. Get npm global root:
   ```bash
   npm root -g
   ```
3. **Run Orchestrator** (for task-related commands):
   - Read: `{npmRoot}/prjct-cli/templates/agentic/orchestrator.md`
   - Execute orchestrator Steps 1-5 to load agents and skills
4. Read command template:
   ```
   {npmRoot}/prjct-cli/templates/commands/{command}.md
   ```
5. Execute template with `commandArgs` + orchestrator context

## Orchestrator Integration

For these commands, run orchestrator FIRST:
- `task`, `done`, `ship` - Core workflow
- `bug`, `plan`, `prd`, `spec`, `design` - Planning
- `review`, `merge` - Git operations

Skip orchestrator for:
- `init`, `sync`, `setup` - Project config (no task context)
- `dash`, `next`, `history` - Read-only views
- `linear`, `jira`, `github`, `monday` - Integrations (own logic)

## Example

ARGUMENTS = "task fix the login bug"

1. command = "task"
2. commandArgs = "fix the login bug"
3. npm root -g → `/opt/homebrew/lib/node_modules`
4. **Orchestrator**:
   - Analyze: "login bug" → domains: [frontend, backend]
   - Load agents: frontend.md, backend.md
   - Invoke skills: ui-design, api-design
5. Read: `/opt/homebrew/lib/node_modules/prjct-cli/templates/commands/task.md`
6. Execute with: "fix the login bug" + orchestrator context

## Available Commands

**Core**: `task` `done` `ship` `pause` `resume`
**Project**: `init` `sync` `setup` `dash`
**Planning**: `plan` `prd` `spec` `design` `enrich`
**Queue**: `next` `idea` `bug`
**Integrations**: `linear` `jira` `github` `monday`
**Git**: `git` `merge` `review`
**Analysis**: `analyze` `history` `impact`
**Utils**: `cleanup` `update` `verify` `test` `undo` `redo` `serve` `auth` `skill`

## Orchestrator Output

When orchestrator runs, output:

```
🎯 Task: {commandArgs}

📦 Context:
├── Agents: {loadedAgents}
├── Skills: {activeSkills}
└── Domain: {primaryDomain}
```

Then proceed with command execution.

## Action

NOW:
1. Run `npm root -g`
2. Check if command needs orchestrator
3. If yes: Read and execute orchestrator.md
4. Read the command template
5. Execute with full context
