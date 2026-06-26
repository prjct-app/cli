# SDD canonical sequence — prjct

Spec-Driven Development is prjct's default flow for substantive work. The six stations:

```
spec ─→ audit-spec ─→ task (--spec <id>) ─→ implement ─→ ship (acceptance gate)
                                                                  └─→ remember learning
```

## Stations

### 1. `spec`

The user describes a feature, fix, or initiative WITH goals or stakes. You don't run `task` yet. You run `prjct spec "<title>"` and walk the forcing questions:

- goal (1–3 sentences)
- eli10 (2–4 sentences)
- stakes if we ship the wrong thing
- acceptance criteria (testable, observable list)
- scope (what's IN)
- out_of_scope (what's OUT)
- risks (each with mitigation)
- test plan

The CLI persists this in the `specs` table; the vault renders to `_generated/specs/<slug>.md`.

### 2. `audit-spec`

Before writing any code: harden the spec. Run `prjct audit-spec <id>` — it emits a dispatch prompt for THREE review subagents that you run IN PARALLEL (one tool-use block per reviewer in the SAME message):

- **strategic** — scope sanity. Worth doing? Right size?
- **architecture** — feasibility. Data flow, failure modes, dependencies.
- **design** — UX/DX quality. Four dimensions rated 0–10.

Each returns a verdict (pass | fail) + notes. You write each back via `prjct spec record-review`. When all three pass, the spec auto-promotes from `draft` → `reviewed`.

If any reviewer fails: revise the spec via `prjct spec update`, re-audit. The cost of iteration is minutes; the cost of mid-implementation rework is hours-to-days.

### 3. `task --spec <id>`

Now create the task. The `--spec` flag wires the task to its spec via `linked_spec_id`. Without it, `ship` later has nothing to gate against.

```
prjct work "implement rate-limit middleware" --spec <id>
```

### 4. implement

Normal coding loop. Mid-flight workflows (`review`, `qa`, `investigate`) still apply. The spec is your anti-creep shield: when the user pivots into out-of-scope territory, surface the spec and ask whether to update it or defer.

### 5. `ship` (with the spec gate)

`prjct ship` reads the linked spec's `acceptance_criteria` and surfaces them as a checklist in the PR description. Walk each one — pass / fail / N/A. If any criterion is unmet → STOP and surface to the user.

Override path: `prjct ship --no-spec-gate` (use only when the user explicitly accepts).

### 6. `remember learning`

After ship, capture what the spec got right and wrong:

```
prjct remember learning "spec missed the clock-skew edge case; future rate-limit specs should call out time-source"
```

The next spec is sharper. Compounding effect: the vault accumulates spec-shaped lessons.

## When to bypass SDD

Not every keystroke goes through six stations. Routine work skips `spec`:

- single-file fix with known scope
- doc tweak / typo
- inbox capture / GTD dump
- conversational Q&A
- re-running a failing test
- bug fix where root cause is already known

Rule of thumb: if the work touches >1 file, ships to users, or takes >30 minutes, default to `spec` first.

## Anti-patterns

- **Skipping straight to `task` because the user said "let's build X".** If they said it WITH stakes, the spec is what protects them from scope creep mid-implementation.
- **Auditing AFTER implementing.** Pre-implementation review is the whole point. Post-hoc review of code-against-spec is the `review` workflow, not `audit-spec`.
- **Treating the spec as immutable.** Specs evolve. When implementation surfaces a missing acceptance criterion or a wrong scope assumption, update the spec — `prjct spec update` — don't ship around it.
- **Marking `acceptance_criteria` met without proof.** The criterion exists to be tested. If the test wasn't run, the criterion isn't met.
