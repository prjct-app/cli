# Changelog

## [1.21.0] - 2026-02-10

### Features

- add semantic verification for analysis results (PRJ-270) (#163)


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
