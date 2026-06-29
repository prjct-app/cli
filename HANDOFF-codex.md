# Handoff → Codex

**Branch:** `feat/harness-pillars` (pushed to origin, **no PR yet**) · **Shipped:** v3.10.0 · **State:** green (1933 tests / tsc 0 / biome / knip 0).

You (Codex) are picking up the **agentic-Body redesign** of prjct. Read this top-to-bottom before touching code.

---

## 1. The one rule you cannot break (doctrine)

> **Intelligence is rented; the harness is owned.** prjct OWNS the Body (knowledge, roster, skills, rules) in SQLite and PROJECTS it to each host. **prjct never owns the loop/runtime** — the host (you, Codex) runs the loop, sandboxes, and code exec. Do NOT make prjct a runtime.

Also non-negotiable: **clean-repo** (a client repo's only prjct footprint is `.prjct/`; surfaces are regenerated projections, never hand-edited) · **no re-exports/barrels** (import from source) · every new field is **opt-in** (unset = prior behavior) · after every change: `bun test` + `npx tsc --noEmit -p core/tsconfig.json` + `npx biome check .` + `node scripts/build.js` + `npx knip` all green.

## 2. What shipped in this branch

The Body is organized **by organ**, model-agnostic, owned in SQLite, projected to every host:

- **Rig (Organ 6):** ONE capability→model SSOT (`core/schemas/model.ts` `PROVIDER_CAPABILITY_MODELS`); Claude tiers + provider lists all derived. Dead model systems/executor types deleted.
- **Agent catalog (Organ 4):** one roster (`CREW_ROLES` in `core/services/agent-dispatch.ts`) + `DispatchMechanism` (native Claude vs emulated rigs).
- **Master map (Organ 2):** `AGENTS.md`/`CLAUDE.md` map the organs + the one pull command each (`core/services/routing-block.ts`).
- **KB / Skills / Stop-Slop (Organs 1/3/5):** typed memory + projection; one skill body; `verify:` gates + dynamic auditor specialists.
- **Creation paths:** `prjct harness learn-from` (induction) + `prjct harness list|use <rig>` (steal-a-rig) — `core/commands/harness.ts`.
- **World-class loop mechanisms:** per-turn goal-discipline injection + turn-count escalation + predictive risk briefing at work-start + understanding-staleness on session-start.

### The 3 composition gaps (the latest work)
- **GAP 2 — per-specialist model routing:** `LensSpec.capabilityClass?` opt-in (`core/services/review-lenses.ts`) threads a `classOverride` through `renderModelDirective(ForProvider)` → a narrow lens runs on `fast`/haiku (3× cheaper intra-Claude; ~107× cross-rig SLM). All catalog lenses unset = balanced/sonnet unchanged.
- **GAP 1 — domain specialists:** a domain expert is an open-vocab lens whose name is a project domain (from `indexStorage.readDomainsSync` → `DomainDefinition`), rubric via `domainLensRubric`. `selectReviewers(content, domains)` / `renderAuditDispatch(..., domains)` in `core/services/spec-audit-dispatch.ts`; both CLI + MCP callers wired. No new LLM pass.
- **GAP 3 — hard loop stop for ALL rigs:** opt-in `config.maxTurnsPerCycle`. `core/services/loop-guard.ts` is the single verdict. The per-turn block escalates to ⛔ (every rig reads it) AND `core/hooks/pre-edit.ts` returns a **rig-agnostic PreToolUse deny** (`buildDenyOutput` + `_runner` `decide`) — any host honoring the contract blocks edits; others get the forceful injection. `prjct work --extend` lifts it by consent (`CurrentTask.turnLimitAcknowledgedAt`).

Benchmark (versioned): `bun scripts/bench-harness.ts`.

## 3. How YOU (Codex) run inside this harness

- Codex is an **emulated rig** (no native subagent tool): the multi-agent flows run as ONE agent playing roles in sequence — `buildEmulatedCrewProtocol` (`agent-dispatch.ts`). `prjct crew install` on Codex writes the emulated `CREW.md`, not `.claude/agents/`.
- **Model directives** render provider-correct for you via `renderModelDirectiveForProvider` (capability class → your rig's model, or "pick a fast/balanced model" for multi-model setups).
- **GAP 3 hard stop:** if your host honors a PreToolUse-style deny, the pre-edit hook blocks edits past `maxTurnsPerCycle`; if not, you still get the ⛔ forceful per-turn injection — respect it (stop, re-plan, or `prjct work --extend`).
- Pull everything from prjct, never assume: `prjct work --md`, `prjct context memory <topic>`, `prjct search "<q>"`, `prjct guard <file>`.

## 4. Verify the inherited state
```bash
bun test                                   # 1933 tests, 0 fail
npx tsc --noEmit -p core/tsconfig.json     # exit 0
npx biome check .                          # clean
npx knip --no-progress                     # 0 (no dead code)
node scripts/build.js                      # regenerates templates/skills surfaces
bun scripts/bench-harness.ts               # harness numbers
```

## 5. Open items / next steps
- **No PR yet** — branch is pushed; open the PR to `main` (`gh pr create`) when ready.
- 2 tasks pending + 30 inbox items in prjct (`prjct status --md`, `prjct capture` triage).
- v3.10.0 ALSO swept in 4 pre-existing codex-mcp files (`core/utils/codex-mcp.ts` + 2 tests, `AGENTS.md`) — confirmed green, intentionally kept.

## 6. Codex-specific gotchas (from prjct memory — verify before trusting)
- `mem_3723` — **Codex enforces a HARD ~1024-byte limit on the effective SKILL.md** (it counts the whole file). Over the limit = the ENTIRE skill is silently rejected and prjct won't load. Keep `templates/codex/SKILL.md` a minimal router well under 1024B (~870B installed). Verify the body+meta byte count after any skill change.
- `mem_3715` — a **stale daemon caches old hook code**; run `prjct daemon stop` and test via `bun bin/prjct.ts` (or `PRJCT_NO_DAEMON=1`) before trusting hook output.
- The repo's own `AGENTS.md` is a regenerated projection — it re-modifies after commits; don't hand-edit it, fix the generator.
