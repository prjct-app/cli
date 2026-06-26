<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Context layer for AI agents

Skills auto-activate for: work, intent, ship, sync, guard, remember, search, insights, performance
Other commands: run `prjct <command> --md` and follow CLI output

Flow: `prjct work` is the single normal entrypoint. Trivial work proceeds
directly. Substantive implementation work follows the persisted AI Agile
station from `prjct work --md`: reviewed intent, evidence, tests when
required, then code.

Data:
- Persist everything (memories, context, intents) in ENGLISH, whatever language the user speaks
- prjct is a RAG-backed project memory harness; do not preload project history into this file
- Pull only relevant context with `prjct work`, `prjct search`, `prjct context memory`, `prjct guard`, or MCP tools
- The vault `_generated/` is a regenerated SQLite snapshot for Read/Glob fallback, not the source of truth and not something to load wholesale
- On close, save synthesized context; raw quotes, counters, detector rows, and transcript chunks are inputs, not final memory
- prjct remembers and shows the path; the agent decides how to execute with its own native tools
- Treat prjct output as signals, not a prescriptive harness
- Commit footer: `Generated with [p/](https://www.prjct.app/)`
- Path resolution: `.prjct/prjct.config.json` → `~/.prjct-cli/projects/{projectId}`
- Storage: `prjct` CLI (SQLite internally)
- Worktree hygiene: if working in a git worktree, remove it AFTER its PR merges — `git worktree remove` from the main worktree; never with uncommitted/unpushed work, never `--force`

Crew (opt-in via `prjct crew install`): Leader (blue) · Implementer (purple) · Reviewer (pink). Subagent dispatch is Claude-Code-only; in Antigravity, identify the role you are playing explicitly.

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
