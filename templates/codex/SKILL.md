---
name: prjct
description: Use for prjct task/memory/workflow. Run prjct verbs yourself; do not preload context.
---

# prjct

Run `prjct <cmd> --md` and follow it.

- Start work: `prjct task "<desc>" --md`; read the surfaced second-brain context before planning/editing.
- Recall: `prjct context memory <topic>` / `prjct search "<query>"`; guard files with `prjct guard <file>`.
- Save memory in English: `prjct remember <decision|learning|gotcha|context> "<text>"`.
- On close: `prjct status done --md`, then write context: synthesis first; key data for UI; what happened/why/who/model/tokens/sentiment/files/feature/pattern/anti-pattern/decision/outcome/next. Raw detector output is input, not final context.
- Ship only after user OK: `prjct ship --md`.

Commit footer: `Generated with [p/](https://www.prjct.app/)`
