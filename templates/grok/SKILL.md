---
name: prjct
description: prjct work cycles + memory; run prjct verbs, do not preload context. Use when the user wants project memory, work cycles, ships, guardrails, or performance.
---

# prjct

Run `prjct <cmd> --md` and follow it. Grok is the Brain; prjct is the Body (SQLite memory + work cycles).

- prjct is a RAG-backed project memory harness; do not preload project history.
- `prjct work "<intent>" --md` is the single entrypoint — recognize intent and run the verb yourself.
- Pull only what surfaces: `prjct search` / `context memory` / `guard` / MCP — not something to load wholesale.
- Save synthesized memory in English: `prjct remember <decision|learning|gotcha|context> "<text>"`.
- KB (`identity/voice/glossary/framework`): `remember <facet>` / `context memory <facet>` — on demand, never injected here.
- Ship only after user OKs: `prjct ship --md`.
- Loop: land; H2+ intent; tip→user SoT; close.
- L0 portable; id=cwd.
- Prefer MCP `prjct_*` tools when available; do not rely on Grok experimental memory alone.
- Ambiguous approach → `prjct plan "<title>"` (read-only until `prjct plan approve`); do not edit source while plan is draft.

Commit footer: `Generated with [p/](https://www.prjct.app/)`
