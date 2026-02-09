# Changelog

## [1.14.0] - 2026-02-09

### Features
- **Velocity Dashboard**: New `prjct velocity` command with sprint-by-sprint breakdown, trend detection, and estimation accuracy (PRJ-296)
- **Estimation Patterns**: Automatic detection of over/under estimation patterns by task category
- **Completion Projections**: Given remaining backlog points, projects estimated sprints and completion date
- **Velocity Context Injection**: Historical velocity data automatically injected into LLM task prompts for better estimation

### Implementation Details

**PRJ-296 — Sprint-Based Velocity Calculation**
New velocity subsystem that aggregates completed task data (from outcomes.jsonl) into sprint periods, calculates rolling velocity metrics, detects trends, and identifies estimation patterns.

Key changes:
- `core/schemas/velocity.ts` — Zod schemas: SprintVelocity, VelocityMetrics, VelocityConfig, EstimationPattern, CompletionProjection
- `core/domain/velocity.ts` — Velocity engine: sprint bucketing, linear regression trend detection, accuracy tracking, pattern detection, duration parsing, LLM context formatting
- `core/storage/velocity-storage.ts` — Write-through storage extending StorageManager with markdown generation
- `core/commands/velocity.ts` — Dashboard command with chalk-formatted output + registration
- `core/types/agentic.ts` — Extended `OrchestratorContext` with `velocityContext` field
- `core/agentic/orchestrator-executor.ts` — Loads velocity context in parallel via `Promise.all`
- `core/agentic/prompt-builder.ts` — Injects velocity into Section 6 (task context)
- `core/__tests__/domain/velocity.test.ts` — 35 new tests

### Learnings
- Derive story points from estimated duration via Fibonacci mapping when outcomes lack explicit point data
- Linear regression slope normalized by average velocity works well for trend detection (>10% = improving, <-10% = declining)
- Parallel loading pattern in orchestrator-executor (`Promise.all`) ensures zero-latency context enrichment

### Test Plan

#### For QA
1. Run `prjct velocity` on a project with outcomes data — verify sprint-by-sprint breakdown with points, tasks, accuracy
2. Run `prjct velocity` with no outcomes — verify graceful "No velocity data yet" message
3. Run `prjct velocity 89` — verify completion projection (sprints remaining + date)
4. Run `bun test core/__tests__/domain/velocity.test.ts` — 35 tests pass
5. Run `bun test` — all 805 tests pass

#### For Users
- **What changed:** New `prjct velocity` command shows sprint velocity, estimation accuracy trends, and completion projections. Velocity data is automatically injected into task prompts for better LLM estimation.
- **How to use:** Run `prjct velocity` after completing tasks with estimates. Add backlog points: `prjct velocity 89`
- **Breaking changes:** None

## [1.13.0] - 2026-02-09

### Features

