---
description: 'prjct CLI - Developer momentum tool'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
---

# prjct Command Router

**ARGUMENTS**: $ARGUMENTS

## Instructions

1. Parse ARGUMENTS: first word = `command`, rest = `commandArgs`
2. Get npm global root:
   ```bash
   npm root -g
   ```
3. Read template from npm package:
   ```
   {npmRoot}/prjct-cli/templates/commands/{command}.md
   ```
4. Execute template with `commandArgs` as input

## Example

ARGUMENTS = "task fix the login bug"
- command = "task"
- commandArgs = "fix the login bug"
- npm root -g → `/opt/homebrew/lib/node_modules`
- Read: `/opt/homebrew/lib/node_modules/prjct-cli/templates/commands/task.md`
- Execute with: "fix the login bug"

## Available Commands

**Core**: `task` `done` `ship` `pause` `resume`
**Project**: `init` `sync` `setup` `dash`
**Planning**: `plan` `prd` `spec` `design` `enrich`
**Queue**: `next` `idea` `bug`
**Integrations**: `linear` `jira` `github` `monday`
**Git**: `git` `merge` `review`
**Analysis**: `analyze` `history` `impact`
**Utils**: `cleanup` `update` `verify` `test` `undo` `redo` `serve` `auth` `skill`

## Action

NOW run `npm root -g` and read the command template.
