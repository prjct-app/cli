<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Context layer for AI agents

Skills auto-activate for: task, status, ship, sync, workflow, spec, guard, capture, remember, context
Other commands: run `prjct <command> --md` and follow CLI output

Flow: idea → spec when warranted → task → work → status done → ship

Data:
- prjct runs → LLM generates relevant data → prjct stores it → LLM requests it from prjct → LLM uses it
- prjct remembers and shows the path; the agent decides how to execute with its own native tools
- Treat prjct output as signals, not a prescriptive harness
- Commit footer: `Generated with [p/](https://www.prjct.app/)`
- Path resolution: `.prjct/prjct.config.json` → `~/.prjct-cli/projects/{projectId}`
- Storage: `prjct` CLI (SQLite internally)
- Worktree hygiene: if working in a git worktree, remove it AFTER its PR merges — `git worktree remove` from the main worktree; never with uncommitted/unpushed work, never `--force`

Crew (opt-in via `prjct crew install`): Leader (blue) · Implementer (purple) · Reviewer (pink). Subagent dispatch is Claude-Code-only; in Antigravity, identify the role you are playing explicitly.

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
