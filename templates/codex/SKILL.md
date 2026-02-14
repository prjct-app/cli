---
name: prjct
description: Use when user mentions p., prjct, project management, task tracking, or workflow commands (sync, task, done, ship, pause, resume, next, bug, idea, dash).
---

# prjct — Context layer for AI agents

Grammar: `p. <command> [args]`

Supported commands:
`sync` `task` `done` `ship` `pause` `resume` `next` `bug` `idea` `dash`
`init` `setup` `verify` `status` `review` `plan` `spec` `test` `workflow`
`sessions` `analyze` `cleanup` `design` `serve` `linear` `jira` `git`
`history` `update` `merge` `learnings` `skill` `auth` `prd` `impact` `enrich`

Deterministic template resolution order for `p. <command>`:
1. `require.resolve('prjct-cli/package.json')` -> `{pkgRoot}/templates/commands/{command}.md`
2. `npm root -g` -> `{npmRoot}/prjct-cli/templates/commands/{command}.md`
3. Local fallback (dev mode) -> `{localPrjctCliRoot}/templates/commands/{command}.md`

If command is not in supported list:
- Return: `Unknown command: p. <command>`
- Include valid commands and suggest `prjct setup`

If command exists but template cannot be resolved:
- Block and ask for repair:
  - `prjct start`
  - `prjct setup`
- Do not continue with ad-hoc behavior.

Rules:
- Never commit to main/master directly
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- All storage through `prjct` CLI (SQLite internally)
- Start code tasks with `p. task` and follow Context Contract from CLI output
- Context7 MCP is mandatory for framework/library API decisions
