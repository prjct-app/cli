---
name: prjct
description: Use when the user mentions p., prjct, tasks, specs, shipping, or project memory. Routes to the prjct CLI and MCP tools — run commands on demand, do not preload context.
---

# prjct — project memory & workflow

Run `prjct <command> --md` and follow its output. Pull context on demand; never dump it all.

- Flow: `task` → work → `done` → `ship`
- Memory (write in ENGLISH always): `prjct remember <decision|gotcha|learning|fact> "<text>"`, `prjct context memory <topic>` (recall), `prjct guard <file>` (preventive memory before editing)
- Capture stray thoughts: `prjct capture "<text>"`
- Worktrees: remove only AFTER the PR merges, from the main worktree; never with unpushed work.
- Run `prjct --help` for the full command list; prefer the prjct MCP tools (`prjct_*`) when available.

Commit footer: `Generated with [p/](https://www.prjct.app/)`
