---
description: 'prjct CLI - Developer momentum tool'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
---

# prjct Command Router

Route `p. <command>` to the appropriate prjct command.

## Instructions

**ARGUMENTS**: $ARGUMENTS

1. Parse ARGUMENTS: first word = `command`, rest = `commandArgs`
2. Read the template file: `~/.claude/commands/p/{command}.md`
3. Execute that template with `commandArgs` as the task description

## Example

If ARGUMENTS = "task fix the login bug":
- command = "task"
- commandArgs = "fix the login bug"
- Read: `~/.claude/commands/p/task.md`
- Execute with: "fix the login bug"

## Available Commands

`task` `done` `ship` `sync` `init` `idea` `dash` `next` `pause` `resume` `bug` `spec` `suggest` `git` `test` `cleanup` `design` `analyze` `undo` `redo`

## Action

NOW read the command template and execute it.
