# Changelog

## [1.11.0] - 2026-02-08

### Features
- **Sealable Analysis**: 3-state lifecycle (draft/verified/sealed) with SHA-256 commit-hash signatures (PRJ-263)
- **Dual Storage**: Re-sync creates drafts without destroying sealed analysis — only sealed feeds task context
- **Staleness Detection**: Warns when HEAD moves past the sealed commit hash
- **Seal & Verify Commands**: `prjct seal` locks draft analysis, `prjct verify` checks integrity

### Implementation Details
New `analysis-storage.ts` extends StorageManager with dual storage (draft + sealed). Analysis schema rewritten as Zod schemas with runtime validation. Sync service writes drafts in parallel with existing writes. Canonical JSON representation ensures deterministic SHA-256 signatures.

Key changes:
- `core/schemas/analysis.ts` — Full rewrite: plain interfaces → Zod schemas with `AnalysisStatusSchema`, `AnalysisItemSchema`
- `core/storage/analysis-storage.ts` — New: dual storage, sealing, verification, staleness detection
- `core/services/sync-service.ts` — Added `saveDraftAnalysis()` to parallel writes
- `core/commands/analysis.ts` — Added `seal()` and `verify()` command methods
- `core/commands/register.ts`, `core/index.ts` — Registered new commands

### Test Plan

#### For QA
1. Run `prjct sync` — verify draft analysis is created in storage
2. Run `prjct seal` — verify analysis is locked with SHA-256 signature
3. Run `prjct verify` — verify signature matches
4. Run `prjct sync` again — verify sealed analysis is preserved, new draft created
5. Make a commit, run `prjct status` — verify staleness detection warns about diverged commits

#### For Users
- **What changed:** Analysis results can now be locked (sealed) so re-syncing doesn't overwrite verified context
- **How to use:** Run `prjct seal` after reviewing sync results, `prjct verify` to check integrity
- **Breaking changes:** None — old analysis files parse with `status: 'draft'` default

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

### Learnings
- Zod `.default()` only applies during `.parse()` — raw object construction skips defaults, use `??` fallback
- Renaming prompt section headers breaks existing test assertions — always update test matchers
- Template position matters: placing task instructions after constraints improves LLM grounding

### Test Plan

#### For QA
1. Run `bun test` — all 719 tests pass (0 failures)
2. Run `bun run build` — build succeeds
3. Verify `<env>` block appears in generated prompts before constraints
4. Verify `CONSTRAINTS (Read Before Acting)` appears before template content
5. Verify `OUTPUT RULES` section appears at end of prompt
6. Check `AVAILABLE` and `NOT PRESENT` lists reflect project tech stack
7. Run `prjct sync` — prompt assembly still works end-to-end

#### For Users
Prompts sent to AI models are now structured with research-backed section ordering, reducing hallucinations and improving response conciseness. No user action required — improvements are automatic.

## [1.11.0] - 2026-02-07

### Features
- **Token Budget Coordinator**: Centralized token budget management across all context-loading components (PRJ-266)

### Implementation Details
Created `TokenBudgetCoordinator` class that manages the global token budget based on model context windows. Key features:
- Model context window registry (Claude 200K, Gemini 1M) with automatic budget calculation
- Input/output budget split: 65% input, 35% reserved for output
- Priority-based allocation: state (P1) > injection context (P2) > file content (P3)
- Request/record API for usage tracking with overflow detection
- Integrated into `injection-validator.ts`, `prompt-builder.ts`, and `context-selector.ts`
- Backward compatible: falls back to existing defaults when no coordinator is set

### Test Plan

#### For QA
1. Create coordinator with `'sonnet'` → input budget = 130K, output reserve = 70K
2. Create with `'2.5-pro'` (Gemini) → input budget = 650K (5x Claude)
3. Request tokens up to allocation limit → verify grants are capped
4. Exhaust a category budget → verify subsequent requests return 0
5. Verify `budgetsFromCoordinator()` uses coordinator's injection allocation
6. Run full test suite → all 705 tests pass

#### For Users
Token budgets are now centrally coordinated based on the model's context window. Larger models get proportionally larger budgets automatically. No breaking changes.

## [1.9.0] - 2026-02-07

### Features

