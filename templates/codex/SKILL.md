---
name: prjct
description: Use for prjct AI Agile work/memory. Run prjct verbs yourself; do not preload context.
---

# prjct

Run `prjct <cmd> --md` and follow it.

- prjct is a RAG-backed project memory harness; do not preload project history.
- Pull relevant context with `prjct work/search/context/guard`; read only what surfaces before planning/editing.
- Vault `_generated/` is a SQLite snapshot fallback, not something to load wholesale.
- Save memory in English: `prjct remember <decision|learning|gotcha|context> "<text>"`.
- On close: complete the work cycle, then write synthesized context with model/tokens when known. Raw detector output is input, not final context.
- Ship only after user OK: `prjct ship --md`.

Commit footer: `Generated with [p/](https://www.prjct.app/)`
