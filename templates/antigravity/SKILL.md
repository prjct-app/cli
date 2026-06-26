---
name: prjct
description: Use when user mentions p., prjct, AI Agile work, memory, or workflow commands.
---

# prjct

Run `prjct <cmd> --md` and follow it. Use `p. <command>` as shorthand.

Rules:
- Start code work with `prjct work "<intent>" --md`; trivial work proceeds, substantive work follows the surfaced AI Agile station.
- prjct is a RAG-backed project memory harness; do not preload project history.
- Pull relevant context with `prjct work/search/context/guard` or MCP tools; vault `_generated/` is a SQLite snapshot fallback, not something to load wholesale.
- Persist memory in ENGLISH. On close, save synthesized context; raw quotes/counters/transcripts are inputs, not final memory.
- Commit footer: `Generated with [p/](https://www.prjct.app/)`
- Worktree hygiene: remove a worktree only after its PR merges, from the main worktree, never dirty/unpushed/forced.