- inject sealed analysis into task prompt context (PRJ-260) (#155)


## [1.13.0] - 2026-02-09

### Features
- **Analysis Injection**: Sealed analysis (languages, frameworks, patterns, anti-patterns) now automatically injected into LLM prompt context (PRJ-260)
- **Enriched Ground Truth**: Prompt section 3 renders full analysis data — languages, frameworks, package manager, source/test dirs, code patterns, and anti-patterns
- **Enhanced Anti-Hallucination**: AVAILABLE tech list enriched with analysis data (case-insensitive dedup), package manager constraint added

### Implementation Details

**PRJ-260 — Inject Sync Analysis into Task Context**
Connected the analysis pipeline (from PRJ-263) to the prompt assembly pipeline (from PRJ-301). `analysisStorage.getActive()` returns sealed analysis (or draft fallback), loaded in parallel with real codebase context for zero latency impact.

Key changes:
- `core/types/agentic.ts` — New `SealedAnalysisContext` interface, extended `OrchestratorContext` with `sealedAnalysis` field
- `core/agentic/orchestrator-executor.ts` — Added `loadSealedAnalysis()`, loads in parallel with `gatherRealContext()`
- `core/agentic/prompt-builder.ts` — Section 3 (ground truth) renders analysis data, Section 5 passes analysis to anti-hallucination
- `core/agentic/anti-hallucination.ts` — Extended `ProjectGroundTruth` with `analysisLanguages`, `analysisFrameworks`, `analysisPackageManager`
- `core/__tests__/agentic/analysis-injection.test.ts` — 14 new tests

### Test Plan

#### For QA
1. Run `prjct sync` on a project with sealed analysis — verify prompt contains Languages, Frameworks, Patterns sections
2. Run `prjct sync` on a project WITHOUT sealed analysis — verify no crash, fallback rules still present
3. Check anti-hallucination block — verify AVAILABLE list includes analysis languages/frameworks (deduped)
4. Run `bun test core/__tests__/agentic/analysis-injection.test.ts` — 14 tests pass
5. Run `bun test` — all 770 tests pass

#### For Users
- **What changed:** AI prompts now include your project's detected languages, frameworks, code patterns, and anti-patterns from sealed analysis
- **How to use:** Run `prjct sync` then `prjct seal` — improvements are automatic in subsequent task prompts
- **Breaking changes:** None

## [1.12.0] - 2026-02-09

### Features

- make subtask output and handoff mandatory (PRJ-262) (#154)


## [1.11.0] - 2026-02-09

### Features
- **Mandatory Subtask Handoff**: Subtask completion now requires structured handoff data — files changed, work summary, and context for the next subtask (PRJ-262)
- **Prompt Handoff Injection**: Previous subtask handoff automatically rendered in next subtask's prompt context
- **Completion Validation**: `SubtaskCompletionDataSchema` with Zod validation rejects empty handoff at `completeSubtask()`
- **Sealable Analysis**: 3-state lifecycle (draft/verified/sealed) with SHA-256 commit-hash signatures (PRJ-263)
- **Dual Storage**: Re-sync creates drafts without destroying sealed analysis — only sealed feeds task context
- **Staleness Detection**: Warns when HEAD moves past the sealed commit hash
- **Seal & Verify Commands**: `prjct seal` locks draft analysis, `prjct verify` checks integrity

### Implementation Details

**PRJ-262 — Mandatory Subtask Handoff**
Made `outputForNextAgent` required in `SubtaskSummarySchema` and `whatWasDone` min(1). Added `SubtaskCompletionDataSchema` for completion-time validation. `completeSubtask()` now requires `SubtaskCompletionData` and validates with Zod before persisting. Extended `OrchestratorSubtask` with optional `handoff` field. Prompt builder renders previous subtask handoff (files, work done, context). Done template updated with Step 3.5 for mandatory handoff collection.

Key changes:
- `core/schemas/state.ts` — Required fields, `SubtaskCompletionDataSchema`, `validateSubtaskCompletion()`
- `core/storage/state-storage.ts` — `completeSubtask()` enforces handoff, `getPreviousHandoff()` helper
- `core/types/agentic.ts` — `OrchestratorSubtask.handoff` field
- `core/agentic/prompt-builder.ts` — Renders previous subtask handoff in prompt
- `templates/commands/done.md` — Step 3.5: Mandatory handoff collection

**PRJ-263 — Sealable Analysis**
New `analysis-storage.ts` extends StorageManager with dual storage (draft + sealed). Analysis schema rewritten as Zod schemas with runtime validation. Sync service writes drafts in parallel with existing writes. Canonical JSON representation ensures deterministic SHA-256 signatures.

Key changes:
- `core/schemas/analysis.ts` — Full rewrite: plain interfaces → Zod schemas with `AnalysisStatusSchema`, `AnalysisItemSchema`
- `core/storage/analysis-storage.ts` — New: dual storage, sealing, verification, staleness detection
- `core/services/sync-service.ts` — Added `saveDraftAnalysis()` to parallel writes
- `core/commands/analysis.ts` — Added `seal()` and `verify()` command methods
- `core/commands/register.ts`, `core/index.ts` — Registered new commands

### Learnings
- Keep storage schema backward-compatible (optional fields) but validate at completion call site
- Dual validation: storage accepts optional, completion requires mandatory

### Test Plan

#### For QA (PRJ-262)
1. Run `p. done` after completing a subtask — verify handoff data is collected
2. Check state.json — verify subtask has `output` and `summary` fields with handoff data
3. Start next subtask — verify prompt includes "Previous Subtask Handoff" section
4. Load old state.json without handoff fields — verify backward compatibility (no errors)
5. Run tests: `bun test core/__tests__/storage/subtask-handoff.test.ts` — 19 tests pass

#### For QA (PRJ-263)
1. Run `prjct sync` — verify draft analysis is created in storage
2. Run `prjct seal` — verify analysis is locked with SHA-256 signature
3. Run `prjct verify` — verify signature matches
4. Run `prjct sync` again — verify sealed analysis is preserved, new draft created
5. Make a commit, run `prjct status` — verify staleness detection warns about diverged commits

#### For Users
- **PRJ-262:** Subtask completion now captures what was done, files changed, and context for the next subtask. `p. done` automatically collects handoff — no extra steps needed.
- **PRJ-263:** Analysis results can now be locked (sealed) so re-syncing doesn't overwrite verified context. Run `prjct seal` after reviewing sync results.
- **Breaking changes:** `completeSubtask()` API changed from optional to required parameters.

## [1.10.0] - 2026-02-08

### Features

- redesign prompt assembly with correct section ordering + anti-hallucination (PRJ-301) (#152)
- add coordinated global token budget (PRJ-266) (#151)


## [1.12.0] - 2026-02-07

### Features
- **Prompt Assembly Redesign**: Correct section ordering based on research of 25+ system prompts (PRJ-301)
- **Environment Block**: Structured `<env>` block with project, git, platform, runtime, and model metadata
- **Anti-Hallucination Block**: Explicit availability/unavailability grounding injected BEFORE task context
- **Token Efficiency Directive**: Conciseness rules appended to every prompt

### Implementation Details
Redesigned `prompt-builder.ts` section ordering to follow research-backed pattern:
Identity → Environment → Ground Truth → Capabilities → Constraints → Task Context → Task → Output Schema → Efficiency

Key changes:
- New `environment-block.ts`: Generates `<env>` XML block with auto-detected runtime, platform, and normalized names
- New `anti-hallucination.ts`: Generates constraints block from sealed analysis (available tech, absent domains, grounding rules)
- Moved template content (task instructions) to section 7 — LLM knows identity, env, and rules before reading task
- Anti-hallucination block placed at section 5 (before task context), replacing old `RULES (CRITICAL)` at the end
- Added `buildEfficiencyDirective()` with conciseness rules (max 4 lines, no preamble/postamble)
- Exported `PROMPT_SECTION_ORDER` constant and `SectionPriority` type for budget trimming
- Kept `buildCriticalRules()` as fallback when project context unavailable

### Test Plan

#### For QA
1. Run `prjct sync` on any project — verify CLAUDE.md has correct section ordering
2. Check for `<env>` block near top of generated prompt
3. Verify anti-hallucination block appears BEFORE task context
4. Run `prjct sync --package=<name>` in monorepo — verify per-package context

#### For Users
**What changed:** AI agent prompts now follow research-backed section ordering for better accuracy
**How to use:** Run `prjct sync` — improvements are automatic
**Breaking changes:** None

## [1.9.0] - 2026-02-06

### Features
- **Structured Output Schema**: All LLM prompts now include structured output schemas (PRJ-264)
- **Global Token Budget**: Coordinated token budget across all prompt sections (PRJ-266)

### Implementation Details
Added `core/schemas/llm-output.ts` with Zod schemas for each command's expected output format. Schemas are rendered as JSON examples in prompts so LLMs know the exact structure expected.

Global token budget (`core/agentic/token-budget.ts`) allocates tokens across sections with priority-based trimming. Critical sections (identity, task) are protected; lower-priority sections (patterns, history) get trimmed first.

### Test Plan
1. Run any command — verify output matches schema
2. Run with large context — verify budget trimming works
3. Check prompt size stays under model limits
