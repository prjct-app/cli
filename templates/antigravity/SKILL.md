---
name: prjct
description: Use when user mentions p., prjct, task tracking, or workflow commands.
---

# prjct — Context layer for AI agents

Grammar: `p. <command> [args]` or `prjct <command> --md`

Core commands: sync, task, status, ship, workflow, spec, guard, capture, remember, context
Issue trackers: use MCP tools configured in the AI client
Other: run `prjct <command> --md` and follow CLI output

Flow: `prjct task` is the single normal entrypoint. Trivial work proceeds
directly. Substantive implementation work follows the persisted SDD/TDD
station from `prjct task --md` or `prjct status --md`: reviewed spec, tests
before implementation, then code.

Rules:
- Persist everything (memories, captures, specs) in ENGLISH, whatever language the user speaks
- prjct runs → LLM generates relevant data → prjct stores it → LLM requests it from prjct → LLM uses it
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- All storage through `prjct` CLI (SQLite internally)
- Start code tasks with `prjct task "<desc>" --md` and follow the CLI output
- Worktree hygiene: if working in a git worktree, remove it AFTER its PR merges — `git worktree remove` from the main worktree; never with uncommitted/unpushed work, never `--force`
