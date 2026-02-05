# Changelog

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
