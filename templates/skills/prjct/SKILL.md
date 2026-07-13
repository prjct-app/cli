---
description: "AI Agile OS for coding agents: intent briefs, RAG context, synthesized memory, guardrails, performance, and ships. Run the prjct verb yourself; use `prjct work` normally."
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
- **Pattern supremacy:** style source = THIS repo (neighbor + `search`/`context memory`/Work scope). Sound pattern → **match**. Shit pattern → **propose upgrade**, do not spread garbage or foreign linter taste. Never make the client tutor basics already in the tree.
- **Skill ≠ project identity.** If skill and cwd disagree, trust cwd + `prjct context --md`.

### Cast + file scope (MUST)

- Multi-agent Cast names (explore→Popper · implement→Copernicus · review→McClintock): use as `description` / `prjct claim --as <Name>`.
- Before Grep/Glob: Work scope from `prjct work`, MCP `prjct_relevant_files`, or `prjct context memory` + `prjct guard <file>`. No blind tree walk when indexes exist.

### Core verbs (Tier 1=auto · 2=confirm)

| Signal | Verb | T |
|---|---|---|
| work / fix / build (DEFAULT) | `prjct work "<intent>"` | 2 |
| complex goals/stakes | `prjct intent` · `intent audit` | 2 |
| recall knowledge | `prjct search` / `context memory` | 1 |
| save judgment | `prjct remember <type> "…"` | 1 |
| file scope / traps | work scope · `guard <file>` · MCP relevant_files | 1 |
| ship | `prjct ship` | 2 |
| next / frontier | `prjct next --md` · `ready` · `claim` · `phases` | 1 |
| metrics | `prjct insights` · `performance` | 1 |
| land session | `prjct land` | 1 |
| test-first / intent-first | `prjct tdd` · `prjct sdd` (off\|assist\|strict) | 1 |
| workflows / packs | `prjct workflow list` · `prjct seed list` | 1 |

`prjct work` is the single normal entrypoint. Trivial work proceeds directly; substantive work follows a persisted intent + tests before implementation when required. Full verb map, loop-discipline, model policy → `workflows.md` (pull on demand).

### Knowledge

- Types: `decision · learning · gotcha · fact · context · …` plus the **sovereign knowledge base** facets `identity · voice · glossary · framework` — `prjct remember <facet>` / `prjct context memory <facet>`; never injected into CLAUDE.md / AGENTS.md. SQLite SoT; config at `.prjct/prjct.config.json`.
- Close: `prjct land` (auto hand-off) or `prjct remember context "Session close: …"`.

### Routing

- **Tier 1 — auto-execute.** search, remember, guard, insights, performance. One-line confirm; do not ask permission to save.
- **Tier 2 — confirm once.** work, intent, ship. Never ship without user OK.
- **Tier 3 — decision-brief.** prefs / hard forks — see `workflows.md`.

## Gotchas

- Empty recall ≠ nothing exists. Secrets refused unless `--force`. Do **not** wrap bin verbs (`sync`, `search`, `remember`) as `prjct work "…"`.
- **Skill curation**: Avoid bloat. Curate to a small set of high-leverage skills. Use `create-skill` to generate new ones on demand. Apply TDD principles when creating skills (test baseline behavior first, then write, refactor using rationalization tables and red flags). Keep frequent skills under tight token budgets.
- Worktree: remove only after PR *merged*, from main tree, never `--force` over dirty/unpushed work.

