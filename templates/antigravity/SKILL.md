---
name: prjct
description: Use when user mentions p., prjct, task tracking, or workflow commands.
---

# prjct — Context layer for AI agents

Grammar: `p. <command> [args]` or `prjct <command> --md`

Core commands: sync, task, done, ship, pause, resume, next, bug, workflow, tokens
Integrations: linear, jira, enrich
Other: run `prjct <command> --md` and follow CLI output

Flow: idea → roadmap → next → task → done → ship → next (cycle until plan complete)

Rules:
- Persist everything (memories, captures, specs) in ENGLISH, whatever language the user speaks
- prjct runs → LLM generates relevant data → prjct stores it → LLM requests it from prjct → LLM uses it
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- All storage through `prjct` CLI (SQLite internally)
- Start code tasks with `p. task` and follow Context Contract from CLI output
- Worktree hygiene: if working in a git worktree, remove it AFTER its PR merges — `git worktree remove` from the main worktree; never with uncommitted/unpushed work, never `--force`
