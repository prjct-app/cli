# Changelog

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
- add natural language interface with English and Spanish support
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
- LLM debe manejar los prompts, no el CLI - PRJ-149 (#84)
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

- LLM debe manejar los prompts, no el CLI - PRJ-149 (#84)


## [0.55.3] - 2026-01-30

### Fixed

- **LLM debe manejar los prompts, no el CLI** (PRJ-149)
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
  - Configure hooks with `p. workflow "antes de ship corre los tests"`
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
