# Spec template — `prjct spec`

A spec frames a piece of work BEFORE implementation. Cheap to write, cheap to revise; un-doing implementation isn't.

The fields below match `core/types/spec.ts`. Validation is enforced by Zod at write time.

---

## Title (one line)

What you'd say to a coworker walking by your desk.

## Goal (1–3 sentences)

What success looks like. Concrete. Observable.

## ELI10 (2–4 sentences)

Plain English a 16-year-old could follow. Forces you to articulate why this matters without jargon.

## Stakes if we ship the wrong thing (1 sentence)

What breaks. Who notices. How fast.

## Acceptance criteria (testable, observable list)

Each line is a sentence ending in a verifiable claim:

- the new endpoint returns 429 after the 11th request in a minute from the same IP
- the dashboard widget renders within 200ms p95 on a synthetic 4G profile
- `prjct spec audit <id>` blocks if any reviewer returns `fail`

Anti-patterns:

- "the system should be fast" — what threshold, measured how?
- "users will love it" — not testable
- "follow industry best practices" — what specifically?

## Scope (what's IN)

The pieces this spec commits to. Be specific about file paths, surfaces, modules.

## Out of scope (what's OUT)

The pieces this spec explicitly DOES NOT cover. This is your anti-creep shield mid-implementation.

## Risks

Each risk has a mitigation. A risk without a mitigation is just a complaint.

- **risk:** legacy endpoints rely on the same rate-limit middleware → **mitigation:** scope key separates `/auth` from `/api`
- **risk:** Redis dependency raises ops cost → **mitigation:** start with in-memory token bucket; swap to Redis only above 5 RPS

## Test plan

How you'll prove the acceptance criteria. Includes the unhappy path.

- unit tests for the token bucket math
- integration test: 11 requests, 11th returns 429
- load test: 100 RPS sustained for 60s, no memory growth
- manual: trigger via `curl` and inspect response headers

## Notes (optional)

Things that don't fit anywhere else but matter for context.

---

## Lifecycle

```
draft  →  reviewed  →  in_progress  →  shipped
                                    →  archived
```

- `draft` — created, not yet audited.
- `reviewed` — `prjct audit-spec` returned pass on all three reviewers.
- `in_progress` — at least one task with `linked_spec_id` exists.
- `shipped` — code merged, criteria met (or override accepted).
- `archived` — superseded or abandoned.

## Verb cheatsheet

```
prjct spec "<title>"                       # draft — NO `draft` subverb, pass title directly
prjct spec list [--status <s>]
prjct spec show <id>
prjct spec update <id> --json '{...}'      # PATCH content (shallow merge)
prjct spec audit <id>                      # emit subagent dispatch
prjct spec record-review <id> --reviewer <name> --verdict <pass|fail> --notes "..."
prjct spec link-task <id> --task-id <task>
prjct spec ship <id> [--pr <n>]
prjct spec set-status <id> --status archived
prjct spec inventory [--md|--json]         # coverage map per module
```

> **No `draft` subverb.** `prjct spec "<title>"` already creates a draft. The CLI tolerates `prjct spec draft|new|create "<title>"` as friendly aliases (the leading word is stripped) so `prjct spec draft "rate limiting"` and `prjct spec "rate limiting"` produce the same spec — but the canonical form has no leading verb.
