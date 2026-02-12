# Changelog

## [1.32.0] - 2026-02-12

### Features

- session continuity and project-switch context preservation (PRJ-285) (#177)


## [1.31.0] - 2026-02-12

### Features

- exquisite terminal UX — rich markdown formatters + branded output (#179)


## [1.30.2] - 2026-02-12

### Added
- exquisite-terminal-ux

## [1.30.1] - 2026-02-12

### Bug Fixes

- guard analysis array accesses against undefined (n.push crash) (#178)

## [1.30.1] - 2026-02-11

### Added
- current work

## [1.30.0] - 2026-02-12

### Features

- enrich AI formatters with analysis data + add Codex support (#176)


## [1.29.0] - 2026-02-12

### Features

- JSON conflict handling + fix prjct start overwrite (#175)
- Enrich AI formatters with analysis data + add Codex support (PRJ-277)

## [1.28.2] - 2026-02-11

### Added
- json conflict handling in templates

## [1.28.1] - 2026-02-11

### Added
- test feature

## [1.28.0] - 2026-02-11

### Features

- agentic Linear template without MCP dependency


## [1.27.1] - 2026-02-11

### Bug Fixes

- exclude router files (p.md/p.toml) from subcommand installation


## [1.27.0] - 2026-02-11

### Features

- dual-runtime SQLite — bun:sqlite + better-sqlite3 (#174)


## [1.27.6] - 2026-02-11

### Added
- Dual-runtime SQLite — bun:sqlite + better-sqlite3 for Node.js compatibility

## [1.27.1] - 2026-02-11

### Removed
- Dead context generators (`ContextFileGenerator`, legacy `generateContext()`) — no readers existed
- StorageManager MD write-through (`toMarkdown()`, `getLayer()`, `getMdFilename()`) from base class and 8 subclasses
- ~1,750 lines of orphaned code; writes are faster (no MD file I/O on state changes)

## [1.26.0] - 2026-02-11

### Features

- kill JSON I/O + skill-on-demand --md architecture (PRJ-303) (#173)

## [1.27.0] - 2026-02-11

### Features

- **`--md` flag on all CLI commands**: New LLM-optimized markdown output mode for all commands (`prjct task --md`, `prjct done --md`, `prjct sync --md`, etc.). Produces clean markdown with task context, relevant files, subtasks, and next steps — designed for agent consumption.
- **Ultra-thin templates**: All 36 command templates reduced from 6,066 → ~600 total lines (~90% reduction). Fast commands are ~10 lines, smart commands ~30 lines. Templates delegate data/formatting to CLI `--md` output, preserving agentic intelligence (exploration, planning, clarification).
- **Ultra-thin global instructions**: CLAUDE.md reduced from 488 → 16 lines (~97% reduction). GEMINI.md, WINDSURF.md, ANTIGRAVITY.md, CURSOR.mdc similarly reduced. Zero wasted context tokens.
- **New `md-formatter.ts` utility**: Shared markdown formatting functions (`mdTaskHeader`, `mdSubtasks`, `mdRelevantFiles`, `mdInstructions`, `mdNextSteps`, etc.) used by all command groups.
- **Fix: `task` command registration**: `prjct task` was listed in command-data but had no handler in registry or CLI routing. Now properly registered and routed through both normal CLI and daemon paths.

### Changes

- 36 command templates rewritten (auth, bug, cleanup, dash, design, done, enrich, git, history, idea, impact, init, jira, learnings, linear, merge, next, pause, plan, prd, resume, review, serve, setup, ship, skill, spec, status, sync, task, test, update, verify, workflow, analyze)
- 5 global templates rewritten (CLAUDE.md, GEMINI.md, WINDSURF.md, ANTIGRAVITY.md, CURSOR.mdc)
- 6 CLAUDE.md modules deprecated (CLAUDE-commands, CLAUDE-git, CLAUDE-storage, CLAUDE-intelligence simplified to stubs; CLAUDE-core reduced to 14 lines; module-config.json single profile)
- `dist/templates.json` reduced from 358 KB → 177.6 KB (~50% reduction)
- All command groups (workflow, planning, shipping, analytics, analysis) accept `{ md?: boolean }` option
- Daemon `executeCommand` now has explicit cases for all workflow commands with `--md` passthrough
- `core/index.ts` standardCommands map passes `md` flag to all handlers

### Metrics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| CLAUDE.md (always loaded) | 488 lines | 16 lines | 97% |
| Templates total lines | 6,066 | ~600 | 90% |
| `dist/templates.json` | 358 KB | 177.6 KB | 50% |
| Context tokens per session | ~6,500 | ~350 | 95% |

## [1.26.1] - 2026-02-10

### Added
- purge JSON I/O from templates + prjct update command

## [1.26.0] - 2026-02-10

### Features

- **`prjct update` command**: New CLI command that migrates all projects from JSON to SQLite and sweeps leftover JSON files. Supports `--all` (all projects) and `--dry-run` flags.
- **Template purge — zero JSON I/O**: Rewrote all 49 template files (commands, subagents, global instructions) to use `prjct` CLI commands instead of direct JSON file reads/writes. Templates now delegate all data operations to the CLI, which handles SQLite internally.
- **Fix performance-tracker date filter**: `getReport(id, 0)` now correctly means "today" instead of "this exact millisecond".

### Changes

- 27 command templates simplified to use CLI commands (`prjct task`, `prjct done`, `prjct ship`, etc.)
- 8 global instruction files updated (CLAUDE-core/intelligence/storage, ANTIGRAVITY, GEMINI, CURSOR, WINDSURF, STORAGE-SPEC)
- 7 subagent/context templates updated (agent-base, orchestrator, planner, shipper, workflow, dashboard, roadmap)
- New `core/commands/update.ts` with `UpdateCommands` class
- Registered in command-data, register, index, and commands facade

## [1.25.0] - 2026-02-11

### Features

- kill all JSON file I/O — everything to SQLite (PRJ-303) (#172)

## [1.25.0] - 2026-02-10

### Features

- **Kill all JSON file I/O — everything to SQLite (PRJ-303)**: Migrated 4 modules that were still reading/writing JSON files directly, bypassing the SQLite migration. All storage now goes through `prjctDb` or `StorageManager`.

### Changes

- `core/integrations/linear/sync.ts` — Replaced `readFile`/`writeFile` on `issues.json` with `prjctDb.getDoc/setDoc`
- `core/services/context-generator.ts` — Replaced direct `state.json`, `queue.json`, `ideas.json`, `shipped.json` reads with `stateStorage`, `queueStorage`, `ideasStorage`, `shippedStorage`
- `core/services/sync-service.ts` — `updateProjectJson` and `updateStateJson` now use `prjctDb`/`stateStorage` instead of `fs.readFile`/`fs.writeFile`
- `core/services/hooks-service.ts` — `getHookConfig`/`saveHookConfig` now use `prjctDb.getDoc/setDoc` for `project.json` data
- `core/storage/migrate-json.ts` — Added `sweepLegacyJson()` that runs on every sync to import and delete any ghost JSON files
- Templates updated to reference `prjct.db` instead of `storage/*.json`

### Test Plan

#### For QA
1. Run `bun test` — 1057 tests pass
2. Run `prjct linear sync` — issues stored in `prjct.db`, no `issues.json` on disk
3. Run `prjct sync --yes` — regenerates context without JSON file errors
4. Verify `ls ~/.prjct-cli/projects/*/storage/` has no `.json` files
5. Run `prjct status` — works without JSON files

#### For Users
**What changed:** Internal storage optimization — no user action needed.
**Breaking changes:** None

## [1.24.1] - 2026-02-11

### Bug Fixes

- strip shebangs in build via esbuild plugin (#171)


## [1.24.2] - 2026-02-10

### Bug Fixes

- **Strip shebangs in build via esbuild plugin**: Added a `stripShebangPlugin` to the build script that removes shebangs from source files before bundling. This prevents double-shebang SyntaxErrors when source files (e.g. `#!/usr/bin/env bun`) are compiled with a banner that also injects a shebang. The previous fix (v1.24.1) removed shebangs manually from known files; this fix handles it generically for all future source files.

### Test Plan

#### For QA
1. Add `#!/usr/bin/env bun` to any source `.ts` file used as an entry point
2. Run `node scripts/build.js`
3. Verify compiled output has exactly one shebang (`#!/usr/bin/env node`) — not two
4. Run `node dist/cli/linear.mjs --help` — should work without SyntaxError

#### For Users
**What changed:** Build-time fix — no user action needed.
**Breaking changes:** None

## [1.24.0] - 2026-02-11

### Features

- implement daemon mode with IPC socket for near-zero startup (PRJ-302) (#170)

### Bug Fixes

- remove source shebang causing SyntaxError in compiled linear CLI (#169)

## [1.24.1] - 2026-02-10

### Bug Fixes

- **Remove source shebangs from compiled entry points**: `core/daemon/entry.ts` and `core/cli/lint-meta-commentary.ts` had shebangs (`#!/usr/bin/env node`, `#!/usr/bin/env bun`) that caused dual shebangs in compiled `.mjs` output. Node.js only strips the first-line shebang, so the second became a SyntaxError. The build script's `banner` option is the single source of truth for shebang injection.

## [1.24.0] - 2026-02-10

### Features

- **Daemon mode with IPC socket**: Background daemon process keeps CLI modules warm in memory. Commands are routed through a Unix domain socket using NDJSON protocol, achieving 1.6ms IPC roundtrip. Production startup drops from ~1060ms to ~220ms (4.8x speedup).
- **Thin shim entry point**: Production build now uses a 1.6KB shim (`prjct.mjs`) that tries the daemon first, only loading the full 613KB core bundle (`prjct-core.mjs`) when the daemon is unavailable.
- **Auto-start daemon**: First CLI invocation automatically spawns the daemon in background for future commands. 30-minute idle auto-shutdown.
- **Daemon lifecycle commands**: `prjct daemon start|stop|status` for manual control. Supports `--foreground`, `--port=N`, `--no-http` flags.

### Security

- **Removed source maps from production build**: `.map` files previously embedded full `sourcesContent` including credential management code (`keychain.ts`, `project-credentials.ts`). Source maps are now completely removed from `dist/`.

### Implementation Details

Daemon mode with Unix socket IPC for near-zero CLI startup. The daemon pre-loads `PrjctCommands`, `CommandRegistry`, and storage caches once, then reuses them across invocations. The thin shim entry point avoids parsing the heavy core bundle when the daemon handles the command. ESM static imports are hoisted before any code runs, so all imports in `bin/prjct.ts` are now dynamic to enable the fast path.

### Learnings

- ESM hoists static imports — placing code before `import` statements doesn't help; all imports must be dynamic for a true fast path
- esbuild code splitting creates ~60 chunk files, not suitable for CLI distribution; explicit two-file shim is cleaner
- `process.stdin.unref()` doesn't exist in Bun — needs try/catch guard
- Unix domain sockets with NDJSON are ideal for local IPC: secure (file permissions), fast, debuggable

### Test Plan

#### For QA
1. `prjct daemon start` — verify socket at `~/.prjct-cli/run/daemon.sock`
2. `prjct daemon status` — shows PID, uptime, commands served
3. `prjct sync --json --yes` — works via IPC with valid JSON output
4. `prjct daemon stop` — clean shutdown, socket removed
5. Run any command without daemon — falls back to direct execution
6. Verify `dist/` contains NO `.map` files or `sourcesContent`

#### For Users
**What changed:** CLI commands are now routed through a background daemon for faster execution.
**How to use:** Automatic — daemon starts on first use, stops after 30min idle. Use `PRJCT_NO_DAEMON=1` to disable.
**Breaking changes:** None.

## [1.23.1] - 2026-02-10

### Bug Fix

- **Fix dual shebang in compiled linear CLI**: Removed `#!/usr/bin/env bun` from `core/cli/linear.ts` source file. The build script (esbuild) already injects `#!/usr/bin/env node` via banner, so the source shebang was duplicated in `dist/cli/linear.mjs` — causing `SyntaxError: Invalid or unexpected token` on Node.js for all `prjct linear` commands.

### Root Cause

The source file `core/cli/linear.ts` had `#!/usr/bin/env bun` on line 1. esbuild preserved it during compilation, and the build banner injected `#!/usr/bin/env node` — resulting in two shebangs. Node.js only strips line 1's shebang, so line 2 (`#!/usr/bin/env bun`) was parsed as JavaScript and threw a SyntaxError.

### Learnings

- Source files compiled by esbuild should NOT have shebangs — the build script's `banner` option is the single source of truth for shebang injection
- Only the first line shebang is stripped by Node.js; any subsequent shebang lines cause parse errors

### Test Plan

#### For QA
1. `head -1 dist/cli/linear.mjs` — single `#!/usr/bin/env node` shebang
2. `node dist/cli/linear.mjs --help` — no SyntaxError
3. `prjct linear list` — works end-to-end
4. `grep -c '#!/' dist/cli/linear.mjs` — returns `1`

#### For Users
**What changed:** Fixed `prjct linear` commands failing with SyntaxError after v1.23.0.
**How to use:** Update to v1.23.1 — no action needed.
**Breaking changes:** None.

## [1.23.0] - 2026-02-11

### Features

- compile and ship dist/ instead of raw TypeScript source (PRJ-294) (#168)
- add outcome-to-memory auto-learning (PRJ-283) (#166)

### Refactoring

- consolidate core modules from 27 to 20 directories (PRJ-292) (#167)

## [1.25.0] - 2026-02-10

### Infrastructure

- **Compile and ship dist/** (PRJ-294): Package no longer ships raw TypeScript source. Compiled, minified JavaScript with source maps instead.
  - Rewrote `scripts/build.js` v3.0: produces minified ESM bundles via esbuild with source maps
  - Bundled 127 template files into single `dist/templates.json` (408KB)
  - Main CLI compiled to `dist/bin/prjct.mjs` (600KB minified), Linear CLI to `dist/cli/linear.mjs` (27KB)
  - Package reduced from 1.1MB/480 files to 971KB/27 files
  - All template consumers use bundle-first pattern via `getTemplateContent()` and `listTemplates()` helpers
  - Dual-mode operation: dev mode (raw TS via bun) and production mode (compiled dist/) both work
  - Updated `bin/prjct` shell script for dev vs production detection
  - Updated 8 modules to use template bundle: command-installer, setup, setup-cursor, setup-windsurf, prompt-builder, sync-agent-gen, template-loader, bin/prjct.ts

### Implementation Details

Rewrote the build system to produce compiled JavaScript output instead of shipping raw TypeScript. The key innovation is the bundle-first pattern: `getTemplateContent()` tries the bundled JSON first, falls back to filesystem for dev mode. This unified API replaced scattered `fs.readFile` calls across 8 modules. The shell script (`bin/prjct`) detects dev vs production by checking if `prjct.ts` exists.

### Learnings

- Bundle-first pattern (try JSON bundle, fall back to filesystem) provides clean dev/prod abstraction
- ESM requires banner injection for `__dirname`/`__filename` since they don't exist in ESM scope
- npm auto-includes `main` field target in package even when not in `files` array
- `packages: 'external'` in esbuild avoids bundling node_modules into dist/
- `keepNames: true` preserves function names despite minification, helpful for debugging

### Test Plan

#### For QA
1. `npm pack` — verify tarball contains only dist/, bin/prjct, assets/, scripts, README, LICENSE, CHANGELOG
2. `bun dist/bin/prjct.mjs version` — CLI runs from compiled output
3. `bun dist/bin/prjct.mjs sync --json` — full sync works with bundled templates
4. `prjct linear list` — linear CLI subprocess resolves correctly
5. Verify `dist/templates.json` contains all 127 template files
6. Dev mode: `bun bin/prjct.ts version` still runs raw TypeScript

#### For Users
**What changed:** Package is now smaller and ships compiled JavaScript instead of raw TypeScript source.
**How to use:** No changes — all `prjct` commands work identically.
**Breaking changes:** None

## [1.24.0] - 2026-02-10

### Refactor

- **Consolidate core modules** (PRJ-292): Reduced `core/` from 27 to 20 directories by merging overlapping modules, splitting large files, and eliminating legacy duplicates
  - Merged `bus/` + `events/` into `events/` (pub-sub.ts, sync-events.ts)
  - Merged `ai-tools/` + `context-tools/` into `tools/` (ai/, context/ subdirs)
  - Merged `plugin/` + `agents/` into `agentic/` (hooks, plugin-loader, plugin-registry, performance)
  - Merged `wizard/` + `outcomes/` into `workflows/` (onboarding, outcome-analyzer/recorder/learner/storage)
  - Absorbed `context/` into `agentic/` and `constants/` into `utils/`
  - Split 4 large files (5400+ lines total):
    - `memory-system.ts` (1547 → 279) into memory-stores.ts, pattern-store.ts, semantic-memories.ts
    - `sync-service.ts` (1562 → 837) into sync-analyzer.ts, sync-agent-gen.ts
    - `setup.ts` (1061 → 775) into setup-cursor.ts, setup-windsurf.ts
    - `analysis.ts` (1274 → 850) into analysis-helpers.ts
  - Eliminated legacy `fs-helpers.ts` (16 importers migrated to `file-helper.ts`)
  - Removed all type re-exports, duplicated code, and backward-compat shims
  - 84 files changed, +2638/-3182, tsc clean, 1057 tests pass

### Implementation Details

Large-scale module consolidation to reduce cognitive load and improve maintainability. Each merge followed the pattern: move files, update relative imports across all importers, clean barrel index.ts files, verify with tsc + tests. Used parallel background agents for independent file splits.

Key patterns: CachedStore<T> abstract base class for disk-backed stores, standalone helper function extraction for large command classes, editor-specific code isolation (Cursor/Windsurf).

### Learnings

- Parallel agents work well for independent file splits (3 simultaneous splits completed successfully)
- Pre-existing circular deps in commands<->services chain (3 cycles) — not introduced by this refactor
- Known flaky test (intermittent timing issue) — passes on re-run

### Test Plan

#### For QA
1. `npx tsc -p core/tsconfig.json --noEmit` — zero errors
2. `bun test` — 1057 tests pass
3. `prjct sync` in any project — works identically
4. Deleted dirs don't exist: bus/, ai-tools/, context-tools/, plugin/, agents/, wizard/, outcomes/, context/, constants/
5. New dirs exist: tools/ai/, tools/context/, workflows/, events/

#### For Users
**What changed:** Internal module reorganization only
**Breaking changes:** None for CLI users. Internal import paths changed (affects contributors).

## [1.23.0] - 2026-02-10

### Features

- **Outcome-to-memory auto-learning** (PRJ-283): Completed tasks automatically extract patterns and inject high-confidence learnings into semantic memory
  - `OutcomeStorage`: Unified storage for feature/task outcomes extending StorageManager, with migration from shipped.json, aggregation, and markdown generation
  - `OutcomeMemoryLearner`: Extracts file co-change, tech stack, architecture, gotcha, and workflow patterns from task history and feature outcomes
  - Confidence-gated injection: Only patterns with 3+ occurrences are auto-injected into memory
  - Deduplication: Updates existing `[auto-learned]` memories instead of creating duplicates
  - Non-blocking sync integration: Auto-learning runs during `p. sync` as step 9c (errors caught, don't block sync)
  - `p. learnings` command template for viewing auto-learned patterns by confidence level
  - 37 new tests (26 learner + 11 storage), 1057 total

### Implementation Details

Bridges the outcomes system to semantic memory. Previously, patterns from completed tasks were only available in task history JSON. Now, recurring patterns are automatically extracted and injected into the memory system for cross-session knowledge transfer.

**Data flow:** `taskHistory[]` + `FeatureOutcome[]` → pattern extraction → confidence scoring → `SemanticMemories` injection

**Pattern categories:** file_cochange (files modified together), tech_stack (confirmed technologies), architecture (discovered patterns), estimation (variance tracking), workflow (what works/doesn't), gotcha (recurring issues)

**New modules:**
- `core/outcomes/outcome-storage.ts` — OutcomeStorage extending StorageManager with CRUD, migration, aggregation, markdown
- `core/outcomes/outcome-learner.ts` — OutcomeMemoryLearner with pattern extraction and memory injection
- `core/outcomes/index.ts` — Updated exports
- `core/services/sync-service.ts` — Added autoLearnFromHistory() in sync flow
- `templates/commands/learnings.md` — Template for `p. learnings` command
- `core/__tests__/outcomes/outcome-learner.test.ts` — 26 tests
- `core/__tests__/outcomes/outcome-storage.test.ts` — 11 tests

### Learnings

- `StorageManager<T>` base class provides consistent pattern for all JSON storage with SQLite backing, cache, MD generation, and event publishing
- Non-critical sync steps should always wrap in try/catch to prevent blocking the main sync flow
- biome pre-commit hook checks ALL files, not just staged — run `biome check --write` on all new files before committing

### Test Plan

#### For QA
1. Run `p. sync` on a project with task history — verify auto-learning runs without errors
2. Check memories.json for `[auto-learned]` entries after sync with 3+ recurring patterns
3. Run `p. learnings` — verify patterns display grouped by confidence level
4. Complete 3+ tasks with the same stackConfirmed values — verify auto-injection
5. Verify sync works when no task history exists

#### For Users
**What changed:** Completed tasks now automatically extract patterns and inject high-confidence learnings into the memory system.
**How to use:** Patterns accumulate automatically. Run `p. learnings` to see what the system has learned.
**Breaking changes:** None

## [1.22.0] - 2026-02-10

### Features

- add task-to-analysis feedback loop (PRJ-272) (#165)
- add task history array with FIFO eviction (PRJ-281) (#164)


## [1.22.0] - 2026-02-10

### Features

- **Task-to-analysis feedback loop** (PRJ-272): Tasks report discoveries back into analysis and agent generation
  - TaskFeedbackSchema: stackConfirmed, patternsDiscovered, agentAccuracy (with rating enum), issuesEncountered
  - Optional `feedback` field on TaskHistoryEntry for backward compatibility
  - `getAggregatedFeedback()` consolidates patterns, stack confirmations, and issues across task history
  - Recurring issues (2+ occurrences) automatically promoted to "known gotchas"
  - Sync incorporates feedback: patterns populate analysis draft, gotchas become anti-patterns
  - Agent generator injects "Recent Learnings" section into domain agents with patterns, gotchas, and accuracy notes
  - Workflow `done()` accepts and passes feedback through to storage
  - 22 new tests covering schema validation, persistence, aggregation, gotcha promotion, and backward compatibility (1020 total)

### Implementation Details

Closes the knowledge loop between task execution and project analysis. Previously, discoveries made during tasks were lost when sessions ended. Now, structured feedback persists in task history and feeds into the next sync cycle.

**Data flow:** `p. done` (feedback captured) → `taskHistory[].feedback` → `p. sync` → `analysis.patterns` + `agents/*.md` "Recent Learnings"

**Modified modules:**
- `core/schemas/state.ts` — Added TaskFeedbackSchema, extended TaskHistoryEntrySchema with optional feedback field
- `core/storage/state-storage.ts` — completeTask() accepts feedback, createTaskHistoryEntry() attaches it, getAggregatedFeedback() provides read-side API, toMarkdown() shows feedback in context
- `core/commands/workflow.ts` — done() passes feedback through options to completeTask()
- `core/services/sync-service.ts` — saveDraftAnalysis() loads aggregated feedback, injectFeedbackSection() adds learnings to agents
- `core/services/agent-generator.ts` — generate() accepts TaskFeedbackContext, injectFeedbackSection() appends learnings to domain agents
- `core/__tests__/storage/state-storage-feedback.test.ts` — 22 comprehensive tests

### Learnings

- **SyncService duplicates AgentGenerator:** Both have their own `generateDomainAgent()` — feedback injection needed in both places
- **Write-Through pattern:** All state flows JSON → MD → Event; feedback follows the same pattern
- **Backward compatibility via optional fields:** Adding `feedback?: TaskFeedback` to existing schema requires zero migration

### Test Plan

#### For QA
1. Complete a task with `p. done` — verify feedback stored in `taskHistory[0].feedback`
2. Complete multiple tasks with same issue — verify gotcha promotion (2+ occurrences)
3. Run `p. sync` after tasks with feedback — verify analysis draft has patterns
4. Run `p. sync` with agent regeneration — verify "Recent Learnings" in domain agents
5. Complete task WITHOUT feedback — verify backward compatibility
6. Run `bun test` — all 1020 tests pass

#### For Users
**What changed:** Task discoveries now persist and improve future agent context automatically.
**How to use:** Automatic via `p. done` template. No user action required.
**Breaking changes:** None.

## [1.21.0] - 2026-02-10

### Features

- add semantic verification for analysis results (PRJ-270) (#163)
- **Task history array** (PRJ-281): Replace single previousTask with bounded task history for pattern learning
  - TaskHistoryEntry schema captures completed task metadata: title, classification, timestamps, subtasks, outcome, branch, Linear IDs
  - Automatic history push on task completion with FIFO eviction (max 20 entries)
  - Context injection: shows 3 recent same-type tasks when active, 5 recent when idle
  - Accessor methods: getTaskHistory(), getMostRecentTask(), getTaskHistoryByType()
  - Backward compatible: undefined taskHistory initializes as empty array
  - Comprehensive test suite with 20 test cases (998 tests total pass)

### Implementation Details

Replaced single previousTask field with bounded task history array to enable pattern learning and cross-task context for AI agents. When tasks complete, metadata is automatically captured and stored with FIFO eviction.

**Modified modules:**
- `core/schemas/state.ts` — Added TaskHistoryEntrySchema with 12 fields, updated StateJsonSchema, exported TaskHistoryEntry type, updated DEFAULT_STATE
- `core/storage/state-storage.ts` — Updated completeTask() to push history entries, added createTaskHistoryEntry() helper, added 3 accessor methods, updated toMarkdown() for context injection, updated getDefault()
- `core/__tests__/storage/state-storage-history.test.ts` (468 lines) — 20 comprehensive tests covering push, eviction, backward compatibility, accessors, and context injection
- `README.md` — Added Task History section with usage documentation
- `CHANGELOG.md` — Documented task history feature

### Learnings

- **Schema-first design:** Define Zod schemas before implementation ensures type safety and validation at runtime
- **Type assertions for extended properties:** Use `taskAny = task as any` to access properties not in CurrentTask schema (type, branch, parentDescription)
- **Context injection in toMarkdown():** The state-storage toMarkdown() method is where context is generated, not context-builder.ts
- **pathManager mocking for test isolation:** Mock getGlobalProjectPath, getStoragePath, getFilePath to use temp directories in tests
- **FIFO over LRU:** Simpler implementation with predictable behavior for bounded history

### Test Plan

#### For QA
1. Complete a task with `p. done` — verify taskHistory entry appears in state.json with all metadata fields
2. Complete 25+ tasks — verify only 20 entries remain (oldest dropped)
3. Start a bug task — verify context markdown shows recent bug tasks only (not features)
4. Test with existing state.json missing taskHistory field — verify backward compatibility
5. Verify accessor methods return correct data: getTaskHistory(), getMostRecentTask(), getTaskHistoryByType()

#### For Users
**What changed:** Completed tasks are now tracked in a history array (max 20) instead of only storing the last paused task
**How to use:** No action needed — task history is automatic on `p. done`
**Breaking changes:** None — fully backward compatible


## [1.20.0] - 2026-02-10

### Features

- add retry with exponential backoff for agent and tool operations (#162)


## [1.20.0] - 2026-02-09

### Features

- **Semantic verification for analysis results** (PRJ-270): Validate analysis consistency before sealing
  - Framework verification: checks frameworks exist in package.json dependencies (case-insensitive matching)
  - Language verification: validates languages match actual file extensions (.ts → TypeScript)
  - Pattern location verification: confirms pattern files exist in project
  - File count verification: validates count accuracy (within 10% tolerance)
  - Anti-pattern file verification: ensures anti-pattern files exist when referenced
  - CLI command: `prjct verify --semantic` with human-readable and JSON output
  - Parallel execution of all 5 checks using Promise.all() (~100-200ms for typical projects)
  - Comprehensive test suite with 10 new test cases covering all scenarios (28 tests total, 63 assertions)

- **Retry with exponential backoff for agent and tool operations** (PRJ-271): Comprehensive retry infrastructure with error classification and circuit breaker
  - RetryPolicy utility with configurable attempts, delays, and exponential backoff (1s→2s→4s)
  - Automatic error classification: transient (EBUSY, EAGAIN, ETIMEDOUT) vs permanent (ENOENT, EPERM)
  - Circuit breaker protection: opens after 5 consecutive failures, auto-closes after 60s
  - Agent initialization retries (3 attempts with 1s base delay)
  - Tool operations retry (Read/Write/Bash with 2 attempts)
  - Resilient parallel agent generation using Promise.allSettled()

### Implementation Details

#### Semantic Verification (PRJ-270)

Added semantic verification functions to validate analysis results match actual project state. The verification system runs 5 parallel checks to detect logical inconsistencies before sealing analysis data.

**Modified modules:**
- `core/schemas/analysis.ts` — Added 5 verification functions, 1 orchestrator, 2 helpers, and 2 interfaces (SemanticCheckResult, SemanticVerificationReport)
- `core/storage/analysis-storage.ts` — Added semanticVerify() method to AnalysisStorage class
- `core/commands/analysis.ts` — Extended verify() with --semantic flag and added semanticVerify() helper
- `core/commands/commands.ts` — Updated verify() signature to include semantic?: boolean
- `core/index.ts` — Updated verify command handler to pass semantic flag
- `core/__tests__/storage/analysis-storage.test.ts` — Added 10 comprehensive test cases (+345 lines)
- `README.md` — Added analysis verification documentation section
- `CHANGELOG.md` — Documented semantic verification feature

**Verification functions:**
1. `verifyFrameworks()` — Checks frameworks exist in package.json (case-insensitive partial matching)
2. `verifyLanguages()` — Validates languages match file extensions (.ts → TypeScript)
3. `verifyPatternLocations()` — Confirms pattern files exist in project
4. `verifyFileCount()` — Validates count accuracy (10% tolerance for temporary files/caches)
5. `verifyAntiPatternFiles()` — Ensures anti-pattern files exist when referenced

**Helper functions:**
- `getProjectExtensions()` — Recursively scans project for file extensions (ignores node_modules, .git, dist, build, .next, .turbo, coverage)
- `countProjectFiles()` — Counts all files in project with same ignore patterns

**Key features:**
- Parallel execution using Promise.all() for performance (~100-200ms typical)
- Skip conditions for null/undefined/empty arrays (prevents false failures)
- 10% tolerance for file count (accounts for temporary files, caches)
- Case-insensitive partial matching for frameworks
- Returns SemanticVerificationReport following VerificationReport pattern from sync-verifier
- Zero breaking changes: all 18 existing tests pass

#### Retry Infrastructure (PRJ-271)

Built RetryPolicy utility with exponential backoff, error classification, and circuit breaker. Integrated across agent initialization, tool operations, and parallel agent generation. The system now automatically retries transient failures while failing fast on permanent errors.

**New modules:**
- `core/utils/retry.ts` (320 lines) — Core retry infrastructure with RetryPolicy class, error classification, circuit breaker
- `core/__tests__/utils/retry.test.ts` (380 lines) — 21 comprehensive tests with 53 assertions
- `ACCEPTANCE-PRJ-271.md` — Full acceptance criteria verification (22 criteria verified)

**Modified modules:**
- `core/services/agent-service.ts` — Wrapped initialize() with retry policy (3 attempts)
- `core/agentic/tool-registry.ts` — Added retry to Read/Write/Bash tools (2 attempts each)
- `core/services/agent-generator.ts` — Changed to Promise.allSettled() with per-agent retry

**Key features:**
- Exponential backoff: 1s, 2s, 4s (configurable base/max)
- Error classification: automatic transient vs permanent detection
- Circuit breaker: per-operation tracking, 5 failure threshold, 60s cooldown
- Two default policies: defaultAgentRetryPolicy (3 attempts), defaultToolRetryPolicy (2 attempts)
- Zero breaking changes: all 968 existing tests pass

### Learnings

- **RetryPolicy pattern:** Wrapping operations with retry execution provides clean separation of retry logic from business logic
- **Error classification strategies:** Using error code sets (EBUSY, EAGAIN) for transient vs (ENOENT, EPERM) for permanent enables automatic decision-making
- **Promise.allSettled() for resilient parallel operations:** Prevents one failure from blocking other operations, enables partial success
- **Circuit breaker implementation:** Per-operation state tracking prevents cascading failures while allowing recovery

### Test Plan

#### For QA

1. **Agent Initialization Retry**
   - Temporarily make file system busy during agent initialization
   - Verify agent initialization retries up to 3 times
   - Confirm permanent errors (unsupported agent) fail immediately

2. **Tool Operations Retry**
   - Test Read/Write/Bash with transient errors (EBUSY, ETIMEDOUT)
   - Verify operations retry automatically (2 attempts)
   - Confirm permanent errors (ENOENT, EPERM) return null/false without retry

3. **Circuit Breaker**
   - Trigger 5 consecutive failures on same operation
   - Verify circuit breaker opens and blocks further attempts
   - Wait 60 seconds and verify circuit closes automatically

4. **Parallel Agent Generation**
   - Simulate one agent generation failure during sync
   - Verify other agents generate successfully (Promise.allSettled behavior)
   - Check logs for failure warnings

#### For Users

**What changed:** The system is now more resilient against transient failures. Operations like agent initialization, file reads/writes, and command execution will automatically retry when they encounter temporary errors (disk busy, timeouts, etc).

**How to use:** No action required - retry logic works automatically. Users will experience fewer random failures during normal operations.

**Breaking changes:** None. All changes are backward compatible. Existing tests (968 total) all pass.

## [1.19.0] - 2026-02-09

### Features

- **Aggressive archival of stale storage data** (PRJ-267): Automatic archival during `prjct sync` to keep LLM context lean
  - Shipped features >90 days archived to SQLite `archives` table with 1-line summary
  - Pending ideas >180 days marked `dormant` and excluded from LLM context
  - Completed queue tasks >7 days auto-removed and archived
  - Paused tasks >30 days archived with persistence (previously discarded)
  - Memory log capped at 500 active entries, overflow archived

### Implementation Details

New modules:
- `core/storage/archive-storage.ts` — Archive infrastructure: SQLite `archives` table, batch archival via transactions, restore, prune, stats
- `core/__tests__/storage/archive-storage.test.ts` — 13 tests covering all archival paths

Modified:
- `core/storage/database.ts` — Migration v2: `archives` table with entity_type, entity_id, entity_data, summary, reason columns
- `core/storage/shipped-storage.ts` — `archiveOldShipped()` method with 90-day retention policy
- `core/storage/ideas-storage.ts` — `markDormantIdeas()` method, `dormant` status excluded from markdown context
- `core/storage/queue-storage.ts` — `removeStaleCompleted()` method with 7-day retention
- `core/storage/state-storage.ts` — `archiveStalePausedTasks()` now persists to archive table before removal
- `core/services/memory-service.ts` — `capEntries()` method with 500-entry cap
- `core/services/sync-service.ts` — `archiveStaleData()` orchestrates all archival in parallel during sync
- `core/schemas/ideas.ts` + `core/types/storage.ts` — Added `dormant` to IdeaStatus enum

### Test Plan

#### For QA
1. Run `prjct sync` with >90d shipped features — verify archive and removal from context
2. Run sync with >180d pending ideas — verify dormant status, excluded from `ideas.md`
3. Run sync with >7d completed queue tasks — verify removal and archival
4. Run sync with >30d paused tasks — verify archival to SQLite
5. Create >500 memory entries, sync — verify cap at 500
6. `bun test` — all 947+ tests pass
7. Verify recent items are NOT archived

#### For Users
**What changed:** Storage data automatically cleaned up during sync. Old data archived, not deleted.
**How to use:** No action needed — runs automatically on every sync.
**Breaking changes:** Ideas can now have `dormant` status (new enum value).

## [1.18.0] - 2026-02-09

### Features

- implement incremental sync with file hashing (PRJ-305) (#160)


## [1.18.0] - 2026-02-09

### Features

- **Incremental sync**: `prjct sync` now only re-analyzes files that changed since last sync (PRJ-305)
  - File hashing with Bun.hash (xxHash64) — <100ms for 500 files
  - Change propagation through import graph (1-level reverse edges)
  - Conditional index rebuilds: BM25, import graph, co-change only when source files change
  - Conditional agent regeneration: only when config files (package.json, tsconfig.json) change
  - `prjct sync --full` flag to force complete re-analysis

### Implementation Details

New modules:
- `core/domain/file-hasher.ts` — Hash computation via Bun.hash, SQLite registry using `index_checksums` table, diff detection (added/modified/deleted/unchanged)
- `core/domain/change-propagator.ts` — Import graph reverse-edge lookup for 1-level change propagation, domain classification for affected files

Modified:
- `core/services/sync-service.ts` — Incremental decision logic: detect changes → propagate → conditionally rebuild indexes and agents
- `core/services/watch-service.ts` — Passes accumulated `changedFiles` to sync options
- `core/types/project-sync.ts` — Added `full`, `changedFiles` to `SyncOptions` + `IncrementalInfo` result type
- CLI chain (`core/index.ts` → `commands.ts` → `analysis.ts`) — Wired `--full` flag through

### Learnings

- Bun's `fs.readdir` with `withFileTypes` returns `Dirent<NonSharedBuffer>` — need `String()` cast for `.name`
- Existing `index_checksums` SQLite table was already set up (PRJ-303) — zero schema changes needed
- Import graph reverse edges (from PRJ-304) enable efficient 1-level propagation without rebuilding the graph

### Test Plan

#### For QA
1. Run `prjct sync` on fresh project (no hash cache) — should behave as full sync
2. Run `prjct sync` again without changes — should skip index rebuilds and agent regeneration
3. Modify a `.ts` file, run `prjct sync` — should detect change and rebuild indexes
4. Modify `package.json`, run `prjct sync` — should regenerate agents
5. Run `prjct sync --full` — should force complete re-analysis
6. Run `prjct watch`, change a file — should pass changedFiles to sync

#### For Users
**What changed:** `prjct sync` is now incremental by default.
**How to use:** No changes needed. Use `prjct sync --full` to force complete re-analysis.
**Breaking changes:** None

## [1.17.0] - 2026-02-09

### Features

- implement BM25 + import graph + git co-change for zero-cost file selection (PRJ-304) (#159)


## [1.17.0] - 2026-02-08

### Features
- **BM25 + import graph + git co-change file selection** (PRJ-304): Zero-cost file selection using three mathematical signals combined into a weighted ranker. Replaces keyword matching in smart-context with precision that matches LLM-based classification — at zero API cost.

### Implementation Details
- `core/domain/bm25.ts` — BM25 indexer: tokenizes files (exports, functions, imports, comments, path segments), builds inverted index, scores queries using Okapi BM25 (k1=1.2, b=0.75). Stores in SQLite kv_store.
- `core/domain/import-graph.ts` — Import graph builder: parses TS/JS imports to build directed adjacency list, follows chains 2 levels deep, scores by proximity (1/(depth+1)).
- `core/domain/git-cochange.ts` — Git co-change analyzer: parses last 100 commits, builds Jaccard similarity matrix for file pairs that change together.
- `core/domain/file-ranker.ts` — Combined ranker: `BM25 × 0.5 + imports × 0.3 + cochange × 0.2`, normalizes each signal to [0,1], returns top 15 files.
- `core/agentic/smart-context.ts` — Uses ranker when indexes exist, graceful fallback to regex-based domain filtering.
- `core/services/sync-service.ts` — Builds all 3 indexes in parallel during `prjct sync`.

### Learnings
- `tokenizeQuery` must split camelCase BEFORE lowercasing — otherwise "getUserById" becomes "getuserbyid" and doesn't split
- Jaccard similarity > cosine for co-change because data is binary (file present or not in commit)
- Batch file reads (50 at a time) needed for indexing performance on large projects
- Stop words list must include code keywords (import, export, const) to reduce noise in scoring

### Test Plan

#### For QA
1. Run `prjct sync` — verify BM25, import graph, and co-change indexes build without errors
2. Query "Fix auth middleware" — verify auth-related files rank higher than unrelated files
3. Query "Build responsive dashboard" — verify frontend files rank higher than backend files
4. Verify index rebuild time <5 seconds on 300+ file project
5. Verify query time <50ms
6. Verify zero API calls during file selection

#### For Users
**What changed:** File selection during task context is now powered by BM25 text search, import graph proximity, and git co-change analysis instead of keyword matching.
**How to use:** Run `p. sync` to build indexes — file selection is automatic and more accurate.
**Breaking changes:** None. Falls back to previous filtering if indexes don't exist.

## [1.16.0] - 2026-02-09

### Features

- remove JSON storage redundancy, SQLite-only backend (PRJ-303) (#158)

## [1.16.0] - 2026-02-08

### Features
- **Remove JSON storage redundancy** (PRJ-303): SQLite is now the sole storage backend. JSON dual-write removed from StorageManager and IndexStorage. Auto-migration runs during `prjct sync`, deletes source JSON files after backup.

### Implementation Details
- `StorageManager.write()` — removed JSON file write and temp file pattern; writes only to SQLite kv_store + regenerates context MD
- `StorageManager.read()` — removed JSON fallback; reads from cache → SQLite → default
- `StorageManager.exists()` — removed JSON file check; checks SQLite only
- `IndexStorage` — all 5 read methods (readIndex, readChecksums, readScores, readDomains, readCategories) no longer fall back to JSON; all 5 write methods no longer create JSON files
- `migrateJsonToSqlite()` — new cleanup step deletes `storage/*.json`, `index/*.json`, `memory/*.jsonl` after successful migration; keeps `storage/backup/`
- `SyncService.sync()` — auto-runs `migrateJsonToSqlite()` after directory setup (idempotent)
- `PrjctDatabase.getDb()` — ensures parent directory exists before creating SQLite DB
- `database.ts` — fixed all TS errors: `db.exec()` → `db.run()` (deprecated), `unknown[]` → `SQLQueryBindings[]`, `require()` → `fs.existsSync()`

### Test Plan

#### For QA
1. Run `bun test` — all 879 tests must pass
2. Run `prjct sync` on existing project — verify migration runs, JSON files deleted, `prjct.db` has data
3. Run `prjct sync` again — verify idempotent (no errors, migration skips)
4. Verify `storage/backup/` contains pre-migration JSON files
5. Verify `context/*.md` files still generated after writes
6. Run `prjct status` — verify state reads from SQLite

#### For Users
**What changed:** Storage is now fully SQLite-backed. JSON files are auto-migrated and removed during sync.
**How to use:** Run `prjct sync` — migration happens automatically.
**Breaking changes:** None — all public APIs unchanged. JSON backups preserved in `storage/backup/`.

## [1.15.0] - 2026-02-09

### Features

- replace hardcoded memory domain tags with semantic matching (PRJ-300) (#157)


## [1.14.1] - 2026-02-09

### Improved
- **Semantic memory domain matching** (PRJ-300): Memory retrieval now uses two-pass scoring (exact MEMORY_TAG match + semantic keyword match) instead of exact-only tag matching. Unknown domains like "uxui" are resolved to canonical domains ("frontend") via SEMANTIC_DOMAIN_KEYWORDS map.
- **Tech stack normalizer**: New `tech-normalizer.ts` module handles framework name normalization, compound names ("React + TypeScript"), framework families (Next.js → React), and alias resolution (nextjs → next.js).
- **Anti-hallucination dedup**: Tech stack entries in the anti-hallucination block are now deduplicated using normalized matching, preventing duplicates like "React" and "react" or "Next.js" and "nextjs".
- **Sealed analysis priority**: Prompt builder now uses sealed analysis frameworks as primary tech stack source, falling back to repo conventions.

### Implementation Details
- Expanded `TaskDomain` type from fixed union to `KnownDomain | (string & {})` for forward compatibility while preserving autocomplete
- `DOMAIN_TAG_MAP` now includes TECH_STACK for frontend/database domains (previously missing)
- `SEMANTIC_DOMAIN_KEYWORDS` maps 80+ keywords across 7 domains for fuzzy domain resolution
- `resolveCanonicalDomains()` exported for testability — resolves arbitrary strings to known domains
- `normalizeFrameworkName()` handles 15 aliases; `FRAMEWORK_FAMILIES` maps 12 meta-frameworks to base frameworks
- `extractTechNames()` splits compound tech strings on +, /, commas, parentheses, "with", "and"

### Learnings
- Two-pass scoring (exact 10pts + semantic 5pts) gives gradual relevance instead of binary match/no-match
- TypeScript's `KnownDomain | (string & {})` pattern preserves autocomplete for known values while accepting any string
- Parentheses in compound names need comma replacement (not space) — otherwise adjacent words merge into a single token

### Test Plan

#### For QA
1. `bun test core/__tests__/agentic/semantic-matching.test.ts` — domain resolution (uxui→frontend, api→backend, infra→devops)
2. `bun test core/__tests__/agentic/tech-normalizer.test.ts` — normalization, compound names, framework families, dedup
3. `bun test core/__tests__/agentic/prompt-assembly.test.ts` — anti-hallucination block still renders correctly
4. `bun test` — 848 tests pass, 0 fail

#### For Users
- Memory retrieval automatically surfaces related memories across domains
- No user action needed — improvements are automatic
- No breaking changes

## [1.14.0] - 2026-02-09

### Features

- add sprint-based velocity calculation with trend detection (PRJ-296) (#156)


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
