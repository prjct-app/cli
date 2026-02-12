---
name: prjct
description: Use when user mentions p., prjct, project management, task tracking, or workflow commands (sync, task, done, ship, pause, resume, next, bug, idea, dash).
---

# prjct — Context layer for AI agents

Commands: `p. sync` `p. task` `p. done` `p. ship` `p. pause` `p. resume` `p. bug` `p. dash` `p. next`

When user types `p. <command>`:
1. Run `npm root -g` to get npm root
2. Read template: `{npmRoot}/prjct-cli/templates/commands/{command}.md`
3. Execute the template step by step

Rules:
- Never commit to main/master directly
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- All storage through `prjct` CLI (SQLite internally)
