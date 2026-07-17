---
description: "The agentic harness for AI coding agents: intent briefs, RAG context, synthesized memory, guardrails, performance, and ships. Run the prjct verb yourself; use `prjct work` normally."
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Task"]
user-invocable: true
---

# prjct

## Use when

Project memory, work cycles, ships, guardrails, or performance. **You run the verb — the user never types `prjct`.**

## What's here

Portable L0 — no project stamp. Identity is cwd-scoped (SessionStart / `prjct context --md`). Uninitialized tree: suggest `prjct init` once, then run the verb.

### Agent contract

- prjct remembers project state and shows the path; it does not own the execution.
- Agents decide HOW with native tools and judgment. Treat prjct output as durable signals: work, memory, intents, risks, performance.
- Persist via `prjct remember` / `work` / `performance` / `ship`. Author every memory in **ENGLISH**.
- **Verb dispatch:** tasks → `prjct work "…"`. Known cmds (`sync`/`search`/`remember`/`ship`/…) → `prjct <cmd> --md`. **Never** wrap a bin verb as `work "sync"`.
- **Sync analysis:** `analysis-save-llm` = schema v1 JSON (architecture/patterns/conventions). Markdown = thin notes only — no retry loop.
- **Pattern supremacy:** style source = THIS repo (neighbor + `search`/`context memory`/Work scope). Sound pattern → **match**. Shit pattern → **propose upgrade**, do not spread garbage or foreign linter taste. Never make the client tutor basics already in the tree.
- **Skill ≠ project identity.** If skill and cwd disagree, trust cwd + `prjct context --md`.

### Cast + file scope (MUST)

- Multi-agent Cast names (explore→Popper · implement→Copernicus · review→McClintock): use as `description` / `prjct claim --as <Name>`.
- Before Grep/Glob: `prjct work` / `prjct_relevant_files` / `prjct code trace` — no blind tree walk when indexes exist.
- **Synthesis discipline:** parent never says "based on findings" — hand implementers concrete file:line specs. **Continue** a worker when it already holds the edit files; **spawn fresh** for verify or a wrong approach.

### Core verbs (Tier 1=auto · 2=confirm)

| Signal | Verb | T |
|---|---|---|
| work (tasks only) | `prjct work "<intent>"` | 2 |
| intent | `prjct intent` / `audit` | 2 |
| recall | `prjct search` / `context memory` | 1 |
| remember | `prjct remember <type>` | 1 |
| sync | `prjct sync` | 1 |
| hygiene | `prjct dream` / `close` / `forget` | 1 |
| guard | `prjct guard <file>` | 1 |
| ship | `prjct ship` | 2 |
| next | `prjct next --md` | 1 |
| metrics | `prjct insights` / `performance` | 1 |
| land | `prjct land` | 1 |
| tdd/sdd | `prjct tdd` / `sdd` | 1 |
| workflows | `prjct workflow` / `seed` | 1 |

`prjct work` is the normal entrypoint **for task cycles only**. Known CLI verbs run bare. Full map in `workflows.md`.

### Knowledge

- Types: `decision · learning · gotcha · fact · context · …` plus the **sovereign knowledge base** facets `identity · voice · glossary · framework` — `prjct remember <facet>` / `prjct context memory <facet>`; never injected into CLAUDE.md / AGENTS.md. SQLite SoT; config at `.prjct/prjct.config.json`.
- Close: `prjct land` (Session close auto hand-off + dream when gates open) or living context via `prjct remember context`. Hygiene: `prjct dream` / `close` / `forget`.

### Routing

- **Tier 1 — auto-execute.** search, remember, sync, guard, insights, performance. One-line confirm; do not ask permission to save.
- **Tier 2 — confirm once.** work, intent, ship. Never ship without user OK.
- **Tier 3 — decision-brief.** prefs / hard forks — see `workflows.md`.

## Gotchas

- Empty recall ≠ nothing exists. Secrets refused unless `--force`.
- Worktree: remove only after PR merged, never --force over dirty work.