- add structured output schema to all LLM prompts (PRJ-264) (#150)
- add mandatory model specification to AI provider (PRJ-265) (#149)

### Bug Fixes

- replace keyword domain detection with LLM semantic classification (PRJ-299) (#148)

## [1.10.0] - 2026-02-07

### Features
- **Add structured output schema to all LLM prompts (PRJ-264)**: LLM prompts now include explicit JSON output schemas. Responses are validated with Zod before use. Invalid responses trigger re-prompt with structured error feedback.

### Implementation Details
- New `core/schemas/llm-output.ts`: Zod schemas for task classification, agent assignment, and subtask breakdown responses. Schema registry (`OUTPUT_SCHEMAS`) with examples that self-validate. `renderSchemaForPrompt()` serializes schemas as markdown format instructions for prompt injection.
- New `core/agentic/response-validator.ts`: `validateLLMResponse()` handles JSON parsing (plain and markdown-wrapped `\`\`\`json` fences), Zod validation, and typed results. `buildReprompt()` generates retry messages with specific validation errors.
- Replaced manual field-by-field validation in `domain-classifier.ts` with `TaskClassificationSchema.safeParse()` — the schema existed (PRJ-299) but was unused.
- Added output schema injection to `prompt-builder.ts` `build()` method with `getSchemaTypeForCommand()` mapping commands to schemas.
- 20 new unit tests in `core/__tests__/agentic/response-validator.test.ts`

### Test Plan

#### For QA
1. Run `bun test core/__tests__/agentic/response-validator.test.ts` — all 20 tests pass
2. Run `bun test` — full suite (677 tests) passes with no regressions
3. Run `bun run build` — build succeeds cleanly
4. Verify `renderSchemaForPrompt('classification')` returns markdown with OUTPUT FORMAT header
5. Verify `validateLLMResponse()` handles plain JSON, markdown-wrapped JSON, and rejects non-JSON
6. Verify OUTPUT_SCHEMAS registry examples validate against their own schemas

#### For Users
**What changed:** LLM prompts include explicit JSON output schemas. Domain classifier uses Zod validation. Response validator provides structured error handling with re-prompt.
**How to use:** Automatic — schemas injected into prompts and validation runs transparently.
**Breaking changes:** None — all changes are additive.

## [1.9.0] - 2026-02-07

### Features
- **Add mandatory model specification to AI provider (PRJ-265)**: Provider configs now include `defaultModel`, `supportedModels`, and `minCliVersion` fields. Analysis and task metadata can record which model was used, enabling consistency tracking and mismatch warnings.

### Implementation Details
- New `core/schemas/model.ts`: Zod schemas defining supported models per provider (Claude: opus/sonnet/haiku, Gemini: 2.5-pro/2.5-flash/2.0-flash), default model resolution, semver comparison utilities, minimum CLI version validation, and model mismatch detection
- Extended `AIProviderConfig` interface in `core/types/provider.ts` with `defaultModel`, `supportedModels`, `minCliVersion` fields
- All 5 provider configs (Claude, Gemini, Cursor, Windsurf, Antigravity) updated with model specification fields
- Added `modelMetadata` (optional) to `CurrentTaskSchema` in `core/schemas/state.ts` and `AnalysisSchema` in `core/schemas/analysis.ts`
- Added `preferredModel` to `ProjectSettings` in `core/types/config.ts`
- Added `validateCliVersion()` to `core/infrastructure/ai-provider.ts` with version warning integration into `detectProvider()`
- Added `versionWarning` field to `ProviderDetectionResult`
- 32 new unit tests in `core/__tests__/schemas/model.test.ts`

### Test Plan

#### For QA
1. Verify `ClaudeProvider.defaultModel` is `'sonnet'` and `supportedModels` includes `['opus', 'sonnet', 'haiku']`
2. Verify `GeminiProvider.defaultModel` is `'2.5-flash'` and `supportedModels` includes `['2.5-pro', '2.5-flash', '2.0-flash']`
3. Verify multi-model IDEs (Cursor, Windsurf) have `null` defaultModel and empty supportedModels
4. Run `bun test core/__tests__/schemas/model.test.ts` — all 32 tests pass
5. Run `bun test` — full suite (657 tests) passes with no regressions
6. Run `bun run build` — build succeeds cleanly

#### For Users
**What changed:** Provider configs now include model specification fields. Analysis and task metadata can record which model was used. Version validation warns if CLI is outdated.
**How to use:** Existing configs work unchanged — model fields have sensible defaults. New `preferredModel` setting available in project settings.
**Breaking changes:** None — all new fields are optional or have defaults.

## [1.8.1] - 2026-02-07

### Bug Fixes
- **Replace keyword domain detection with LLM semantic classification (PRJ-299)**: Eliminated substring false positives in domain classification. "author" no longer matches "auth" → backend, "Build responsive dashboard" correctly routes to frontend.

### Implementation Details
- New `core/agentic/domain-classifier.ts`: LLM-based classifier with 4-level fallback chain (cache → confirmed history → Claude Haiku API → word-boundary heuristic)
- New `core/schemas/classification.ts`: Zod schemas for TaskClassification, cache entries, and confirmed patterns
- Replaced substring `includes()` matching in `smart-context.ts` and `orchestrator-executor.ts` with word-boundary regex (`\b`)
- Removed ~230 lines of hardcoded keyword lists from both files
- Classification results cached per (project + description hash) with 1-hour TTL
- Successful classifications auto-persisted as confirmed patterns via `confirmClassification()`

### Learnings
- Word-boundary regex (`\b`) correctly rejects "author" matching "auth" because there's no boundary between "auth" and "or" in "author"
- Using raw `fetch` to Claude API avoids adding `@anthropic-ai/sdk` dependency while keeping vendor-neutral design
- Centralized classifier in `domain-classifier.ts` consumed by both `smart-context.ts` and `orchestrator-executor.ts` eliminates duplication

### Test Plan

#### For QA
1. Run `bun test` — all 625 tests should pass
2. Verify `detectDomain('Fix the author display on profile page')` returns `frontend` (not `backend`)
3. Verify `detectDomain('Build responsive dashboard')` returns `frontend` (not `general`)
4. Verify `detectDomain('Fix the auth middleware')` returns `backend` (standalone "auth" still works)
5. Verify `classifyWithHeuristic` returns `general` with confidence 0.3 for unrecognizable tasks
6. Run `bun run build` — build should succeed

#### For Users
**What changed:** Domain classification uses smarter word-boundary matching, eliminating false positives.
**How to use:** No user-facing changes — classification happens automatically during `p. task`.
**Breaking changes:** None for end users.

## [1.8.0] - 2026-02-07

### Features

- add Fibonacci estimation with variance tracking (PRJ-295) (#145)
- add PerformanceTracker for CLI metrics (PRJ-297) (#146)

### Bug Fixes

- replace hardcoded command lists with config-driven context (PRJ-298) (#147)


## [1.8.0] - 2026-02-07

### Features
- **Fibonacci estimation with variance tracking (PRJ-295)**: Capture Fibonacci point estimates (1,2,3,5,8,13,21) on task start with automatic points-to-time conversion, record actual duration on done, and display estimation variance.

### Implementation Details
- New `core/domain/fibonacci.ts` module: `FIBONACCI_POINTS`, `pointsToMinutes()`, `pointsToTimeRange()`, `findClosestPoint()`, `suggestFromHistory()`
- Added `estimatedPoints` and `estimatedMinutes` optional fields to `CurrentTaskSchema` and `SubtaskSchema`
- Added `updateCurrentTask()` partial update method to `StateStorage`
- `now()` handler returns `fibonacci` helper object with `storeEstimate(points)` for template use
- `done()` handler records outcomes via `outcomeRecorder.record()` and displays variance: `est: 5pt (1h 30m) → +50%`

### Test Plan

#### For QA
1. Start a task — verify `fibonacci` helper is returned with `storeEstimate()`, `pointsToMinutes()`, `pointsToTimeRange()`
2. Call `storeEstimate(5)` — verify `estimatedPoints: 5` and `estimatedMinutes: 90` in state.json
3. Complete task with `p. done` — verify outcome recorded to `outcomes/outcomes.jsonl`
4. Verify variance display shows `est: 5pt (1h 30m) → +X%`
5. Run `bun test` — 552 tests pass

#### For Users
**What changed:** Tasks now support Fibonacci point estimation with automatic time conversion and variance tracking on completion.
**How to use:** Estimation is stored via `storeEstimate(points)` during task start; variance is auto-displayed on `p. done`.
**Breaking changes:** None — estimation fields are optional.

## [1.7.7] - 2026-02-07

### Bug Fixes
- **Config-driven command context (PRJ-298)**: Replaced 4 hardcoded command lists in `prompt-builder.ts` with a single `command-context.config.json` config file. New commands no longer silently get zero context — the wildcard `*` entry provides sensible defaults, and a heuristic classifier handles unknown commands.
- **Quality checklists for ship/done**: `ship` and `done` commands now receive quality checklists (previously excluded from the hardcoded list).

### Implementation Details
- Created `core/config/command-context.config.json` mapping 25 commands + wildcard to context sections (agents, patterns, checklists, modules)
- Zod schema in `core/schemas/command-context.ts` validates config at load time
- `core/agentic/command-context.ts` provides `resolveCommandContextFull()` with fallback chain: config → cache → heuristic classify → wildcard
- `core/agentic/command-classifier.ts` uses word-boundary keyword matching with score-based priority to classify unknown commands from template metadata
- Auto-learn (Phase 3): after 3 identical heuristic classifications, persists to config file via fire-and-forget

### Learnings
- Keyword substring matching causes false positives (e.g., "check" matching inside "checks") — word boundaries via `\b` regex are essential
- When quality and info keywords overlap, score-based priority (higher count wins) is more robust than boolean exclusion

### Test Plan

#### For QA
1. Run `bun test ./core/__tests__/agentic/command-context.test.ts` — all 20 tests pass
2. Run `bun test ./core/__tests__/agentic/prompt-builder.test.ts` — all 16 existing tests pass
3. Run `bun run build` — compiles without errors
4. Verify `ship` and `done` commands have `checklist: true` in config
5. Verify unknown commands get wildcard defaults (agents: true, patterns: true)

#### For Users
**What changed:** Commands like `ship` and `done` now receive quality checklists. New commands automatically get sensible context instead of nothing.
**How to use:** No user action needed — works automatically.
**Breaking changes:** None

## [1.7.6] - 2026-02-07

### Features
- **PerformanceTracker service (PRJ-297)**: New `core/infrastructure/performance-tracker.ts` singleton that automatically measures startup time, memory usage, and command durations on every CLI invocation. Data stored in append-only JSONL with 5MB rotation.
- **`prjct perf` dashboard command**: Shows performance metrics vs targets for the last N days (default 7). Displays startup time, heap/RSS memory, context correctness rate, subtask handoff rate, and per-command duration breakdown.
- **Zod schemas for performance metrics**: `core/schemas/performance.ts` with typed schemas for all metric types (timing, memory, context correctness, subtask handoff, analysis state).

### Implementation Details
- PerformanceTracker uses `process.hrtime.bigint()` for nanosecond-precision timing and `process.memoryUsage()` for memory snapshots
- Startup time captured at top of `bin/prjct.ts` via `globalThis.__perfStartNs` and recorded in `core/index.ts` after command execution
- All instrumentation wrapped in non-critical try/catch to prevent perf tracking from breaking CLI functionality
- Uses existing `jsonl-helper.appendJsonLineWithRotation` for storage (5MB rotation limit)
- 17 unit tests covering timing, memory, recording, context correctness, handoff, and report generation

### Learnings
- JSONL append-only pattern with rotation is ideal for time-series metrics (vs JSON write-through for stateful data)
- `globalThis` works well for passing data between `bin/` entry point and `core/` modules without import coupling
- `process.memoryUsage().heapUsed` can momentarily exceed `heapTotal` during GC — don't assert `<=`

### Test Plan

#### For QA
1. Run `prjct status` then `prjct perf` — verify metrics appear (startup time, memory, command duration)
2. Run multiple commands then `prjct perf 1` — verify all commands show in dashboard
3. Check `~/.prjct-cli/projects/{id}/storage/performance.jsonl` exists with valid JSONL entries
4. Verify `prjct perf` with no data shows "No performance data yet" message
5. Verify target indicators: startup `<500ms` green, `>500ms` yellow warning

#### For Users
**What changed:** New `prjct perf` command shows a performance dashboard with startup time, memory usage, and command duration metrics.
**How to use:** Run `prjct perf` (default 7 days) or `prjct perf 30` for 30-day view. Metrics are collected automatically.
**Breaking changes:** None


## [1.7.5] - 2026-02-07

### Refactoring

- remove unused deps and lazy-load @linear/sdk (PRJ-291) (#144)

## [1.7.5] - 2026-02-07

### Changed
- **Remove unused dependencies and lazy-load heavy optional ones (PRJ-291)**: Removed `lightningcss` (completely unused), moved `esbuild` to devDependencies (build-time only), lazy-loaded `@linear/sdk` via dynamic `import()` so it only loads when Linear commands are invoked.

### Implementation Details
- Removed `lightningcss` from dependencies (zero imports in codebase)
- Moved `esbuild` from dependencies to devDependencies (only used in `scripts/build.js`)
- Changed `import { LinearClient } from '@linear/sdk'` to `import type` + dynamic `await import('@linear/sdk')` in `core/integrations/linear/client.ts`
- Excluded test files from published package via `.npmignore`
- Removed `scripts/build.js` from `files` field (dist/ ships pre-built)

### Learnings
- `import type` + dynamic `await import()` pattern preserves full type safety while deferring module load to runtime. Type imports are erased at compile time with zero cost.

### Test Plan

#### For QA
1. Run `bun test` — 538 tests pass, no regressions
2. Run `bun run build` — compiles without errors
3. Run `bun run typecheck` — zero type errors
4. Run `prjct status` and `prjct linear list` — CLI works normally

#### For Users
**What changed:** Faster install (~75MB fewer dependencies), faster CLI startup (Linear SDK only loaded on demand).
**How to use:** No changes needed.
**Breaking changes:** None

## [1.7.4] - 2026-02-07

### Bug Fixes

- add eviction policies to all in-memory caches (PRJ-288) (#143)


## [1.7.4] - 2026-02-07

### Bug Fixes
- **Add eviction policies to all in-memory caches (PRJ-288)**: Replaced unbounded Maps with TTLCache in SessionLogManager and ContextBuilder, capped PatternStore decision contexts at 20 with FIFO eviction, and added 90-day archival for stale decisions to prevent unbounded memory growth.

### Implementation Details
- SessionLogManager: replaced 2 `Map` caches with `TTLCache` (maxSize: 50, TTL: 1hr)
- ContextBuilder: replaced `Map` + `_mtimes` + manual TTL with single `TTLCache<CachedFile>` (maxSize: 200, TTL: 5s), added project-switch detection
- PatternStore: added `afterLoad()` hook to truncate oversized contexts arrays, FIFO cap at 20 in `recordDecision()`, new `archiveStaleDecisions()` method for 90-day archival
- Exposed `archiveStaleDecisions()` via MemorySystem facade

### Test Plan

#### For QA
1. Run `bun test core/__tests__/agentic/cache-eviction.test.ts` — 12 new tests pass
2. Run `bun test` — full suite (538 tests) passes with no regressions
3. Run `bun run build` — compiles without errors
4. Verify `prjct sync` and `prjct status` work normally

#### For Users
**What changed:** Internal optimization — in-memory caches now bounded to prevent memory growth during long sessions.
**How to use:** No user-facing changes.
**Breaking changes:** None

## [1.7.3] - 2026-02-07

### Bug Fixes

- add Zod validation and token budgets for prompt injection (PRJ-282) (#142)


## [1.7.3] - 2026-02-07

### Bug Fixes
- **Validate auto-injected state in prompt builder (PRJ-282)**: Added `safeInject()` validation utility, token-aware truncation via `InjectionBudgetTracker`, and domain-based skill filtering to prevent oversized or irrelevant content in LLM prompts. Replaced hardcoded character limits with configurable token budgets.

### Implementation Details
- Created `core/agentic/injection-validator.ts` with `safeInject()`, `safeInjectString()`, `truncateToTokenBudget()`, `estimateTokens()`, `filterSkillsByDomains()`, and `InjectionBudgetTracker` class
- Wired validation into `prompt-builder.ts`: auto-context truncation, agent/skill token budgets, cumulative state budget tracking
- Skills filtered by detected task domains before injection to reduce token waste
- 33 new unit tests covering all validation, filtering, and truncation paths

### Test Plan

#### For QA
1. Run `bun test` — all 526 tests pass (33 new)
2. Verify `safeInject()` returns fallback on corrupt data
3. Verify `filterSkillsByDomains()` excludes irrelevant skills
4. Verify `InjectionBudgetTracker` enforces cumulative limits

#### For Users
- No user-facing changes — validation is automatic
- Breaking changes: None

## [1.7.2] - 2026-02-07

### Bug Fixes

- add missing state machine transitions and dead-end states (PRJ-280) (#141)


## [1.7.2] - 2026-02-07

### Bug Fix
- **Fix state machine completeness: missing transitions and dead-end states (PRJ-280)**: Added missing transitions (`completed → pause`, `paused → ship`, `completed → reopen`), subtask states (`skipped`, `blocked` with reason tracking), migrated `previousTask` to `pausedTasks[]` array with max limit (5) and staleness detection (30 days), and enforced all transitions through the state machine at the storage level.

### Implementation Details
Added `reopen` command to `WorkflowCommand` type. Updated `getCurrentState()` to detect paused state from `pausedTasks[]` array and legacy `previousTask`. `failSubtask()` now advances to the next subtask instead of halting. New `skipSubtask(reason)` and `blockSubtask(blocker)` methods mark subtasks and advance. `pauseTask()` pushes onto a `pausedTasks[]` array (max 5), `resumeTask()` pops from array or by ID. `getPausedTasksFromState()` handles backward compat by migrating legacy `previousTask` format. All storage mutation methods (`startTask`, `completeTask`, `pauseTask`, `resumeTask`) validate transitions through the state machine before executing.

### Test Plan

#### For QA
1. Verify `completed → pause`, `paused → ship`, and `completed → reopen` transitions work
2. Start a task with subtasks, call `failSubtask()` — verify it records reason AND advances to next subtask
3. Call `skipSubtask(reason)` and `blockSubtask(blocker)` — verify they record reasons and advance
4. Pause 3+ tasks — verify `pausedTasks[]` array stores all, respects max limit of 5
5. State.json with old `previousTask` format — verify auto-migration into array
6. Attempt invalid transition (e.g., `done` from `idle`) — verify error thrown at storage level

#### For Users
**What changed:** Workflow supports reopening completed tasks, shipping paused tasks directly, and multiple paused tasks. Subtask failures auto-advance instead of halting.
**Breaking changes:** `previousTask` deprecated in favor of `pausedTasks[]`. Backward compat maintained via auto-migration.

## [1.7.1] - 2026-02-07

### Bug Fixes

- add Zod validation on all storage reads (PRJ-279) (#140)


## [1.7.1] - 2026-02-07

### Bug Fix
- **Add Zod validation on all storage reads (PRJ-279)**: Created `safeRead<T>()` utility that wraps `JSON.parse` + `schema.safeParse()`. All 5 `StorageManager` subclasses (state, queue, ideas, shipped, metrics) now validate reads against their Zod schemas. Corrupted files produce a logged warning + `.backup` file instead of silently crashing downstream.

### Implementation Details
Created `core/storage/safe-reader.ts` with a `ValidationSchema` interface decoupled from Zod generics to avoid strict type parameter matching. The `StorageManager` base class accepts an optional schema via constructor — subclasses pass their Zod schema with a single import + arg change. `safeRead` returns the raw parsed JSON (not Zod-transformed `result.data`) to preserve extra fields for forward compatibility. Also fixed `ShippedJsonSchema` which used `items` instead of `shipped` (pre-existing schema bug), and made `changes` optional to match actual data.

### Learnings
- Zod's default `strip` mode silently drops unknown keys from `result.data` — must return raw JSON to preserve extra state.json fields (projectId, stack, domains, etc.)
- `ShippedJsonSchema` had `items` instead of `shipped` as the array key — pre-existing schema/data mismatch
- `ValidationSchema` interface avoids Zod generic constraints while still providing type-safe validation

### Test Plan

#### For QA
1. Create a valid `state.json` — verify it reads correctly with no warnings
2. Corrupt a storage file with invalid JSON — verify `.backup` is created and defaults returned
3. Write valid JSON with wrong schema — verify `.backup` and defaults
4. Add extra fields not in schema — verify they are preserved after read
5. Run `bun test` — verify all 438 tests pass (16 new for `safeRead`)

#### For Users
**What changed:** Storage reads are now validated against Zod schemas. Corrupted files no longer cause silent crashes.
**How to use:** No action needed — automatic.
**Breaking changes:** None.

## [1.7.0] - 2026-02-07

### Features

- use relative timestamps to reduce token waste (PRJ-274) (#139)
- use relative timestamps to reduce token waste (PRJ-274)

## [1.6.16] - 2026-02-07

### Improvement
- **Use relative timestamps to reduce token waste (PRJ-274)**: Added `toRelative()` function using `date-fns` `formatDistanceToNowStrict`. Replaced raw ISO-8601 timestamps in Markdown context files (`now.md`, `ideas.md`, `shipped.md`) with human-readable relative time ("5 minutes ago", "3 days ago"). JSON storage retains full ISO timestamps — no data loss.

### Implementation Details
Added `date-fns` as a dependency and created a thin `toRelative(date)` wrapper around `formatDistanceToNowStrict` in `core/utils/date-helper.ts`. Updated `toMarkdown()` in `state-storage.ts` (Started/Paused fields), `ideas-storage.ts` (all 3 sections: pending, converted, archived), and `shipped-storage.ts` (ship date per entry). 6 new unit tests added covering minutes, hours, days, months, Date objects, and ISO string inputs.

### Learnings
- `date-fns` `formatDistanceToNowStrict` gives exact units ("5 minutes ago" not "about 5 minutes ago") — better for token efficiency
- Tests need `setSystemTime()` from `bun:test` since `formatDistanceToNowStrict` uses system clock internally

### Test Plan

#### For QA
1. Run `bun test core/__tests__/utils/date-helper.test.ts` — verify all 55 tests pass (6 new for `toRelative`)
2. Run `bun run build` — verify build succeeds
3. Run `prjct sync` — verify `context/now.md` shows relative timestamps instead of raw ISO
4. Check `ideas.md` and `shipped.md` for relative date format

#### For Users
**What changed:** Timestamps in context files now show "5 minutes ago", "3 days ago" instead of raw ISO-8601 strings.
**How to use:** No action needed — automatic.
**Breaking changes:** None.

## [1.6.15] - 2026-02-07

### Refactor
- **Remove unused templates and dead code (PRJ-293)**: Deleted 8 unused template files from `templates/analysis/` (5) and `templates/agentic/` (3) that were never referenced by any code or other templates. Also removed unused type imports flagged by biome's `noUnusedImports` rule from `diff-generator.ts`, `sync-service.ts`, and `citations.ts`. Total: -471 lines removed.

### Implementation Details
Audited all 135 templates by cross-referencing with code that loads them. Carefully distinguished between templates loaded dynamically via `readdir` (checklists, skills — kept) and templates with zero references (analysis prompts, agentic scaffolding — deleted). Unused imports were types imported for re-export where the `export type` statement imports independently from the source module, making the `import type` line redundant.

### Learnings
- Dynamic template loading via `readdir` (in `prompt-builder.ts` and `skill-service.ts`) means simple grep searches can't identify all references — must trace runtime loading patterns to distinguish truly unused templates from dynamically loaded ones
- TypeScript `export type { X } from 'module'` is a standalone declaration that imports independently — a separate `import type { X }` is only needed if `X` is used in the file body

### Test Plan

#### For QA
1. Run `bun run build` — verify build succeeds with no errors
2. Run `bun run lint` — verify zero biome warnings (especially `noUnusedImports`)
3. Run `prjct sync` — verify sync still works (deleted templates were unused by sync)
4. Verify `templates/checklists/*.md` and `templates/skills/*.md` are untouched (dynamically loaded)

#### For Users
**What changed:** Removed 8 unused internal template files and cleaned up dead imports. No user-facing behavior changes.
**How to use:** No action needed — this is an internal cleanup.
**Breaking changes:** None.

## [1.6.12] - 2026-02-07

### Bug Fixes

- replace sync I/O in imports-tool hot path (PRJ-290) (#137)

## [1.6.14] - 2026-02-07

### Bug Fixes
- **Replace sync I/O in imports-tool hot path (PRJ-290)**: Converted `tryResolve`/`resolveImport`/`extractImports` from sync `require('node:fs')` with `existsSync`+`statSync` to async `fs.stat()` from `node:fs/promises`. Also replaced repeated `getPackageRoot()` calls with the pre-resolved `PACKAGE_ROOT` constant in prompt-builder, command-installer, and setup modules.

### Implementation Details
The `imports-tool.ts` file had an inline `require('node:fs')` call inside `tryResolve()` that used `existsSync` and `statSync` in a loop — a true hot path during import analysis. Converted the entire chain (`tryResolve` → `resolveImport` → `extractImports`) to async, using the already-imported `fs` from `node:fs/promises`. `version.ts` was kept sync intentionally: esbuild CJS output (used for postinstall) doesn't support top-level await, and its I/O runs once at cold start with results cached.

### Learnings
- esbuild CJS format does not support top-level `await` — async module exports require ESM format
- `version.ts` cold-start I/O is negligible (runs once, cached) vs `imports-tool.ts` which resolves extensions in a loop per import
- Using pre-resolved `PACKAGE_ROOT` constant avoids repeated sync function calls across modules

### Test Plan

#### For QA
1. Run `prjct context imports <file>` — verify import resolution works correctly (resolves `.ts`, `.tsx`, `.js` extensions and `/index.ts` barrel imports)
2. Run `prjct sync` — verify command-installer and setup find templates via `PACKAGE_ROOT`
3. Run `bun run build` — verify all 5 build targets compile without errors
4. Verify no `fs.*Sync()` calls remain in `imports-tool.ts`

#### For Users
**What changed:** Import analysis is now fully async, eliminating sync file system calls in the hot path.
**How to use:** No changes needed — `prjct context imports` works the same way.
**Breaking changes:** None.

## [1.6.11] - 2026-02-07

### Performance

- cache provider detection to eliminate redundant shell spawns (PRJ-289) (#136)

## [1.6.13] - 2026-02-07

### Improvements
- **Cache provider detection to eliminate redundant shell spawns (PRJ-289)**: Provider detection results (Claude, Gemini CLI availability) are now cached to `~/.prjct-cli/cache/providers.json` with a 10-minute TTL. Subsequent CLI commands skip shell spawns entirely. Added 2-second timeout on `which`/`--version` spawns to prevent hangs. Added `--refresh` flag to force re-detection.

### Implementation Details
Created `core/utils/provider-cache.ts` with `readProviderCache()`, `writeProviderCache()`, and `invalidateProviderCache()`. Wired into `detectAllProviders()` — checks cache first, falls through to shell detection on miss or expiry, writes cache after detection. `bin/prjct.ts` parses `--refresh` early (like `--quiet`), invalidates cache, and passes refresh flag to detection.

### Learnings
- `execAsync` accepts a `timeout` option (milliseconds) that kills the child process on expiry — ideal for preventing hangs on broken CLI installations.
- Biome enforces `Array#indexOf()` over `Array#findIndex()` for simple equality checks (`useIndexOf` rule).
- Separating cache logic into its own module keeps `ai-provider.ts` focused on detection logic.

### Test Plan

#### For QA
1. Run `prjct --version` twice — second run should be near-instant (cache hit)
2. Delete `~/.prjct-cli/cache/providers.json`, run `prjct --version` — should re-detect and recreate cache
3. Run `prjct --version --refresh` — should take ~2s (forced re-detection)
4. Edit cache file to set timestamp 11 minutes ago — next command should re-detect (TTL expired)
5. Run `prjct sync` — should use cached providers, no shell spawns

#### For Users
**What changed:** Provider detection is now cached for 10 minutes. CLI startup is ~30x faster for cached commands (~66ms vs ~2100ms).
**How to use:** Automatic. Use `--refresh` to force re-detection after installing a new CLI.
**Breaking changes:** None.

## [1.6.10] - 2026-02-07

### Bug Fixes

- resolve signal handler and EventBus listener accumulation leaks (PRJ-287) (#135)

## [1.6.12] - 2026-02-07

### Bug Fixes
- **Fix signal handler and EventBus listener accumulation leaks (PRJ-287)**: WatchService signal handlers (`SIGINT`/`SIGTERM`) are now stored by reference and removed in `stop()`, preventing accumulation on restart cycles. `pendingChanges` Set is cleared on stop. EventBus gains `flush()` to clear history and stale once-listeners, and `removeAllListeners(event?)` for targeted cleanup.

### Implementation Details
Stored signal handler references as class properties (`sigintHandler`, `sigtermHandler`). In `start()`, old handlers are removed before new ones are added. In `stop()`, handlers are removed via `process.off()` and `pendingChanges` is cleared. EventBus `flush()` clears history array and all once-listeners. `removeAllListeners()` supports both targeted (single event) and global cleanup.

### Learnings
- Arrow functions passed to `process.on()` cannot be removed — must store named handler references for `process.off()`.
- Cleanup code after `process.exit(0)` is unreachable — perform all cleanup before the exit call.

### Test Plan

#### For QA
1. Start/stop watch mode 10 times — verify only 2 signal handlers (not 20)
2. Trigger file changes, stop — verify `pendingChanges` cleared
3. Emit 50 events, call `flush()` — verify history empty
4. Register `once()` for unfired event, `flush()` — verify listener removed
5. `removeAllListeners('event')` — verify only that event cleared
6. `removeAllListeners()` — verify all cleared

#### For Users
**What changed:** WatchService no longer leaks signal handlers on restart. EventBus has `flush()` and `removeAllListeners()`.
**Breaking changes:** None.

## [1.6.9] - 2026-02-07

### Bug Fixes

- resolve SSE zombie connections and infinite promise leak (PRJ-286) (#134)

## [1.6.11] - 2026-02-07

### Bug Fixes
- **Fix SSE zombie connections and infinite promise leak (PRJ-286)**: Replaced infinite `await new Promise(() => {})` with AbortController-based mechanism that resolves on client removal. Added max client lifetime (1 hour) with per-client TTL timeout. Added periodic reaper (every 5 min) that scans for and removes zombie entries from the clients Map. Consolidated duplicate cleanup paths into single idempotent `removeClient(id)` function. Added `shutdown()` to SSEManager for clean server stop. All timers use `unref()` to avoid blocking process exit.

### Implementation Details
Replaced the infinite pending promise in `streamSSE` callback with an `AbortController` whose signal resolves the await when the client is removed. Internal client state (`heartbeatInterval`, `ttlTimeout`, `abortController`) is tracked in an `InternalClient` wrapper separate from the public `SSEClient` type. The public `SSEClient` interface gained only `connectedAt` for staleness detection.

### Learnings
- AbortController integrates cleanly with Hono's `streamSSE` — the async callback needs to await *something*, and a signal-based promise is the right primitive.
- Timer `unref()` has different shapes between Bun (number) and Node (Timeout object) — use `typeof` check before calling.
- Idempotent cleanup functions eliminate race conditions between heartbeat failure and stream abort handlers.

### Test Plan

#### For QA
1. Start prjct server, connect SSE client to `/api/events` — verify `connected` event
2. Disconnect client gracefully — verify `clients.size === 0`
3. Kill client process (ungraceful) — verify heartbeat cleanup within 30s
4. Connect client, wait >1 hour — verify TTL auto-disconnect
5. Connect 5+ clients, kill all — verify reaper cleans all within 5 min
6. Call `server.stop()` — verify all clients disconnected and reaper stopped

#### For Users
**What changed:** SSE connections now clean up reliably on disconnect, have a 1-hour max lifetime, and a background reaper removes zombie connections every 5 minutes.
**Breaking changes:** `SSEManager` interface now includes `shutdown()`. `SSEClient` now includes `connectedAt`.

## [1.6.10] - 2026-02-07

### Documentation
- **Document all environment variables (PRJ-90)**: Added comprehensive environment variable documentation to README.md covering all 13 env vars used by prjct-cli. Organized into Configuration, JIRA Integration, and Agent Detection categories with defaults, descriptions, and usage examples. Added inline comments at all `process.env` read sites in 6 source files.

### Test Plan

#### For QA
1. `bun run build` — should succeed
2. `bun run lint` — no errors
3. Verify README.md renders correctly on GitHub (env vars tables)

#### For Users
**What changed:** New "Environment Variables" section in README.md with full documentation of all configurable env vars.
**Breaking changes:** None.

## [1.6.8] - 2026-02-07

### Refactoring

- standardize export patterns to ESM (PRJ-99) (#132)


## [1.6.9] - 2026-02-07

### Refactor
- **Standardize export patterns to ESM (PRJ-99)**: Removed redundant `export default { ... }` CJS-compat patterns from 33 files across `core/`. Updated 19 import sites to use namespace imports (`import * as X`). Cleaned 3 barrel re-exports in `agentic/index.ts`, `bus/index.ts`, and `storage/index.ts`. 3 function-collection modules (chain-of-thought, ground-truth, template-loader) retain proper singleton defaults for test mocking compatibility. Net reduction of 274 lines.

### Implementation Details
Removed the redundant pattern where files had both named exports (`export function X`) and a CJS-compat default export object (`export default { X, Y, Z }`). All 33 cleaned files already had proper named exports, making the default objects unnecessary. Import sites referencing removed defaults were converted to `import * as X from` namespace imports, which preserves the `X.method()` usage pattern.

### Learnings
- Bun enforces read-only properties on ESM namespace objects (`import * as X`) — direct property assignment for test mocking fails at runtime
- Function-collection modules that need test mocking should export a named singleton object as default, consistent with class-instance modules like `pathManager`, `loopDetector`
- Barrel file (`index.ts`) re-exports of `default` must be updated when removing default exports from source modules

### Test Plan

#### For QA
1. Run `bun run build` — should complete with no errors
2. Run `bun run test` — all 416 tests should pass (1 pre-existing timeout flake in DependencyValidator)
3. Run `bun run lint` — no lint errors
4. Run `npx tsc -p core/tsconfig.json --noEmit` — no type errors
5. Verify `prjct sync --yes` still works end-to-end

#### For Users
**What changed:** Internal refactor only — no API or CLI behavior changes.
**How to use:** No user action needed.
**Breaking changes:** None.

## [1.6.8] - 2026-02-07

### Documentation
- **Add JSDoc to CachedStore class methods (PRJ-91)**: Enhanced all 12 public/protected methods on the `CachedStore<T>` base class with comprehensive JSDoc including `@param`, `@returns`, `@throws`, `@example`, and `@typeParam` annotations. Improved class-level documentation with usage example and cross-references to subclasses.

### Test Plan

#### For QA
1. Build (`bun run build`) — should succeed
2. Typecheck (`npx tsc -p core/tsconfig.json --noEmit`) — should pass
3. Verify JSDoc renders in IDE hover tooltips for CachedStore methods

#### For Users
**What changed:** Better IDE documentation for CachedStore internals.
**Breaking changes:** None


## [1.6.7] - 2026-02-07

### Bug Fixes

- add context to silent catch blocks in sync-service.ts (PRJ-80) (#120)

### Refactoring

- replace `any` types in routes-extended.ts and server.ts (PRJ-77) (#130)


## [1.6.7] - 2026-02-07

### Refactoring
- **Replace `any` types in routes-extended.ts and server.ts (PRJ-77)**: Added `ProjectJson`, `StateJson`, `StateTask`, `QueueJson`, `QueueTask`, `RoadmapJson` interfaces to `core/types/storage.ts`. Replaced all 33 `any` types in `core/server/routes-extended.ts` with proper typed generics. Fixed `handleConnection: (c: any)` in `core/types/server.ts` with Hono `Context` type. Disabled redundant task component in statusline default config.

### Test Plan

#### For QA
1. Build the project (`bun run build`) — should succeed
2. Typecheck (`npx tsc -p core/tsconfig.json --noEmit`) — should pass clean
3. Verify zero `any` types in `routes-extended.ts` and `server.ts`
4. Status bar should no longer show task description segment

#### For Users
**What changed:** Internal type safety improvement. Cleaner status bar.
**Breaking changes:** None


## [1.6.6] - 2026-02-07

### Refactoring

- extract hardcoded values to constants (PRJ-71) (#129)


## [1.6.8] - 2026-02-07

### Refactor

- **Extract hardcoded values to constants (PRJ-71)**: Added `OUTPUT_LIMITS`, `STORAGE_LIMITS`, `EVENT_LIMITS` to `core/constants/index.ts`. Replaced 16 magic numbers across `output.ts` (11 truncation lengths), `bus.ts` (history limit), and `jsonl-helper.ts` (max lines, rotation size, warning threshold). All limits now configurable from one place with `as const` typing.


## [1.6.7] - 2026-02-07

### Refactor

- **Extract common agent-base.md template (PRJ-95)**: Created `templates/subagents/agent-base.md` with shared project context (path resolution, storage locations, rules). Added `{{> partial }}` include resolution in `sync-service.ts` that resolves partials during agent generation. Updated all 9 agent templates (5 domain + 4 workflow) to use `{{> agent-base }}` instead of duplicated content. Saves ~200 tokens per additional agent template.

## [1.6.6] - 2026-02-07

### Improvements

- **Type-safe error handling**: Added `getErrorMessage()` and `getErrorStack()` type guards to `core/types/fs.ts`. Replaced ~130 unsafe `(error as Error).message` casts across 59 files with safe `getErrorMessage(error)` calls. Fixed internal `as` casts in existing type guards (`isNotFoundError`, `isPermissionError`, etc.) to use `isNodeError()` guard instead. Zero remaining `(error as Error)` patterns in the codebase.

## [1.6.5] - 2026-02-07

### Bug Fixes

- **Replace console.error with logger in setup.ts**: 12 `console.error` warning calls replaced with `log.warn` for Gemini, Cursor, Windsurf, Antigravity, migration, status line, Context7, symlink, and gitignore warnings. User-facing chalk output preserved. Fatal direct-run error kept as `console.error`.

## [1.6.4] - 2026-02-06

### Bug Fixes

- **Replace console.error with logger in routes.ts**: Server routes now use the centralized `log` module instead of raw `console.error` for JSON read/write and context read errors. Production remains quiet by default; enable with `PRJCT_DEBUG=1`.

## [1.6.3] - 2026-02-06

### Improvements

- **Typed event bus payloads**: Added 15 typed payload interfaces (`SessionStartedPayload`, `SnapshotCreatedPayload`, etc.) and an `EventMap` type mapping event strings to their payloads. Convenience `emit` methods now enforce required fields at compile time. Backward compatible — callers with `Record<string, unknown>` still work.

### Implementation Details
- `core/types/bus.ts`: Added `EventMap` interface and all payload types
- `core/bus/bus.ts`: Generic overload `emit<K extends keyof EventMap>()`, typed convenience methods
- `core/types/index.ts`: Exported all new payload types

### Test Plan

#### For QA
1. `bun run typecheck` — zero errors
2. `emit.sessionStarted({})` → TS error for missing fields (IntelliSense works)
3. `bun test` — all 416 tests pass

#### For Users
- **What changed:** Event emit methods have typed payloads with autocomplete
- **Breaking changes:** None

## [1.6.2] - 2026-02-06

### Improvements

- **Diff preview before sync overwrites**: `prjct sync --dry-run` (or `--preview`) now shows what would change in CLAUDE.md without applying changes. Cancelling interactive sync restores the original file. Previously, files were written before the diff was shown, so cancel/preview still applied changes.

### Implementation Details
- Added `--dry-run` CLI flag as alias for `--preview`
- Added `restoreOriginal()` helper that writes back saved CLAUDE.md content on cancel/preview
- Non-interactive mode (LLM) restores original and returns JSON — apply with `prjct sync --yes`

### Test Plan

#### For QA
1. `prjct sync --dry-run` — diff shown, CLAUDE.md NOT modified
2. `prjct sync` → cancel — CLAUDE.md restored
3. `prjct sync` → approve — changes kept
4. `prjct sync --yes` — applied directly
5. `prjct sync --json` — JSON returned, CLAUDE.md restored

#### For Users
- **What changed:** `--dry-run` flag works correctly; cancel restores original
- **How to use:** `prjct sync --dry-run` to preview, `prjct sync --yes` to apply
- **Breaking changes:** None

## [1.6.1] - 2026-02-06

### Bug Fixes

- replace console.error with logger in bus.ts (PRJ-72) (#122)


## [1.6.1] - 2026-02-06

### Bug Fixes

- **Replace console.error with logger in bus.ts**: Event bus now uses the centralized `log` module instead of raw `console.error` for error logging. Silent catch block in `logEvent()` now logs at debug level with `getErrorMessage()` context. Production remains quiet by default; enable with `PRJCT_DEBUG=1`.

### Test Plan

#### For QA
1. Run `PRJCT_DEBUG=1 bun test` — verify bus errors appear with `[prjct:error]` prefix
2. Run `bun test` (no debug) — verify bus errors are silent by default
3. Trigger a listener error — verify it logs via logger, not console.error

#### For Users
- **What changed:** Error logging in event bus uses centralized logger
- **How to use:** `PRJCT_DEBUG=1` to see bus errors; quiet by default
- **Breaking changes:** None

## [1.6.0] - 2026-02-06

### Features

- super context for agents — skills.sh, proactive codebase context, effort/model (#121)


## [1.6.0] - 2026-02-06

### Features

- **Skills.sh auto-install**: During `prjct sync`, skills from skills.sh are automatically installed for generated agents. Real packages like `anthropics/skills/frontend-design`, `obra/superpowers/systematic-debugging`, and `obra/superpowers/test-driven-development` are mapped per agent domain.
- **Proactive codebase context**: The orchestrator now gathers real context before agent execution — git state, relevant files (scored by task relevance), code signatures from top files, and recently changed files. Agents start with a complete briefing instead of exploring first.
- **Effort/model metadata wiring**: Agent frontmatter `effort` and `model` fields are now extracted and injected into prompts, enabling per-agent reasoning depth control.

### Improved

- **Skill loading warnings**: Missing skills now log visible warnings with the agent that needs them and a hint to run `prjct sync`
- **Skill content in prompts**: Increased skill content truncation from 1000 to 2000 characters for richer context
- **Skill mappings v3**: Updated `skill-mappings.json` from generic names to real installable skills.sh packages

### Implementation Details

- `sync-service.ts`: New `autoInstallSkills()` method reads `skill-mappings.json`, checks if each skill is installed, and calls `skillInstaller.install()` for missing ones
- `orchestrator-executor.ts`: New `gatherRealContext()` calls `findRelevantFiles()`, `getRecentFiles()`, and `extractSignatures()` in parallel to build a proactive briefing
- `prompt-builder.ts`: New "CODEBASE CONTEXT" section with git state, relevant files table, code signatures, and recently changed files; plus effort/model per agent
- `agent-loader.ts`: New `extractFrontmatterMeta()` parses YAML frontmatter for effort/model fields
- `agentic.ts`: New `RealCodebaseContext` interface; `LoadedAgent` extended with `effort?` and `model?`

### Test Plan

#### For QA
1. Run `prjct sync` — verify skills auto-install (check `~/.claude/skills/`)
2. Run `p. task "test"` — verify prompt includes git state, relevant files, signatures, effort/model
3. Verify warnings for missing skills
4. Build and all 416 tests pass

#### For Users
**What changed:** Agents receive proactive codebase context before starting work. Skills auto-install during sync.
**How to use:** No action needed — automatic during `prjct sync` and `p. task`.
**Breaking changes:** None

## [1.5.2] - 2026-02-06

### Improved

- **TTY detection for CLI spinners**: Spinner, step, and progress animations now detect non-TTY environments (CI/CD, Claude Code, piped output) and print a single static line instead of animating

### Implementation Details

- Added `process.stdout.isTTY` guard to `spin()`, `step()`, and `progress()` in `core/utils/output.ts`
- Non-TTY environments get a single line with `\n` instead of `setInterval` with `\r` carriage returns
- Made `clear()` a no-op in non-TTY (the `\r` + spaces trick doesn't work outside terminals)
- Updated test for `stop()` to handle non-TTY behavior in test runner

### Learnings

- `process.stdout.isTTY` is the reliable built-in way to detect interactive terminals in Node.js
- Test suites (bun test) also run as non-TTY, so test assertions need to account for both paths

### Test Plan

#### For QA
1. Run `prjct sync --yes` in an interactive terminal — spinner should animate normally
2. Run `prjct sync --yes > out.txt` — output should show a single static line, no repeated frames
3. Run inside Claude Code Bash tool — output should be clean, no spinner noise
4. Verify `step()` and `progress()` behave the same way in both environments

#### For Users
**What changed:** CLI spinners no longer produce garbage output in non-interactive terminals
**How to use:** No action needed — automatic TTY detection
**Breaking changes:** None

## [1.5.1] - 2026-02-06

### Refactoring

- standardize on fs/promises across codebase (PRJ-93) (#118)


## [1.5.1] - 2026-02-06

### Changed

- **Standardize on fs/promises across codebase (PRJ-93)**: Replaced all synchronous `fs` operations (`existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`, etc.) with async `fs/promises` equivalents across 22 files

### Implementation Details

- Created shared `fileExists()` utility in `core/utils/fs-helpers.ts` replacing `existsSync` with `fs.access`
- Converted all detection functions in `ai-provider.ts` to async with `Promise.all` for parallel checks
- Applied lazy initialization pattern in `CommandInstaller` to handle async `getActiveProvider()` in constructor
- Replaced `execSync` with `promisify(exec)` in `registry.ts` and `ai-provider.ts`
- Converted `setup.ts` (~60 sync ops), `hooks-service.ts` (~30 sync ops), and all command/CLI files
- Updated prompt-builder and command-executor tests to handle async `build()` and `signalStart/End()`
- Intentional exceptions: `version.ts` (module-level constants), `jsonl-helper.ts` (`createReadStream`), test files

### Learnings

- Module-level constants (`VERSION`, `PACKAGE_ROOT`) cannot use async — sync reads at import time are a valid exception
- `createReadStream` is inherently sync (returns a stream) — the correct pattern for streaming reads
- Making a function async cascades to all callers — `ai-provider.ts` changes rippled to 10+ files
- Constructor methods can't be async — solved with lazy `ensureInit()` pattern in `CommandInstaller`

### Test Plan

#### For QA
1. Run `bun run build` — verify clean build with no errors
2. Run `bun test` — verify all 416 tests pass
3. Run `prjct sync` on a project — verify async fs operations work correctly
4. Run `prjct start` — verify setup flow works with async file operations
5. Verify `prjct linear list` works (uses converted linear/sync.ts)

#### For Users
**What changed:** Internal refactor — no user-facing API changes. All sync filesystem operations replaced with async equivalents for better performance.
**How to use:** No changes needed. All commands work identically.
**Breaking changes:** None

## [1.5.0] - 2026-02-06

### Features

- add citation format for context sources in templates (PRJ-113) (#117)

## [1.4.2] - 2026-02-06

### Features

- **Source citations in context files (PRJ-113)**: All generated context files now include `<!-- source: file, type -->` HTML comments showing where each section's data was detected from

### Implementation Details

- Added `SourceInfo` type and `ContextSources` interface with `cite()` helper (`core/utils/citations.ts`)
- Extended `ProjectContext` with optional `sources` field — backward compatible, falls back to `defaultSources()`
- Added `buildSources()` to `sync-service.ts` — maps detected ecosystem/commands data to their source files (package.json, lock files, Cargo.toml, etc.)
- Citations added to 4 markdown formatters: Claude, Cursor, Windsurf, Copilot. Continue.dev skipped (JSON has no comment syntax)
- Context generator CLAUDE.md also updated with citation support
- Source types: `detected` (from files), `user-defined` (from config), `inferred` (from heuristics)

### Learnings

- `context-generator.ts` and `formatters.ts` both independently generate CLAUDE.md content — both must be updated for consistent citations
- Sources can be determined post-detection from data values rather than threading metadata through every detection method
- Optional fields with fallback defaults (`sources?`) maintain backward compatibility without breaking existing callers

### Test Plan

#### For QA
1. Run `prjct sync --yes` — verify generated context files contain `<!-- source: ... -->` comments
2. Check CLAUDE.md citations before: THIS PROJECT, Commands, Code Conventions, PROJECT STATE
3. Check `.cursor/rules/prjct.mdc` citations before Tech Stack and Commands
4. Check `.windsurf/rules/prjct.md` citations before Stack and Commands
5. Check `.github/copilot-instructions.md` citations before Project Info and Commands
6. Verify `.continue/config.json` unchanged (JSON has no comments)
7. Run `bun test` — all 416 tests pass

#### For Users
**What changed:** Context files now show where data came from via HTML comments
**How to use:** Run `p. sync` — citations appear automatically
**Breaking changes:** None

## [1.4.1] - 2026-02-06

### Improvements

- **Better error messages for invalid commands (PRJ-98)**: Consistent, helpful CLI errors with did-you-mean suggestions and required parameter validation

### Implementation Details

- Added `UNKNOWN_COMMAND` and `MISSING_PARAM` error codes to centralized error catalog (`core/utils/error-messages.ts`)
- Added `validateCommandParams()` — parses `CommandMeta.params` convention (`<required>` vs `[optional]`) and validates against actual CLI args before command execution
- Added `findClosestCommand()` with Levenshtein edit distance (threshold ≤ 2) for did-you-mean suggestions on typos
- All error paths now use `out.failWithHint()` for consistent formatting with hints, docs links, and file references
- Deprecated and unimplemented command errors also upgraded to use `failWithHint()`

### Learnings

- `bin/prjct.ts` intercepts many commands (start, context, hooks, doctor, etc.) before `core/index.ts` — changes to dispatch only affect commands that reach core
- Template-only commands (e.g. `task`) are defined in `command-data.ts` but not registered in the command registry — they don't get param validation via CLI
- Levenshtein edit distance is simple to implement (~15 lines) and effective for CLI typo suggestions

### Test Plan

#### For QA
1. `prjct xyzzy` → "Unknown command: xyzzy" with help hint
2. `prjct snyc` → "Did you mean 'prjct sync'?"
3. `prjct shp` → "Did you mean 'prjct ship'?"
4. `prjct bug` (no args) → "Missing required parameter: description" with usage
5. `prjct idea` (no args) → "Missing required parameter: description" with usage
6. `prjct sync --yes` → works normally (no regression)
7. `prjct dash compact` → works normally (no regression)

#### For Users
**What changed:** CLI now shows helpful error messages with suggestions when you mistype a command or forget a required argument.
**How to use:** Just use prjct normally — errors are now more helpful automatically.
**Breaking changes:** None

## [1.4.0] - 2026-02-06

### Features

- programmatic verification checks for sync workflow (PRJ-106) (#115)

## [1.3.1] - 2026-02-06

### Features

- **Programmatic verification checks for sync workflow (PRJ-106)**: Post-sync validation with built-in and custom checks

### Implementation Details

New `SyncVerifier` service (`core/services/sync-verifier.ts`) that runs verification checks after every sync. Three built-in checks run automatically:
- **Context files exist** — verifies `context/CLAUDE.md` was generated
- **JSON files valid** — validates `storage/state.json` syntax
- **No sensitive data** — scans context files for leaked API keys, passwords, secrets

Custom checks configurable in `.prjct/prjct.config.json`:
```json
{
  "verification": {
    "checks": [
      { "name": "Lint CLAUDE.md", "command": "npx markdownlint CLAUDE.md" },
      { "name": "Custom validator", "script": ".prjct/verify.sh" }
    ],
    "failFast": false
  }
}
```

Integration: wired into `sync-service.ts` after file generation (step 11), results returned in `SyncResult.verification`. Display in `showSyncResult()` shows pass/fail per check with timing.

### Learnings

- Non-critical verification must be wrapped in try/catch so it never breaks the sync workflow
- Config types must match optional fields between `LocalConfig` and `VerificationConfig` (both `checks` must be optional)
- Built-in + custom extensibility pattern (always run built-ins, then user commands) provides good defaults with flexibility

### Test Plan

#### For QA
1. Run `prjct sync --yes` — verify "Verified" section with 3 checks passing
2. Add custom check to `.prjct/prjct.config.json` — verify it runs after sync
3. Add failing custom check (`command: "exit 1"`) — verify `✗` with error
4. Set `failFast: true` with failing check — verify remaining checks skipped
5. Run `bun run build && bun run typecheck` — zero errors

#### For Users
**What changed:** `prjct sync` now validates generated output with pass/fail checks
**How to use:** Built-in checks run automatically. Add custom checks in `.prjct/prjct.config.json`
**Breaking changes:** None

## [1.3.0] - 2026-02-06

### Features

- session state tracking for multi-command workflows (PRJ-109) (#114)


## [1.3.0] - 2026-02-06

### Features

- session state tracking for multi-command workflows (PRJ-109)

### Implementation Details

New `SessionTracker` service (`core/services/session-tracker.ts`) that manages lightweight session lifecycle for tracking command sequences and file access across CLI invocations.

Key behaviors:
- **Auto-create**: Sessions start automatically on first CLI command
- **Auto-resume**: Subsequent commands within 30 min extend the existing session
- **Auto-expire**: Sessions expire after 30 minutes of idle time, cleaned up on next startup
- **Command tracking**: Records command name, timestamp, and duration (up to 50 commands)
- **File tracking**: Records file reads/writes with timestamps (up to 200 records)

Integration points:
- `core/index.ts` — touch/track in main CLI dispatch (all standard commands)
- `bin/prjct.ts` — `trackSession()` helper for context/hooks/doctor commands
- `core/commands/analysis.ts` — session info in `prjct status` output (JSON + human-readable)
- `core/services/staleness-checker.ts` — `getSessionInfo()` and `formatSessionInfo()` with box-drawing display

Storage: `~/.prjct-cli/projects/{projectId}/storage/session.json`

### Learnings

- Non-critical tracking should always be wrapped in try/catch with silent fail — session tracking must never break CLI commands
- Touch-on-every-command pattern is simple but effective for session detection — no explicit start/stop needed
- Box-drawing characters (`┌─┐│└─┘`) provide clean structured output without external dependencies

### Test Plan

#### For QA
1. Run `prjct status` — verify "Session: ▶ Active" with duration, commands, idle timer
2. Wait 30+ minutes, run `prjct status` — verify "Session: ○ No active session"
3. Run multiple commands in sequence — verify command count increments
4. Run `prjct status --json` — verify session object in JSON output
5. Run `bun run build && bun run typecheck` — zero errors

#### For Users
**What changed:** CLI now tracks session state across commands for workflow visibility
**How to use:** Run `prjct status` to see active session info
**Breaking changes:** None

## [1.2.2] - 2026-02-06

### Performance

- convert execSync to async in ground-truth.ts (PRJ-92) (#113)
- convert execSync to async in ground-truth.ts (PRJ-92)


## [1.2.1] - 2026-02-06

### Performance

- **Convert execSync to async in ground-truth.ts (PRJ-92)**: Replaced blocking execSync with promisify(exec) in verifyShip

### Bug Fixes

- replace raw ANSI codes with chalk library (PRJ-132) (#111)

### Implementation Details

Replaced the single `execSync('git status --porcelain')` call in `verifyShip()` with `await execAsync()` using `promisify(exec)` from `node:util`. The rest of `ground-truth.ts` already used async `fs.promises` — this was the last synchronous call blocking the event loop.

### Learnings

- `exec` returns `{stdout, stderr}` object vs `execSync` returning a string directly — must destructure
- `promisify(exec)` is simpler than `spawn` for short-lived commands that return stdout
- Terminal control sequences (cursor movement) are separate from color/formatting — chalk doesn't handle them

### Test Plan

#### For QA
1. Run `bun run build && bun run typecheck` — zero errors
2. Trigger `verifyShip` path — verify async git status check works
3. Test with uncommitted changes — verify warning still appears
4. Test in non-git directory — verify graceful fallback (`gitAvailable = false`)

#### For Users
**What changed:** Internal performance improvement — git status check in ground-truth verifier is now async
**How to use:** No change needed — improvement is internal
**Breaking changes:** None

## [1.2.0] - 2026-02-06

### Features

- git hooks integration for auto-sync (PRJ-128) (#112)


## [1.2.0] - 2026-02-05

### Added

- **Git hooks integration (PRJ-128)**: New `prjct hooks` command for auto-syncing context on commit and branch checkout

### Implementation Details

New `prjct hooks` CLI subcommand with three operations:
- `prjct hooks install` — auto-detects hook manager (lefthook > husky > direct `.git/hooks/`) and installs post-commit + post-checkout hooks
- `prjct hooks uninstall` — cleanly removes only prjct hooks, preserving existing hooks
- `prjct hooks status` — shows active hooks, strategy, and available managers

Hook scripts feature:
- **Rate limiting** — 30-second lockfile prevents over-syncing on rapid commits
- **Background execution** — hooks run `prjct sync` in background, never blocking git
- **Branch-only checkout** — post-checkout only fires on branch switch, not file checkout
- **Cross-platform** — handles macOS/Linux differences in `stat` and `md5` commands

Supports three installation strategies:
- **Lefthook** — adds `prjct-sync-*` commands to existing `lefthook.yml`
- **Husky** — appends to existing `.husky/` hook scripts
- **Direct** — writes to `.git/hooks/` as fallback

Hook configuration saved to `project.json` for persistence across sessions.

### Learnings

- Strategy pattern works well for hook manager abstraction (detect → select → install)
- `stat -f%m` (macOS) vs `stat -c%Y` (Linux) for file modification time
- Lefthook section merging needs careful regex to avoid duplicates
- `$3` parameter in post-checkout distinguishes branch checkout (1) from file checkout (0)

### Test Plan

#### For QA
1. Run `prjct hooks status` — verify shows "Not installed" with available managers
2. Run `prjct hooks install` — verify detects manager and installs hooks
3. Run `prjct hooks status` — verify shows "Active"
4. Make a git commit — verify sync runs in background
5. Switch branches — verify post-checkout triggers sync
6. Run `prjct hooks uninstall` — verify clean removal
7. Run `bun run build && bun run typecheck` — zero errors

#### For Users
**What changed:** New `prjct hooks` command for automatic context syncing
**How to use:** Run `prjct hooks install` in any prjct project
**Breaking changes:** None

## [1.1.2] - 2026-02-05

### Fixed

- **Replace raw ANSI codes with chalk library (PRJ-132)**: Replaced ~60 raw ANSI escape codes across 7 files with chalk library calls

### Implementation Details

Replaced all raw ANSI color/formatting constants (`\x1b[32m`, `\x1b[1m`, etc.) with chalk equivalents (`chalk.green()`, `chalk.bold()`, etc.) in:
- `bin/prjct.ts` — version display, provider status, welcome message
- `core/index.ts` — version display, provider status
- `core/cli/start.ts` — gradient banner using `chalk.rgb()`, setup UI
- `core/utils/subtask-table.ts` — color palette as chalk functions, progress display
- `core/utils/help.ts` — all help formatting
- `core/workflow/workflow-preferences.ts` — hook status display
- `core/infrastructure/setup.ts` — installation messages

Terminal control sequences (cursor movement, hide/show) kept as raw ANSI since chalk only handles colors/formatting.

### Learnings

- `chalk.rgb(R,G,B)` replaces `\x1b[38;2;R;G;Bm` for true-color support
- Chalk functions can be stored as array values and called dynamically (useful for color palettes)
- `chalk.bold.white()` chains work for compound styling
- Terminal control sequences (`\x1b[?25l`, cursor movement) must stay raw — chalk doesn't handle them

### Test Plan

#### For QA
1. Run `prjct --version` — verify colored output with provider status
2. Run `prjct help` — verify formatted help with colors
3. Run `prjct start --force` — verify gradient banner and colored UI
4. Set `NO_COLOR=1` and repeat above — verify all color is suppressed
5. Run `bun run build && bun run typecheck` — verify zero errors

#### For Users
**What changed:** Terminal colors now use the chalk library instead of raw ANSI codes
**How to use:** No change — colors appear the same but now respect `NO_COLOR` env variable
**Breaking changes:** None

## [1.1.1] - 2026-02-06

### Bug Fixes

- visual grouping with boxes and tables for structured output (PRJ-134) (#110)

## [1.1.1] - 2026-02-05

### Improved

- **Visual grouping for structured output (PRJ-134)**: Added `out.section()` and integrated `out.box()`, `out.table()`, `out.list()` into sync, doctor, and status commands

### Implementation Details

Added `out.section(title)` method to the unified output system (`core/utils/output.ts`) — bold title with dim underline, chainable, quiet-mode aware.

Refactored three commands to use unified output helpers instead of raw `console.log`:
- **Sync** (`analysis.ts`): Summary metrics in `out.box()`, generated items via `out.section()` + `out.list()`
- **Doctor** (`doctor-service.ts`): Section headers via `out.section()`, recommendations via `out.list()`, summary via `out.done()`/`out.warn()`/`out.fail()`
- **Status** (`staleness-checker.ts`): Key-value details wrapped in box-drawing characters

### Learnings

- `staleness-checker.formatStatus()` returns a string (not direct output), so `out.box()` can't be used directly — used inline box-drawing chars instead
- Doctor service had its own icon logic for check results that was worth preserving alongside the new section headers
- Unified output helpers reduce code while maintaining the same visual style

### Test Plan

#### For QA
1. Run `prjct sync` — verify boxed "Sync Summary" with metrics, "Generated" section header with underline, `✓` bullet items
2. Run `prjct doctor` — verify bold+underline section headers for "System Tools", "Project Status", "Recommendations"
3. Run `prjct status` — verify key-value details in box-drawing characters
4. Run with `--quiet` flag — verify no visual output is printed

#### For Users
**What changed:** CLI output now uses visual grouping (boxes, section headers, structured lists) for better scannability
**How to use:** No changes needed — output is automatically improved
**Breaking changes:** None

## [1.1.0] - 2026-02-05

### Features

- visual workflow status command (PRJ-140) (#109)


## [1.1.0] - 2026-02-05

### Features

- **Workflow visualization (PRJ-140)**: New `p. status` command with visual workflow diagram

### Implementation Details

Added visual workflow status template showing:
- ASCII workflow diagram with current position indicator (sync → task → work → done → ship)
- Subtask tree visualization with status icons (✅/🔄/⬜)
- Progress bar for subtask completion
- Paused tasks, queue summary, and recent ships
- Context staleness indicator from `prjct status --json`
- Compact mode for single-line status output

### Learnings

- Template-first approach: Complex visualizations can be defined entirely in markdown templates without code changes

### Test Plan

#### For QA
1. Run `prjct sync` to install new status template
2. Run `p. status` - verify workflow diagram displays
3. Verify subtask tree shows correct status icons
4. Test `p. status compact` for single-line output

#### For Users
- New `p. status` command shows visual workflow overview
- No breaking changes


## [1.0.0] - 2026-02-05

### Features

- add input source tagging for context items (PRJ-102) (#106)
- add timeout management with configurable limits (PRJ-111) (#104)
- implement graceful degradation for missing dependencies (PRJ-114) (#103)
- add .prjct-state.md local state file for persistence (PRJ-112) (#102)
- hierarchical AGENTS.md resolution and template improvements (PRJ-101) (#99)
- add staleness detection for CLAUDE.md context (PRJ-120) (#97)
- complete Linear/JIRA workflow integration (#95)
- monorepo support with nested PRJCT.md inheritance (PRJ-118) (#94)
- implement output tiers for cleaner CLI output (#88)
- modular CLAUDE.md for reduced token usage - PRJ-94 (#86)
- Add showMetrics config option - PRJ-70 (#82)
- Selective memory retrieval based on task relevance - PRJ-107 (#81)
- Add session stats to p. stats command - PRJ-89 (#80)
- Lazy template loading with TTL cache - PRJ-76 (#79)
- Add confidence scores to all stored preferences - PRJ-104 (#78)
- Context diff preview before sync applies - PRJ-125 (#77)
- Unified output system with new methods - PRJ-130 (#76)
- Error messages with context and recovery hints - PRJ-131 (#75)
- Read-before-write enforcement for templates - PRJ-108 (#74)
- Complete and improve help text documentation - PRJ-133 (#73)
- Workflow hooks via natural language - PRJ-137 (#72)
- Subtask progress dashboard with domain colors - PRJ-138 (#71)
- preserve user customizations during sync - PRJ-115 (#70)
- automated release pipeline - PRJ-147 (#68)
- add project indexing and analysis services (PRJ-85, PRJ-87) (#66)
- metrics display in output (PRJ-68, PRJ-69) (#54)
- add prjct uninstall command (PRJ-146) (#65)
- add prjct doctor command (PRJ-117) (#62)
- smart watch mode - auto-sync on file changes (PRJ-123) (#61)
- add --quiet flag for silent output (PRJ-97) (#60)
- interactive onboarding wizard (PRJ-124) (#58)
- smart context filtering tools for AI agents (PRJ-127) (#57)
- workflow state machine + bidirectional Linear sync (#55)
- progress indicators for long-running operations (PRJ-129) (#52)
- agent activity stream for real-time visibility (PRJ-135) (#51)
- show explicit next steps after each command (PRJ-136) (#50)
- multi-agent output Phase 3 - Auto-detect + Continue.dev (PRJ-126) (#49)
- multi-agent output Phase 2 - Copilot + Windsurf (PRJ-126) (#48)
- multi-agent context output - Phase 1 (PRJ-126) (#47)
- bidirectional sync Linear ↔ prjct (PRJ-142) (#46)
- migrate Linear and JIRA from MCP to native SDK (PRJ-141) (#45)
- enhance skill system with remote installation and lock file (#44)
- Windsurf IDE support (PRJ-66) (#43)
- Google Antigravity support via Skills (PRJ-64) (#42)
- add mandatory plan-before-action rule to all agents
- Cursor IDE support (PRJ-63) (#40)
- Cursor IDE support (PRJ-63)
- dual platform support - Claude + Gemini (PRJ-62) (#39)
- 100% agentic task routing with subtask fragmentation
- add agent/skill orchestrator + agentskills.io integration
- auto-install MCP servers + individual command skills
- AI-powered ticket enrichment + 4 tracker integrations v0.33.0
- JIRA MCP integration for corporate SSO v0.32.0
- JIRA Integration v0.31.0 (#30)
- PM Expert auto-enrichment + statusline fixes v0.30.2
- add p. update command for manual sync
- modular statusline with Linear integration v0.29.0 (#29)
- redesign build and release flow for npm
- modular statusline with Linear integration v0.29.0
- integrate issue tracker and AI enrichment for project management
- per-project task filtering for status bar v0.28.0
- Skill integration system v0.27.0 (#24)
- Claude Code Skill Integration (Agentic) v0.27.0
- Complete development cycle with workflow integrity v0.26.0
- Unified /p:task command + auto-sync notification v0.24.0
- Branch + PR workflow v0.23.0
- Notion per-project databases + skill registration v0.22.0
- add optional Notion integration v0.21.0
- enhance error handling and permissions management
- UX/UI Design Agent Integration v0.20.0
- prompt-builder fix + web removal v0.19.0
- add TestSprite integration for AI-powered testing
- CLI-API sync bridge + /p:auth command v0.18.0
- Claude Code sub-agents integration v0.17.0
- Security, performance, and architecture improvements v0.16.1
- Dead code cleanup - remove ~6,600 lines v0.16.0
- Add MCP server configuration for Context7
- Template optimization - reduce 39 to 27 commands v0.15.0
- Refactor Project Management with UUID Migration and Enhanced Context Handling
- Enhance Project Management with Terminal Dock and UI Improvements
- Actionable Dashboard + Session Recovery v0.14.0
- Add MomentumWidget + Code workspace + Weekly reports
- Ship Deep Sync + Cleanup migrations v0.13.0
- MigrationGate + bug fixes
- JSON-First Architecture (Zero Data Loss)
- Implement project stats API and enhance UI components
- Enhance project management and terminal functionality in web application
- Revamp web application with Next.js and enhanced features
- Introduce new server and web components for prjct
- Release 0.10.14 with 100% agentic delegation and task tool integration
- Add ⚡ prjct branding with animated spinner
- 100% agentic agent assignment - JS=orchestrator, Claude=decisions
- 100% agentic system - eliminate all procedural keyword-based logic
- Release 0.10.10 with executable templates and context reduction
- Release 0.10.8 with minimal output system and reduced CLI verbosity
- Release 0.10.7 with critical improvements and enhanced context handling
- Enhanced global CLAUDE.md template for better prjct usage
- Rich project context for Claude
- Dynamic project context for Claude
- Intelligent Agent System & Performance Optimization (v0.10.0)
- add November 22, 2025 release notes for version 0.9.1
- context optimization and prompt conciseness
- add legacy installation detector and cleanup system for pre-v0.8.2 curl installations
- add system timestamp tools and optimize top 7 templates
- memory-efficient file operations for large JSONL files
- simplify installation to npm-only with automatic post-install setup
- v0.8.0 - conversational interface with zero memorization
- add comprehensive testing documentation
- add website component tests and configure vitest workspace
- migrate test suite to Vitest with coverage reporting
- add isSupported flag to agent detection for Claude and Terminal agents
- add setup, migrate-all commands and mark roadmap/status/build as implemented
- redesign footer layout and add AI policy page with updated navigation
- add Vercel Analytics and Speed Insights tracking to website
- simplify workflow to 5 essential commands
- rebrand from project management to developer momentum tool with streamlined templates and workflows
- add editor uninstallation and smart project data fusion to prjct init
- add first-time setup flow and auto-initialization for all commands
- add auto-migration from v0.1.0 projects during post-install hook
- add auto-install and clean uninstall functionality with editor tracking
- add GitHub Packages support and track installed editors in config
- add Windows compatibility feature card to changelog
- add automatic npm publication and update detection system
- publish prjct-cli to npm registry
- remove bun and homebrew installation methods
- add natural language interface with multi-language support
- add interactive workflow system with capability detection and installation
- release v0.3.0 with interactive editor selection and codebase analysis
- add project management workflows for analyzing, tracking, and fixing tasks
- update CNAME handling and add 404 page for better routing
- add cleanup and design commands with advanced options
- initialize project structure with core files and documentation

### Bug Fixes

- generate IDE context files with correct paths and formats (PRJ-122) (#107)
- improve sync output with summary-first format (PRJ-100) (#100)
- correct template paths and agent loading in CLAUDE.md (#93)
- make lefthook hooks portable (no bun required) (#92)
- skip lefthook in CI environments (#91)
- use npm instead of bun in lefthook hooks (#90)
- add pre-commit hooks to prevent commits with lint errors (#89)
- remove legacy p.*.md commands on sync
- ensure test isolation in IndexStorage tests
- remove MCP integrations, keep only Context7 (#87)
- make Linear/JIRA templates explicitly ignore MCP tools
- remove MCP inheritance from Linear/JIRA templates
- standardize confirmation pattern across all commands (#85)
- LLM must handle the prompts, not the CLI - PRJ-149 (#84)
- Claude over-plans simple commands like p. sync - PRJ-148 (#83)
- implement silent memory application - PRJ-103 (#69)
- ignore tar warning in release workflow - PRJ-147
- remove --provenance (requires public repo) - PRJ-147
- use Production environment for npm secrets - PRJ-147
- use semver-sorted tags for version detection - PRJ-147
- npm auth configuration for CI publish - PRJ-147
- add Bun setup for test runner in CI - PRJ-147
- use npm instead of bun for CI tests - PRJ-147
- remove IDE files from repo - PRJ-144, PRJ-145
- add --help handler in CLI entry point for CI compatibility
- update tests for CI compatibility
- CI workflow - remove unsupported bun reporter flag and fix verification
- enforce workflow steps in templates (PRJ-143) (#56)
- add $PRJCT_CLI prefix to relative paths in templates (PRJ-143)
- use stderr for Linear connection log to not break JSON output
- show Cursor in same format as other providers in --version
- Cursor command syntax (PRJ-65) (#41)
- reduce permission prompts from 50+ to 1 (#38)
- cleanup legacy files and fix TS error (#37)
- chore: release v0.35.2
- connect CLI workflow to CommandExecutor
- execute orchestration in TypeScript, not just paths (#36)
- execute orchestration in TypeScript, not just paths
- remove unsafe 'as unknown' casts (PRJ-54)
- complete error differentiation (Phase 3) (#35)
- enable enrichment by default in statusline config
- self-healing setup in bin/prjct v0.30.1
- distribution system overhaul - remove fallback, always read from npm root v0.30.0
- setup.ts auto-execute when run directly
- remove duplicate statusline version check
- dynamic path resolution for compiled dist/
- ALWAYS run postinstall setup, remove global detection
- detect /opt/homebrew for M1/M2 Macs in postinstall
- handle bun test warnings in release script
- include assets/ in npm package + add linear to router
- add cliVersion to project.json on postinstall
- resolve symlinks in bin/prjct for npm install
- agents only write to global storage v0.18.2
- agents only in global storage + auto-migrate legacy v0.18.1
- serve.js use start instead of start:prod
- Remove migration gate from production
- Restore sidebar collapse + fix server OOM crash
- Prevent terminal session loss on navigation
- Terminal responsive & performance issues
- Server runs in production mode, port 9472
- Export commands as singleton for direct invocation
- Update global CLAUDE.md on sync, analyze, and init
- Add glob dependency and update to modern API
- critical memory leaks - LRU cache, HTTP cleanup, session expiration
- ensure command templates always update by removing mtime checks and forcing overwrites
- resolve critical installation bugs and add auto-update functionality with visual feedback
- resolve TypeScript errors in website tests
- remove unused variables to pass lint
- update vercel build and install commands to use npm prefix syntax
- remove unused Globe import from Privacy.tsx
- resolve TypeScript errors in website build
- remove vercel.json, configure Root Directory in Vercel UI
- set rootDirectory to website for Vercel
- use npm --prefix for Vercel build command
- correct Vercel install command path
- configure Vercel deployment output directory
- restore Catppuccin-inspired ASCII art and fix undefined editor names in prjct start command
- update Badge import path to use correct casing
- return success exit code for help command
- remove install script tests from workflow
- add TERM environment variable to workflow steps
- add missing WorkflowsGuide.tsx to repository
- deploy install.sh and setup.sh to website
- replace inquirer with prompts for better CommonJS compatibility in interactive editor selection
- resolve installation path errors in setup scripts and add verification tests
- update init command to use global architecture and fix installer version display
- update install command URL to use www.prjct.app
- build(deps-dev): bump vite from 4.5.14 to 7.1.7 in /docs (#1)

### Performance

- parallelize agent/skill loading with Promise.all (PRJ-110) (#101)
- parallelize sync operations for 30-50% speedup (PRJ-116) (#59)

### Refactoring

- migrate from ESLint + Prettier to Biome
- consolidate and optimize CI workflows
- extract StackDetector from sync-service (PRJ-86) (#64)
- extract ContextFileGenerator from sync-service (PRJ-88) (#63)
- differentiate error types in catch blocks - Phase 2 (PRJ-60) (#34)
- differentiate error types in catch blocks (PRJ-51) (#33)
- simplify logger level detection logic (#32)
- consolidate hardcoded paths to use pathManager singleton (#31)
- type consolidation in core/types/ v0.20.1
- centralize types in core/types/ following DRY principles
- restructure command and agent modules for improved organization
- consolidate command and storage modules for improved structure
- migrate testing setup to Bun and enhance documentation
- Update project structure and enhance component functionality
- update command registry structure and remove unused imports
- remove open source references and GitHub links
- move Changelog link from header to footer
- use centralized helper utilities in commands
- migrate from GitHub Pages to Vercel deployment
- remove redundant title from changelog technical details section
- extract reusable components from Changelog.tsx
- sync install.sh from scripts directory to website/public and docs
- remove unnecessary comments from prjct.sh script
- remove unnecessary comments from command line parsing logic
- remove comments and unnecessary whitespace across core modules
- move author data and system fields from local to global config
- migrate legacy project files to new global structure with auto-migration
- rename landing directory to website and update deploy workflow paths
- update build paths from docs to lp directory in deploy workflow
- improve GitHub Pages deployment workflow with better file handling and directory structure


## [0.64.1] - 2026-02-05

### Bug Fixes

- **IDE context file generation (PRJ-122)**: Fixed Cursor and Windsurf context file paths and formats

### Implementation Details

Fixed misalignment between `ai-provider.ts` (correct paths) and `ai-tools/registry.ts` (incorrect paths). Updated Cursor output to `.cursor/rules/prjct.mdc` with MDC format and `alwaysApply: true` frontmatter. Updated Windsurf output to `.windsurf/rules/prjct.md` with `trigger: always_on` frontmatter. Modified sync-service default behavior to auto-detect IDE tools when `.cursor/` or `.windsurf/` directories exist.

### Learnings

- Two separate implementations existed (ai-provider vs ai-tools) that needed synchronization
- IDE formats differ: Cursor uses `alwaysApply: true`, Windsurf uses `trigger: always_on`
- Auto-detection pattern: check for directory existence to enable optional features

### Test Plan

#### For QA
1. Run `prjct sync` in project with `.cursor/` dir - verify `.cursor/rules/prjct.mdc` generated
2. Run `prjct sync` in project with `.windsurf/` dir - verify `.windsurf/rules/prjct.md` generated
3. Verify Cursor file has `alwaysApply: true` in frontmatter
4. Verify Windsurf file has `trigger: always_on` in frontmatter
5. Run `bun test` - all 405 tests pass

#### For Users
- `prjct sync` now auto-generates IDE context files when `.cursor/` or `.windsurf/` directories exist
- No manual flags needed - detection is automatic
- No breaking changes


## [0.64.0] - 2026-02-05

### Features

- add input source tagging for context items (PRJ-102) (#106)


## [0.63.2] - 2026-02-05

### Added

- **Input source tagging (PRJ-102)**: Context items now support origin tracking via `_source` metadata

### Implementation Details

Added `InputSource` type with 10 standardized source categories (user_explicit, user_file, system_detected, system_generated, system_inferred, learned, external, inherited, cached, unknown). Created `SourceMetadata` interface with capturedAt timestamp and optional confidence/sourcePath fields. Added `SourcedItem` base interface and `createSourceMetadata()` helper function. Extended key context interfaces (AgentInfo, FeatureInfo, PatternInfo, GatheredInfo, LoadedAgent) to support source tracking. Updated MemoryMetadata with inputSource field for consistency.

### Learnings

- Anthropic pattern: always track origin of all data for traceability and debugging
- Using optional `_source` field allows backward-compatible adoption

### Test Plan

#### For QA
1. Run `bun run typecheck` - passes with new types
2. Run `bun test` - all 368 tests pass
3. Verify `InputSource` type is exported from `core/types`

#### For Users
- Context items now support source tracking via `_source` metadata
- Use `createSourceMetadata()` when creating context items
- No breaking changes


## [0.63.1] - 2026-02-05

### Added

- **Unit tests for smart-context.ts (PRJ-84)**: 57 tests covering domain detection, file filtering, and type mappings

### Implementation Details

Created comprehensive test suite for SmartContext class: `detectDomain()` tests for all 6 domains (frontend, backend, devops, docs, testing, general), `filterFiles()` tests for file pattern matching, `estimateSize()` tests for token estimation, and type mapping function tests.

### Learnings

- Keyword detection uses substring matching - "be" in "better" matches backend keyword
- Frontend file pattern `/\.(tsx?|jsx?)$/` also matches plain `.ts` files (known behavior)
- Confidence scoring caps at 0.95 regardless of keyword count

### Test Plan

#### For QA
1. Run `bun test core/__tests__/agentic/smart-context.test.ts` - all 57 tests pass
2. Run `bun test` - full suite passes (368 tests)

#### For Users
- No user-facing changes (test coverage improvement)


## [0.63.0] - 2026-02-05

### Features

- add timeout management with configurable limits (PRJ-111) (#104)


## [0.62.1] - 2026-02-05

### Improved

- **Timeout management (PRJ-111)**: Operations now timeout gracefully with configurable limits instead of hanging indefinitely

### Implementation Details

Added `TIMEOUTS` constants with `getTimeout()` helper function supporting environment variable overrides (`PRJCT_TIMEOUT_*`). Applied timeouts to: npm install (120s), git operations (10s), git clone (60s), and fetch API calls (30s via AbortController). Timeout errors now include helpful hints for increasing limits.

### Learnings

- AbortController is the standard way to timeout fetch() calls - create controller, set timeout to call abort(), pass signal to fetch
- Environment variable pattern `PRJCT_TIMEOUT_*` allows user configurability without config files

### Test Plan

#### For QA
1. Set `PRJCT_TIMEOUT_GIT_OPERATION=100` (100ms) and run `prjct sync` - should timeout
2. Unset env var, run `prjct sync` on a large repo - should complete within 10s
3. Test npm install timeout with `PRJCT_TIMEOUT_NPM_INSTALL=1000` (1s) - should timeout with helpful message

#### For Users
- Operations now timeout gracefully instead of hanging indefinitely
- Set `PRJCT_TIMEOUT_*` env vars to customize timeouts (e.g., `export PRJCT_TIMEOUT_API_REQUEST=60000` for 60s)
- No breaking changes


## [0.62.0] - 2026-02-05

### Features

- implement graceful degradation for missing dependencies (PRJ-114) (#103)


## [0.62.0] - 2026-02-05

### Improved

- **Graceful degradation (PRJ-114)**: prjct now handles missing dependencies with helpful recovery hints instead of crashing

### Implementation Details

Created `DependencyValidator` service with `checkTool()`, `ensureTool()`, and caching. Integrated into GitAnalyzer, SkillInstaller, and setup.ts. Replaced shell pipes (`wc -l`, `sed`) with JS string operations for cross-platform compatibility. Added alternative installation suggestions (yarn, pnpm, brew) when npm fails.

### Learnings

- Shell pipes like `wc -l` and `sed` aren't cross-platform - use JS string operations instead
- execSync calls are expensive - cache results with TTL
- npm may not be available even when node is - check separately

### Test Plan

#### For QA
1. Run `prjct sync` on a machine without git - verify helpful error message instead of crash
2. Run `prjct skill install owner/repo` without git - verify error suggests install methods
3. Run `prjct start` without npm - verify suggests alternatives (yarn, pnpm, brew)
4. Run `prjct doctor` - verify all tool checks display correctly

#### For Users
- prjct now gracefully handles missing dependencies with helpful recovery hints
- Automatic - errors include installation suggestions
- No breaking changes


## [0.61.0] - 2026-02-05

### Features

- add .prjct-state.md local state file for persistence (PRJ-112) (#102)


## [0.61.0] - 2026-02-05

### Features

- **Local state file (PRJ-112)**: New `.prjct-state.md` file generated in project root for local persistence

### Implementation Details

Created `LocalStateGenerator` service that generates a markdown file showing current task state. Integrated via write-through pattern - `StateStorage.write()` now also generates the local state file. Also hooks into `sync-service.ts` for state.json updates during sync.

### Learnings

- Write-through pattern: JSON storage triggers MD generation automatically
- State can be written from multiple entry points (storage class + sync service) - need hooks in both places

### Test Plan

#### For QA
1. Run `prjct sync` on any project - verify `.prjct-state.md` is generated in project root
2. Start a task with `p. task "test"` - verify `.prjct-state.md` updates with task info
3. Check that subtasks, progress, and status are displayed correctly
4. Verify the file has "DO NOT EDIT" header comment

#### For Users
- New `.prjct-state.md` file in project root shows current task state
- Automatic - file updates whenever prjct state changes
- No breaking changes


## [0.60.2] - 2026-02-05

### Performance

- parallelize agent/skill loading with Promise.all (PRJ-110) (#101)


## [0.60.2] - 2026-02-05

### Performance

- **Parallel agent/skill loading (PRJ-110)**: Agent and skill loading now uses `Promise.all` for parallel I/O

### Implementation Details

Refactored `loadAgents()` and `loadSkills()` in `core/agentic/orchestrator-executor.ts` to use `Promise.all` with map instead of sequential for loops. Also parallelized `loadAllAgents()` in `core/domain/agent-loader.ts`. Pattern: collect items → map to async promises → Promise.all → filter nulls with type guard.

### Learnings

- Use `Promise.all(items.map(async (item) => ...))` for parallel async operations
- Return null for failed items, then filter - can't push to array in parallel
- Collect unique items first (deduplication), then parallelize reads

### Test Plan

#### For QA
1. Run `prjct sync --yes` - verify agents load successfully
2. Run `p. task "test"` - verify orchestrator works
3. Check no errors in agent/skill loading output

#### For Users
- Agent and skill loading is now faster (parallel I/O)
- No changes needed - improvement is automatic


## [0.60.1] - 2026-02-05

### Bug Fixes

- improve sync output with summary-first format (PRJ-100) (#100)


## [0.60.1] - 2026-02-05

### Improved

- **Sync output UX (PRJ-100)**: Summary-first format with key metrics prominent, ~50% less output

### Implementation Details

Refactored `showSyncResult()` in `core/commands/analysis.ts` to show success line with timing immediately, followed by single-line metrics (files → context | agents | reduction). Removed redundant bottom summary section. Fixed compressionRate calculation (was decimal, now percentage). Added conditional display for low-value metrics (only show reduction if >10%). Fixed pluralization ("1 skill" not "1 skills").

### Learnings

- `syncMetrics.compressionRate` is a decimal (0-1), not percentage - multiply by 100
- Summary-first output pattern improves scannability
- Conditional metric display reduces noise for low-value data

### Test Plan

#### For QA
1. Run `prjct sync --yes` on any project
2. Verify output shows success line first with timing: `✅ Synced {project} ({time}s)`
3. Verify single-line metrics: `{files} files → {context} context | {agents} agents`
4. Verify compression rate only shows if > 10%
5. Verify pluralization is correct ("1 skill" not "1 skills")

#### For Users
- Sync output is now more scannable - key metrics appear first instead of buried at bottom
- Run `p. sync` as usual - new format is automatic
- No breaking changes


## [0.60.0] - 2026-02-05

### Features

- hierarchical AGENTS.md resolution and template improvements (PRJ-101) (#99)


## [0.60.0] - 2026-02-05

### Features

- **Hierarchical AGENTS.md resolution (PRJ-101)**: Agent files can now be discovered and loaded hierarchically from any directory level
- **Learnings capture on task completion**: Templates now capture patterns, approaches, and decisions for LLM knowledge transfer
- **Local-first issue tracking**: READ LOCAL, WRITE REMOTE pattern for Linear/JIRA (faster, fewer tokens)

### Changed

- **Statusline improvements**: `p/` → `p.`, branch names truncated to 10 chars, neutral colors
- **Templates use `prjct` CLI directly**: No more dependency on `$PRJCT_CLI` environment variable
- **Ship always marks Done**: Issue tracker status updated to Done after ship (work complete)

### Implementation Details

Implemented hierarchical agent resolution allowing AGENTS.md files at any directory level to define domain-specific patterns. Extended NestedContextResolver to discover these files and HierarchicalAgentResolver to merge them. Updated templates to enforce issue tracker updates and capture learnings on completion.

### Learnings

- LLMs tend to skip template steps even when marked mandatory - need explicit POST-MERGE sections
- `$PRJCT_CLI` may not be set - use `prjct` CLI directly
- Local-first caching critical for token efficiency
- Neutral colors better than brand colors for dev tools

### Test Plan

#### For QA
1. Run `p. sync` → Verify statusline shows `p.` instead of `p/`
2. On long branch name → Verify truncates to 10 chars after `/`
3. Run `p. task PRJ-XXX` → Should read from local `issues.json`, not API
4. Run `p. done` → Should update Linear status to Done
5. Run `p. ship` after merge → Must update issue tracker before outputting success

#### For Users
- Statusline: `p/` → `p.`, branch names truncated, neutral colors
- Templates enforce issue tracker updates (never skipped)
- Learnings captured on task completion for LLM knowledge transfer


## [0.59.1] - 2026-02-05

### Tests

- **command-executor.ts tests (PRJ-82)**: Added 26 unit tests for the command execution pipeline


## [0.59.0] - 2026-02-05

### Features

- add staleness detection for CLAUDE.md context (PRJ-120) (#97)


## [0.58.0] - 2026-02-05

### Features

- complete Linear/JIRA workflow integration (#95)


## [0.57.0] - 2026-02-05

### Features

- monorepo support with nested PRJCT.md inheritance (PRJ-118) (#94)


## [0.57.0] - 2026-02-05

### Features

- **Monorepo support (PRJ-118)**: Support nested PRJCT.md files for monorepo subdirectories
  - Detect monorepos (pnpm, npm, yarn, lerna, nx, turborepo, rush)
  - Discover packages with workspace patterns
  - Nested PRJCT.md inheritance (deeper files take precedence)
  - Per-package CLAUDE.md generation with merged context
  - `prjct sync --package=<name>` for single package sync

### Added

- `NestedContextResolver` service for PRJCT.md discovery and inheritance
- `detectMonorepo()` and `discoverMonorepoPackages()` in PathManager
- `generateMonorepoContexts()` in ContextFileGenerator

## [0.56.1] - 2026-02-05

### Bug Fixes

- **Context injection**: Fixed template paths in CLAUDE.md - now correctly points to `~/.claude/commands/p/` instead of `templates/commands/`
- **Agent loading**: Added clear instructions for loading domain agents before SMART commands (task, ship, bug, done)

## [0.56.0] - 2026-02-05

### Features

- implement output tiers for cleaner CLI output (#88)

### Bug Fixes

- make lefthook hooks portable (no bun required) (#92)
- skip lefthook in CI environments (#91)
- use npm instead of bun in lefthook hooks (#90)
- add pre-commit hooks to prevent commits with lint errors (#89)


## [0.55.6] - 2026-02-04

### Fixed

- **Portable git hooks**: Removed `skip_in_ci` and test from pre-push hook - hooks now work everywhere with npm-only commands (lint, typecheck). Tests run in CI where bun is properly installed.

## [0.55.5] - 2026-02-05

### Added

- **Pre-commit hooks**: Added lefthook for git hooks - blocks commits with lint/format errors
- **Pre-push hooks**: Runs typecheck and tests before push

### Fixed

- Fixed 3 lint errors (import ordering, formatting)

## [0.55.4] - 2026-02-05

### Features

- **Output tiers**: New tiered output system (silent/minimal/compact/verbose) for cleaner CLI output
- **Human-friendly Linear output**: `p. linear list` now shows concise table instead of raw JSON
- **--json flag**: Use `--json` to get machine-parseable JSON output when needed
- **--verbose flag**: Use `--verbose` for full untruncated output

### Improved

- Removed noisy `[linear] Connected as...` messages from every API call
- Added `limitLines()` and `formatForHuman()` utilities for consistent output formatting

### Bug Fixes

- remove legacy p.*.md commands on sync

### Tests

- Added 11 new tests for output tier functionality

## [0.55.3] - 2026-02-05

### Bug Fixes

- ensure test isolation in IndexStorage tests
- remove MCP integrations, keep only Context7 (#87)


## [0.56.0] - 2026-02-04

### Breaking Changes

- **Removed MCP-based integrations** (Monday.com, GitHub Issues)
  - Only Context7 remains as the sole MCP server (for library docs)
  - Linear and JIRA use SDK/REST API directly (4x faster)

### Features

- **Context7 auto-install**: Now automatically configured in `~/.claude/mcp.json` on `prjct init`

### Fixed

- Templates no longer reference non-existent CLI commands (`prjct context task`, etc.)
- All workflow templates (task, done, bug, pause, resume, next, dash) now use Read/Write directly

### Removed

- `templates/commands/monday.md` - MCP integration
- `templates/commands/github.md` - MCP integration
- `templates/_bases/tracker-base.md` - MCP base template
- `core/integrations/jira/mcp-adapter.ts` - Unused MCP adapter

## [0.55.2] - 2026-02-04

### Bug Fixes

- make Linear/JIRA templates explicitly ignore MCP tools


## [0.55.1] - 2026-02-04

### Bug Fixes

- **Linear/JIRA templates no longer inherit MCP-based tracker-base**
  - Removed `extends: '_bases/tracker-base.md'` from `linear.md` and `jira.md`
  - Both templates have complete SDK-based implementations (4x faster than MCP)
  - Fixes bug where `p. linear setup` kept asking users to "restart Claude Code for MCP"
  - Updated `tracker-base.md` to clarify it's only for MCP trackers (GitHub, Monday)

## [0.55.0] - 2026-01-30

### Features

- modular CLAUDE.md for reduced token usage - PRJ-94 (#86)

## [0.54.4] - 2026-01-30

### Improved

- **Modular CLAUDE.md for reduced token usage** (PRJ-94)
  - Split global template into 5 modules: core, git, storage, commands, intelligence
  - Added profile-based composition: minimal (84% reduction), standard (56%), full (23%)
  - FAST commands (sync, next, dash) use minimal profile (~394 tokens)
  - SMART commands (task, ship, bug) dynamically inject additional modules
  - Target 40-60% token reduction achieved for simple commands

## [0.54.3] - 2026-01-30

### Bug Fixes

- standardize confirmation pattern across all commands (#85)


## [0.54.3] - 2026-01-30

### Fixed

- Standardize confirmation pattern across all commands to use AskUserQuestion
  - Updated `ship.md`, `merge.md`, `git.md`, `task.md` templates
  - Replaces inconsistent "Proceed? (yes/no)" text prompts
  - All confirmations now use consistent options: "Yes (Recommended)", "No, cancel"

## [0.54.2] - 2026-01-30

### Bug Fixes

- LLM must handle the prompts, not the CLI - PRJ-149 (#84)


## [0.55.3] - 2026-01-30

### Fixed

- **LLM must handle the prompts, not the CLI** (PRJ-149)
  - Added `--json` flag to `prjct sync` for non-interactive mode
  - CLI now detects non-TTY mode and outputs structured JSON instead of interactive prompts
  - Updated `sync.md` template so LLM uses AskUserQuestion for confirmation
  - Enables proper flow: `prjct sync --json` → show diff → AskUserQuestion → `prjct sync --yes`


## [0.54.1] - 2026-01-30

### Bug Fixes

- Claude over-plans simple commands like p. sync - PRJ-148 (#83)


## [0.55.2] - 2026-01-30

### Fixed

- **Claude over-plans simple commands** (PRJ-148)
  - Added "⚡ FAST vs 🧠 SMART COMMANDS" section to CLAUDE.md
  - FAST commands (sync, next, dash, pause, resume) now execute immediately without exploration/planning
  - SMART commands (task, ship, bug, done) continue to use intelligent behavior
  - Clarified that "Key Intelligence Rules" only apply to SMART commands


## [0.55.1] - 2026-01-30

### Added

- **showMetrics config option** (PRJ-70)
  - Add `showMetrics` boolean to `LocalConfig` (prjct.config.json)
  - Defaults to `true` for new projects and existing projects without setting
  - Added `getShowMetrics()` and `setShowMetrics()` to ConfigManager


## [0.55.0] - 2026-01-30

### Features

- Selective memory retrieval based on task relevance - PRJ-107


## [0.55.0] - 2026-01-30

### Added

- **Selective memory retrieval based on task relevance** (PRJ-107)
  - Added `getRelevantMemoriesWithMetrics()` for domain-based filtering
  - Relevance scoring considers: domain match (25pts), tag match (20pts), recency (15pts), confidence (20pts), keywords (15pts), user triggered (5pts)
  - Returns retrieval metrics: total, considered, returned, filtering ratio, avg score
  - New types: `RelevantMemoryQuery`, `ScoredMemory`, `MemoryRetrievalResult`, `TaskDomain`
  - Integrates with PRJ-104 confidence scoring


## [0.54.0] - 2026-01-30

### Features

- Session stats in p. stats command - PRJ-89


## [0.54.0] - 2026-01-30

### Added

- **Session stats in `p. stats` command** (PRJ-89)
  - Shows today's activity: duration, tasks completed, features shipped
  - Displays agents used during the session with frequency
  - Shows learned patterns: decisions, preferences, workflows
  - Enhanced JSON and export modes include session data
  - Added `getRecentEvents()` to memoryService


## [0.53.0] - 2026-01-30

### Features

- Lazy template loading with TTL cache - PRJ-76 (#79)


## [0.53.0] - 2026-01-30

### Features

- Lazy template loading with TTL cache - PRJ-76


## [0.53.0] - 2026-01-30

### Added

- **Lazy template loading with TTL cache** (PRJ-76)
  - Templates now loaded on-demand with 60-second TTL cache
  - Added `getTemplate()` method with per-file caching
  - `loadChecklists()` and `loadChecklistRouting()` now use TTL cache
  - Added `clearTemplateCache()` method for testing/forced refresh
  - Reduces disk I/O for frequently accessed templates


## [0.52.0] - 2026-01-30

### Features

- Add confidence scores to all stored preferences - PRJ-104 (#78)


## [0.52.0] - 2026-01-30

### Added

- **Confidence scores for stored preferences** (PRJ-104)
  - All preferences, decisions, and workflows now track confidence level
  - Confidence: `low` (1-2 obs), `medium` (3-5 obs), `high` (6+ or confirmed)
  - Added `confirmPreference()`, `confirmDecision()`, `confirmWorkflow()` methods
  - User confirmation immediately sets confidence to `high`
  - Added `calculateConfidence()` utility function


## [0.51.0] - 2026-01-30

### Features

- Context diff preview before sync applies - PRJ-125 (#77)


## [0.51.0] - 2026-01-30

### Added

- **Context Diff Preview** (PRJ-125)
  - See what changes sync will make before they're applied
  - Interactive confirmation: apply, cancel, or show full diff
  - Preserved sections clearly marked in preview
  - Token count delta displayed
  - `--preview` flag for dry-run only
  - `--yes` flag to skip confirmation


## [0.50.0] - 2026-01-30

### Features

- Unified output system with new methods - PRJ-130 (#76)


## [0.50.0] - 2026-01-30

### Added

- **Unified output system with new methods** (PRJ-130)
  - Added `ICONS` constant for centralized icon definitions
  - New methods: `info()`, `debug()`, `success()`, `list()`, `table()`, `box()`
  - `debug()` only shows output when `DEBUG=1`
  - Refactored existing methods to use `ICONS` for consistency


## [0.49.0] - 2026-01-30

### Features

- Error messages with context and recovery hints - PRJ-131 (#75)


## [0.49.1] - 2026-01-30

### Improved

- **Error messages with context and recovery hints** (PRJ-131)
  - Created error catalog with 15+ error types
  - Added `out.failWithHint()` for rich error output
  - Errors now show file path and recovery hints
  - Example: `✗ Project ID not found` → `💡 Run 'prjct init'`


## [0.49.0] - 2026-01-30

### Added

- **Read-before-write enforcement for templates** (PRJ-108)
  - Agent files now preserve user customizations during regeneration
  - All context files (now.md, next.md, ideas.md, shipped.md) preserve user sections
  - Added validation and warnings for invalid preserve blocks
  - Documented preserve markers in global CLAUDE.md template

### Fixed

- **Codebase cleanup** - Resolved all 22 biome lint warnings
  - Fixed forEach returning values (converted to for...of)
  - Fixed unused type exports (exported or removed)
  - Fixed implicit any types
  - Fixed template literal usage
  - Fixed void return type issues


## [0.48.1] - 2026-01-30

### Improved

- **Complete and improve help text documentation** (PRJ-133)
  - New structured help system with `prjct help <command>` support
  - Per-command help with usage, parameters, and features
  - Commands grouped by category with `prjct help commands`
  - Clean visual formatting with Quick Start, Terminal Commands, AI Agent Commands sections


## [0.48.0] - 2026-01-29

### Added

- **Workflow hooks via natural language** (PRJ-137)
  - Configure hooks with `p. workflow "before ship run the tests"`
  - Supports before/after hooks for task, done, ship, sync commands
  - Three scopes: permanent (persisted), session, one-time
  - Uses existing memory system for storage
  - No JSON config needed - just talk to the LLM


## [0.47.0] - 2026-01-29

### Added

- **Subtask progress dashboard with domain-specific colors** (PRJ-138)
  - Visual progress table showing subtask status
  - Domain-specific colors: frontend (cyan), backend (green), database (yellow), testing (magenta), devops (blue)
  - Shows current subtask indicator and completion status
  - Displays estimated vs actual time tracking


## [0.46.0] - 2026-01-29

### Added

- **Preserve user customizations during sync** (PRJ-115)
  - Users can mark sections with `<!-- prjct:preserve -->` markers
  - Preserved content survives regeneration
  - Works in CLAUDE.md and other context files


## [0.45.5] - 2026-01-28

### Fixed

- **Silent memory application** (PRJ-103)
  - Memory decisions applied without verbose output
  - Cleaner sync experience


## [0.45.0] - 2026-01-28

### Added

- Initial public release
- Core workflow: sync, task, done, ship
- Domain agents: frontend, backend, database, testing, devops
- Linear integration via MCP
- Context layer for Claude Code and Gemini CLI
