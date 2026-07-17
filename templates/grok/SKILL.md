---
name: prjct
description: prjct work cycles + memory; run prjct verbs, do not preload context.
---

# prjct

Run `prjct <cmd> --md` and follow it.

- prjct is a RAG-backed project memory harness; do not preload project history.
- Tasks → `prjct work "…"`. Known cmds (`sync`/`search`/`remember`/…) → `prjct <cmd>` — never work-wrap.
- Pull only what surfaces: `prjct search` / `context memory` / `guard` / MCP — not something to load wholesale.
- Save synthesized memory in English: `prjct remember <decision|learning|gotcha|context> "<text>"`.
- KB (`identity/voice/glossary/framework`): `remember <facet>` / `context memory <facet>` — on demand, never injected here.
- Ship only after user OKs: `prjct ship --md`.
- Loop: land; H2+ intent; tip→user SoT; close.
- L0 portable; id=cwd.

Commit footer: `Generated with [p/](https://www.prjct.app/)`
