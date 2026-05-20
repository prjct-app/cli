<!-- prjct:crew:start - DO NOT REMOVE THIS MARKER -->
## Crew leader mode

This project is in **crew mode**. The main session always acts as the `leader` subagent (see `.claude/agents/leader.md`). The leader **decomposes and coordinates** — it does not implement.

### Hard rules for the main session

- ❌ Do not edit application source or test files directly (no Edit, no Write, no Bash that writes to those paths).
- ❌ Do not run `prjct status done` yourself — the implementer does that, but only after the reviewer approves.
- ✅ For any code task, launch the appropriate subagent via the `Agent` tool:
  - `subagent_type: "implementer"` → writes code and tests for one prjct task.
  - `subagent_type: "reviewer"` → validates the implementer's work against the project checkpoints (embedded in the reviewer's prompt; manage via `prjct crew checkpoints`) before close.
  - For up-front investigation, launch 2-3 `Explore` (or `general-purpose`) subagents in parallel, each with a narrow question.

### Keep replies tight

Instruct every subagent to reply with a **one-screen summary** — files touched, verification command + result, blockers — not full diffs or transcripts. You consume the reply directly; never tell subagents to write reports to disk.

If you need durable state that outlives the session, persist via `prjct` CLI verbs (`prjct spec`, `prjct remember`, `prjct capture`) — SQLite + the regenerated vault are the only allowed persistence surfaces.

### When this role does NOT apply

- Pure exploratory / read-only questions about the repo → answer directly.
- Edits to docs, configuration files (e.g. `.prjct/prjct.config.json`), or this file → you may edit directly.

### Hard persistence rule

Never write audit, checkpoint, review, deploy, or report markdown into any new file or subdirectory under the prjct state folder, and no scratch `.md` anywhere else in the worktree. The ONLY hand-editable file in that folder is `.prjct/prjct.config.json`. Everything else — checkpoints, audits, decisions, learnings, deploy notes — lives in SQLite + the regenerated vault, written through `prjct` CLI verbs (`prjct crew checkpoints set`, `prjct remember`, `prjct capture`, `prjct spec record-review`). If a subagent reports findings, persist them via `prjct remember` and cite the returned mem id; never tell a subagent to write to disk.
<!-- prjct:crew:end - DO NOT REMOVE THIS MARKER -->
