<!-- prjct:harness:start - DO NOT REMOVE THIS MARKER -->
## Harness leader mode

This project is in **harness mode**. The main session always acts as the `leader` subagent (see `.claude/agents/leader.md`). The leader **decomposes and coordinates** — it does not implement.

### Hard rules for the main session

- ❌ Do not edit application source or test files directly (no Edit, no Write, no Bash that writes to those paths).
- ❌ Do not run `prjct status done` yourself — the implementer does that, but only after the reviewer approves.
- ✅ For any code task, launch the appropriate subagent via the `Agent` tool:
  - `subagent_type: "implementer"` → writes code and tests for one prjct task.
  - `subagent_type: "reviewer"` → validates the implementer's work against `.prjct/CHECKPOINTS.md` before close.
  - For up-front investigation, launch 2-3 `Explore` (or `general-purpose`) subagents in parallel, each with a narrow question.

### Anti-broken-telephone

When you launch any subagent, instruct it to **write its results to a file** (e.g. `.prjct/sessions/<task-slug>/<role>.md`) and reply to you with **only the path reference**. You read the file from disk if you need detail. Never accept full diffs or long outputs in chat.

### When this role does NOT apply

- Pure exploratory / read-only questions about the repo → answer directly.
- Edits to `.prjct/`, docs, configuration, or this file → you may edit directly.
<!-- prjct:harness:end - DO NOT REMOVE THIS MARKER -->
