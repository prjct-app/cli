---
description: 'prjct CLI - Developer momentum tool'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
---

# prjct Command Router

Route `p. <command>` to the appropriate prjct template.

## Instructions

**ARGUMENTS**: $ARGUMENTS

1. Parse ARGUMENTS: first word = `command`, rest = `commandArgs`
2. Find npm global root by running:
   ```bash
   npm root -g
   ```
   This returns a path like `/opt/homebrew/lib/node_modules` or `/usr/local/lib/node_modules`
3. Read template from the npm package location:
   ```
   {npmRoot}/prjct-cli/templates/commands/{command}.md
   ```
4. Execute that template with `commandArgs` as input

## Example

If ARGUMENTS = "task fix the login bug":
- command = "task"
- commandArgs = "fix the login bug"
- Run: `npm root -g` → `/opt/homebrew/lib/node_modules`
- Read: `/opt/homebrew/lib/node_modules/prjct-cli/templates/commands/task.md`
- Execute with: "fix the login bug"

## Fallback

If npm root fails, read from local cache: `~/.claude/commands/p/{command}.md`

## Available Commands

`task` `done` `ship` `sync` `init` `idea` `dash` `next` `pause` `resume` `bug` `linear` `feature` `prd` `plan` `review` `merge` `git` `test` `cleanup` `design` `analyze` `history` `enrich` `update`

## Action

NOW find npm root and read the command template.
