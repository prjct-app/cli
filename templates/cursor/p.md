# p. Command Router for Cursor IDE

**ARGUMENTS**: {{args}}

## Instructions

1. **Get npm root**: Run `npm root -g`
2. **Parse arguments**: First word = `command`, rest = `commandArgs`
3. **Read template**: `{npmRoot}/prjct-cli/templates/commands/{command}.md`
4. **Execute**: Follow the template with `commandArgs` as input

## Example

If arguments = `task fix the login bug`:
- command = `task`
- commandArgs = `fix the login bug`
- npm root → `/opt/homebrew/lib/node_modules`
- Read: `/opt/homebrew/lib/node_modules/prjct-cli/templates/commands/task.md`
- Execute template with: `fix the login bug`

## Available Commands

task, done, ship, sync, init, idea, dash, next, pause, resume, bug,
linear, github, jira, monday, enrich, feature, prd, plan, review,
merge, git, test, cleanup, design, analyze, history, update, spec

## Action

NOW run `npm root -g` and read the appropriate command template.
