---
description: 'prjct CLI - Context layer for AI agents'
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

`task` `done` `ship` `sync` `init` `idea` `dash` `next` `pause` `resume` `bug` `linear` `feature` `prd` `plan` `review` `merge` `git` `test` `cleanup` `design` `analyze` `history` `enrich` `update`

## Action

NOW run `npm root -g` and read the command template.
