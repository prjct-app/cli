# Browser Daemon — Design Note (Fase E, NOT implemented)

## Status

**Decision gate.** This document scopes what it would take to bring gstack's
browser-daemon capability into prjct. No code shipped. Read this and decide:

- **Adopt** — green-light a multi-PR build (~4–6 weeks part-time).
- **Defer** — keep the design here, ship when it's actually blocking us.
- **Skip permanently** — declare prjct's scope as CLI + memory + workflows;
  point users at `gstack` for browser tooling.

The current recommendation is **defer**. Browser tooling is gstack's
biggest single capability (~3K LOC + Chromium + Playwright + an in-process
ML classifier). It is also gstack's biggest single dependency surface.
prjct can ship 80% of the agentic value (subagents, audit, retro, health,
context-save, prefs, memory dedupe) without it. We only build this when the
absence is the actual blocker for a real workflow.

---

## What gstack does

`gstack/browse/` is a compiled Bun binary (~58MB, `bun build --compile`)
that runs as a long-lived headless Chromium daemon. The CLI talks to it
over `localhost:<random-port>` HTTP with a Bearer token; the daemon
auto-starts on first command, auto-shuts down after 30 min idle.

Skills built on top of the daemon:

- `/qa` — drives a real browser through the user's app, finds bugs,
  files atomic fixes with regression tests
- `/scrape` — navigate, snapshot, extract; codify successful flows via
  `/skillify` so the next call drops from ~30s to ~200ms
- `/canary` — post-deploy live-app monitoring (console errors, perf
  regressions, page failures)
- `/design-review` — visual audit + atomic-commit fix loop
- `/setup-browser-cookies` — import cookies from real Chromium so the
  headless session is logged in to the same accounts

The daemon also exposes:

- A snapshot system with ref-based element selection (`@e1`, `@e2`,
  `@c1`) — built on Playwright Locators against the accessibility tree
  rather than DOM mutation, so it survives CSP, React/Vue hydration,
  and Shadow DOM.
- A ngrok-fronted "pair-agent" mode for remote AI agents (OpenClaw,
  another machine) to drive the browser via a scoped-token tunnel
  with a separate locked-down listener (port-isolation security).
- A 6-layer prompt-injection defense for the sidebar agent: content
  marking, hidden-element strip, ARIA regex blocklist, ML classifier
  (TestSavantAI BERT-small ONNX, opt-in DeBERTa-v3 ensemble), Claude
  Haiku transcript classifier, canary-token leak detector, and
  ensemble verdict combiner. Local-only, no network calls in the
  hot path.

## What it would mean for prjct

### Scope estimate

| Subsystem | LOC est. | Native deps | Notes |
|---|---|---|---|
| HTTP daemon (Bun.serve) | 600 | — | 8–10 routes, Bearer auth, state file |
| Chromium / Playwright glue | 800 | `playwright` | tab management, cookies, screenshots |
| CDP wrapper (cookie decrypt) | 400 | `bun:sqlite` | Chromium cookie DB; macOS Keychain |
| Snapshot + ref system | 400 | — | accessibility-tree → @ref Locator map |
| Browser-skills runtime | 350 | — | codify scrape flows, replay |
| Prompt-injection defense | 600 | `onnxruntime-node`, BERT/DeBERTa | runs in agent process only |
| Pair-agent + ngrok tunnel | 250 | — | dual-listener with port-isolated allowlist |
| `/qa`, `/scrape`, `/canary` skills | 600 | — | three skill bodies |
| Tests | 400 | — | smoke + per-route auth + injection |
| **Total** | **~3,400** | 3 native deps | |

### Risk flags

1. **Native binary distribution.** prjct currently distributes via npm as
   a dual-runtime package (bun preferred, node fallback) with no native
   bindings. Adding `playwright` + `onnxruntime-node` adds ~300MB to
   `npm install`, plus per-OS native compilation. Either accept the
   weight or split into a separate `prjct-browser` package.
2. **Chromium maintenance.** Playwright pins a Chromium version; we
   inherit its security patch cadence. `gstack-upgrade` is gstack's
   answer; we'd need an equivalent.
3. **Cookie security boundary.** Cookie import requires reading the
   user's real Chromium SQLite + invoking the macOS Keychain. Our
   first-import flow needs explicit user consent (Keychain dialog
   already handles this) and a privacy doc.
4. **Prompt-injection defense is non-trivial.** The 6-layer model
   (content security + ML classifier + canary token) is what makes
   it safe to grant the sidebar agent Bash + Read + Glob + WebFetch.
   Skipping it would leave a real RCE-class attack surface in any
   browse-driving skill that takes web content as input.
5. **scope creep.** Once the daemon ships, `/qa`, `/canary`, and
   friends are easy adds. But `/design-review`, `/scrape` codification,
   and `/skillify` each carry their own ~500-line skill bodies. Easy
   to grow this to ~6–8K LOC over a quarter without noticing.

### Architecture sketch

If we did build it, the layout that fits prjct best:

```
core/
  daemon/
    browser.ts          ← new — Bun.serve, port 10000-60000, state file
    browser-state.ts    ← new — ~/.prjct-cli/state/browse.json
    routes/             ← new — /command, /snapshot, /tunnel/*, /health
  services/
    browser/            ← new
      snapshot.ts       ← ref system (accessibility tree → @e<n>)
      cookie-import.ts  ← Chromium SQLite + Keychain
      playwright.ts     ← thin Locator wrapper
  commands/
    qa.ts               ← new — uses daemon via HTTP
    scrape.ts           ← new
    canary.ts           ← new
    setup-browser-cookies.ts ← new
  hooks/
    browser-injection-defense.ts ← new — runs in agent before tool dispatch
```

A separate `dist/browser/` build target produces the standalone binary so
`prjct` itself stays light. First call lazy-spawns it via `child_process.fork`.

### Decision criteria — when to build

Build it when at least TWO of these are true:

- A real prjct user reports they're using gstack alongside prjct just for
  the browser, and the workflow seam hurts.
- We have a feature that NEEDS live-browser semantics (e.g. testing a
  generated UI, scraping a 3rd-party doc into memory).
- We're confident enough about the ML classifier story that we'd ship
  injection defense from day one (no MVP that skips L4).

Until then: this design doc is the answer. Pointing users at
`garrytan/gstack` is a perfectly good integration story for the browser
slice.

---

## What we already shipped from gstack

For context — Fase A through D (in `main` history):

| Pattern | Where |
|---|---|
| Subagent dispatch + audit orchestrator + decision-brief | PR #291 (skill-generator.ts) |
| Builder ethos preamble | PR #292 (skill-generator.ts) |
| Memory dedupe by `(type, key)` | PR #292 (project-memory.ts) |
| Question preferences (`prjct prefs`) | PR #293 |
| `prjct retro` (weekly retrospective) | PR #294 |
| `prjct health` (composite quality dashboard) | PR #295 |
| `prjct context-save` / `context-restore` | PR #296 |

Total adopted: ~7 patterns × 5 PRs ≈ 1,500 LOC + 30 new tests. Browser
daemon is the last big one.
