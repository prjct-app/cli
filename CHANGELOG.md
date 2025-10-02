# Changelog

All notable changes to prjct-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Copy Simplification for Creators** - Made all text stupidly simple to understand
  - Updated `README.md` to speak to creators and small teams, not just developers:
    - Changed "indie hackers" → "solo creators and founders"
    - Changed "developer momentum" → "track progress, not meetings"
    - Simplified technical jargon:
      - "Git validation" → "Checks your actual code changes"
      - "MCP Integration" → "AI tools that help you code"
      - "Dynamic AI Agents" → "Smart AI helpers"
    - Made benefits easier to understand for non-technical creators
  - Updated `website/src/components/InteractiveTerminal.tsx` examples:
    - "implement user authentication" → "build login feature"
    - "JWT token not validating" → "login not working"
    - "API rate limiting" → "prevent spam requests"
    - "Design notification architecture" → "Design how notifications will work"
    - "Setup WebSocket server" → "Setup real-time messaging"
  - Added explanatory comments to `website/src/lib/utils.ts`:
    - Simple explanation of what `cn()` function does
    - Real-world examples for creators

### Added
- **p. Trigger System** - Zero memorization interface for prjct context
  - Simple prefix `p.` signals prjct context (e.g., "p. analiza esto")
  - Works in any language: English, Spanish, German, etc.
  - Auto-validates `.prjct/prjct.config.json` before execution
  - Context-aware: Only works in prjct directories
  - Provides friendly error when not in prjct project
  - Implemented via CLAUDE.md instructions (no SDK needed)
  - Zero API keys, zero additional costs

- **Natural Language Context Validation** - Conversational responses when context is missing
  - Automatic context validation before command execution
  - Friendly guidance instead of technical errors
  - Multi-language intent detection (English, Spanish, etc.)
  - Works natively in Claude Code and Claude Desktop

### Changed
- **Natural Language System** - Enhanced with p. trigger and context validation
  - Updated `CLAUDE.md` with complete p. trigger detection logic
  - Added context validation examples and patterns
  - Implemented semantic intent understanding (Claude's native LLM capability)
  - Updated `templates/commands/done.md` with context validation docs
  - Updated `templates/examples/natural-language-examples.md`:
    - Added Example 11: p. Trigger (zero memorization)
    - Added Example 12: p. Trigger multi-language
    - Added Example 13: p. Trigger without project
    - Added Example 14: All three ways work (p. | /p: | natural)
    - Added examples for missing context scenarios (Example 2b, 3b)
    - Updated implementation notes (no SDK approach)
  - Created `docs/p-trigger.md` - Complete p. trigger documentation

- **Website Alignment** - Updated all components to show p. trigger as primary interface
  - `website/src/components/Hero.tsx`:
    - Updated p. Trigger feature description
    - Changed badge to "Built for Claude Code - Claude Desktop"
    - Restored Windsurf Extension CTA with scroll-to-section functionality
    - Added Sparkles and ArrowRight animated icons
  - `website/src/components/Features.tsx`:
    - Updated p. Trigger feature to show natural language first
  - `website/src/components/CommandGuide.tsx`:
    - Added p. trigger examples to all 6 scenarios (preferred option)
    - Updated Quick Decision Matrix to show p. trigger format
    - All examples now follow: `"p. [natural language]"` → `/p:command` pattern
    - Demonstrates zero memorization approach throughout

- **Windsurf Extension Preview Section** - Added complete Windsurf extension roadmap to homepage
  - `website/src/components/WindsurfExtension.tsx`:
    - Full section with hero, features grid, timeline, and early access form
    - Development timeline (Oct 2025 - Feb 2026)
    - 4 key features: Real-time Metrics, Focus Mode, Velocity Tracking, Smart Notifications
    - Progress bar showing 10% completion (validation phase)
    - Scroll target for Hero CTA (`.windsurf-extension-section`)
  - `website/src/components/WindsurfPreview.tsx`:
    - Interactive mockup of Windsurf extension UI
    - Kanban-style roadmap with drag & drop
    - AI Task Generator and PRJCT Control Center
    - Project Rules management interface
  - `website/src/components/EarlyAccessForm.tsx`:
    - GitHub issue-based waitlist signup
    - Animated with framer-motion
    - Purple/blue gradient theme
  - `website/src/pages/Home.tsx`:
    - Added WindsurfExtension between Features and ClaudeSuperpowers
    - Maintains page flow and user journey

### Fixed
- **🐛 Natural Language Context Bug** - Fixed error messages when context is missing
  - Before: "⏺ No hay tarea activa en este momento..." (technical error)
  - After: "✨ You're not working on anything right now! Want to start something?" (conversational)
  - Affects ALL commands: /p:done, /p:ship, /p:stuck, /p:idea, /p:now
  - Claude automatically validates and provides friendly guidance

### Technical Implementation
- **Zero External Dependencies** - All functionality via CLAUDE.md
  - No SDK required (initially considered but removed)
  - Uses Claude Code's native session (zero API keys)
  - Simple file reads for context validation
  - Works identically in Claude Code and Claude Desktop
  - No additional costs for users

### Coming Soon
- **Windows Compatibility** - Native Windows support
  - PowerShell and CMD command execution
  - Windows path handling (`%USERPROFILE%\.prjct-cli\`)
  - Windows-specific installation scripts
  - Cross-platform file operations
  - Windows Terminal integration

## [0.5.0] - 2025-10-02

### 🚨 BREAKING CHANGES

- **100% Claude-Focused Architecture** - Removed support for all non-Claude environments
  - ❌ **Removed**: OpenAI Codex support
  - ❌ **Removed**: Cursor AI support
  - ❌ **Removed**: Windsurf/Codeium support
  - ✅ **Supported**: Claude Code (primary)
  - ✅ **Supported**: Claude Desktop (secondary)

- **Simplified Installation** - Now installs only to `~/.claude/`
  - Single editor detection (Claude only)
  - Removed multi-editor selection workflow
  - Removed editor-specific adapters and formatters

- **Deleted Files**:
  - `core/agents/codex-agent.js` - OpenAI Codex adapter
  - `core/agents/terminal-agent.js` - Terminal fallback
  - `AGENTS.md` - Legacy Codex configuration
  - `templates/workflows/` - Windsurf workflow templates

- **Rewritten Modules** (breaking API changes):
  - `command-installer.js` - Now Claude-only (208 lines, was 800+)
  - `editors-config.js` - Simplified to single editor (160 lines, was 205)
  - `agent-detector.js` - Claude detection only (183 lines, was 250)

### 🚀 Why This Change? (Built for Claude - Ship Fast, No BS)

**prjct-cli is now a developer momentum tool, NOT a project management tool.**

**The Philosophy:**
- Ship fast, stay focused, no BS
- For indie hackers and small teams (2-5 devs)
- No Jira, no ceremonies, no bureaucracy
- Just `/p:now` → work → `/p:done` → `/p:ship` → celebrate

**By focusing 100% on Claude, we unlocked superpowers:**

1. **🤖 Dynamic AI Agents**
   - Auto-generated specialists (PM, Frontend, Backend, UX, QA, Scribe, Security, DevOps, Mobile, Data)
   - Context-aware activation based on your project stack
   - Impossible to build with multi-platform support

2. **🔗 Native MCP Integration**
   - Context7 - Automatic library documentation
   - Sequential - Deep reasoning for complex problems
   - Magic - UI component generation from patterns
   - Playwright - Browser automation and E2E testing
   - MCP is Claude-native, can't replicate elsewhere

3. **✅ Git Validation**
   - Last commit as source of truth
   - Validates completed work against actual changes
   - Prevents empty task completions
   - Requires tight Claude integration

4. **💬 Natural Language**
   - Talk naturally in any language, no command memorization
   - "I'm done" → `/p:done`, "ship this" → `/p:ship`
   - Leverages Claude's language understanding

5. **⚡ Technical Benefits**
   - **50-60% less code** (800+ lines → 228 lines in command-installer alone)
   - Faster features and bug fixes
   - Proper testing of everything we support
   - Honest compatibility (only claim what works)

**Migration Path:**
- **Using Claude?** → `npm update -g prjct-cli` (you're all set!)
- **Using Cursor/Windsurf/Codex?** → Switch to Claude Code (free) or stay on v0.4.10
- **See [MIGRATION.md](MIGRATION.md) for complete upgrade guide**

**This isn't a limitation - it's a strategic decision that makes prjct-cli better for developers who ship fast.**

### Added
- **Dynamic AI Agent System** - Automatic generation of specialized AI agents based on project stack
  - **GitIntegration Module** (`core/git-integration.js`)
    - Repository validation and state tracking
    - Last commit as source of truth for validation
    - Working directory status monitoring
    - User claim validation against commit history
    - Comprehensive git statistics and reporting

  - **AgentGenerator Module** (`core/agent-generator.js`)
    - Dynamic agent creation based on project analysis
    - Project-specific context injection into agent templates
    - Intelligent conditional agent detection
    - Agent update and synchronization capabilities
    - Support for both base and conditional agents

  - **Base AI Agents** (Always Generated)
    - PM (Project Manager) - Task coordination and breakdown
    - FE (Frontend Engineer) - UI/UX, React, components, state management
    - BE (Backend Engineer) - APIs, database, SOLID principles
    - UX (UX Designer) - User experience, accessibility, design systems
    - QA (QA Engineer) - Testing strategy and automation
    - Scribe (Documentation) - Technical writing and changelog management

  - **Conditional AI Agents** (Generated Based on Project Stack)
    - DevOps - Docker, CI/CD, infrastructure (when Docker/CI/CD detected)
    - Security - OWASP, threat modeling (when web app or auth detected)
    - Mobile - React Native, Flutter (when mobile frameworks detected)
    - Data - ML, data pipelines (when ML libraries detected)

  - **Scribe Agent Workflows**
    - Automatic documentation on `/p:done` completion
    - Feature documentation on `/p:ship` deployment
    - Git-based change detection for documentation scope
    - User confirmation workflow before saving documentation
    - Task docs saved to `analysis/task-docs/`
    - Feature docs saved to `analysis/feature-docs/`

- **Enhanced `/p:analyze` Command**
  - Git repository integration and validation
  - Last commit information and statistics
  - Working directory status tracking
  - Validation baseline for user claims
  - Conditional agent detection based on stack
  - Comprehensive project analysis report with git stats
  - Agent recommendation system

- **Enhanced `/p:init` Command**
  - Automatic agent generation after project analysis
  - Git-integrated analysis workflow
  - Project-specific agent context injection
  - Smart agent selection based on detected stack
  - Agents stored in `~/.claude/agents/` directory

- **New `/p:sync` Command**
  - Re-analyze project for stack changes
  - Update existing agents with new project context
  - Add newly required agents based on stack evolution
  - Remove obsolete agents with user confirmation
  - Comprehensive sync reporting and logging

### Changed
- **Agent Architecture** - 100% Claude-focused (Claude Code + Claude Desktop)
  - Agents stored in `~/.claude/agents/` directory
  - Markdown format with YAML frontmatter (Claude native)
  - Project-specific naming: `p_agent_[type].md`
  - Dynamic context injection from project analysis
  - Limited expertise per agent (focused specialization)

### Technical Details
- **10 Agent Templates** in `templates/agents/`
  - 6 base templates (always generated)
  - 4 conditional templates (stack-dependent)
  - Each template includes project context placeholders
  - Specialized tools and color coding per agent type
  - Defined expertise boundaries and trigger keywords

- **Git Integration Features**
  - Commit validation and claim verification
  - Working directory change tracking
  - Unverified work identification
  - Comprehensive git statistics
  - Multi-contributor support

## [0.4.10] - 2025-10-02

### Changed
- **Agent Workflow Initialization** - `prjct init` now properly initializes AI agent workflows
  - When existing codebase detected, prompts user to run `/p:analyze`
  - Enables AI agents to follow complete analysis workflow
  - Provides proper workflow context for comprehensive project analysis
  - Replaced silent programmatic analysis with workflow-driven approach

### Fixed
- **Analysis Workflow** - AI agents now receive proper instructions during project initialization
  - Removed silent `analyze()` call that bypassed agent workflows
  - Agent workflows now activate when user runs `/p:analyze` command
  - Ensures agents follow complete analysis instructions from workflow templates

## [0.4.9] - 2025-10-02

### Added
- **Editor Uninstallation** - `prjct start` now allows removing editors
  - Interactive checkbox selection shows currently installed editors
  - Uncheck an editor to remove all prjct commands from it
  - Automatically cleans up `~/.prjct-cli/config/installed-editors.json`
  - User has full control over which editors have prjct commands

### Changed
- **`prjct start` Never Blocks** - Removed "already set up" error
  - Can run `prjct start` anytime to reconfigure editors
  - Shows beautiful ASCII art every time
  - User decides which editors to keep/remove

### Fixed
- **Interactive Prompts** - Better UX for editor selection
  - Pre-selects currently installed editors
  - Clear message: "Select AI editors (uncheck to remove)"
  - Allows selecting 0 editors (removes all)

## [0.4.8] - 2025-10-02

### Added
- **Intelligent Project Initialization** - `prjct init` now works seamlessly in all scenarios
  - Preserves existing project IDs when re-initializing
  - Automatically merges local data with global structure
  - Smart fusion of markdown files (now.md, next.md, shipped.md, ideas.md)
  - Chronological merging of memory/context.jsonl entries
  - Cleans up local `.prjct/` directory, keeping only `prjct.config.json`
  - Multiple developers can initialize the same project without conflicts

### Fixed
- **Auto-Migration Removed** - Disabled intrusive automatic migration
  - Migration no longer runs automatically during `prjct init` or any command
  - Users can run `prjct migrate-all` manually if needed
  - Removes blocking behavior that prevented normal usage
  - Cleaner, non-intrusive installation and update experience

### Changed
- **`prjct init` Never Blocks** - Removed "already initialized" error
  - Always allows re-initialization with intelligent data fusion
  - Global architecture enables multi-developer workflows

## [0.4.7] - 2025-10-02

### Fixed
- **`prjct start` ASCII Art** - Restored beautiful Catppuccin-inspired colors
  - Original design from install.sh with (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
  - Vibrant magenta, cyan, and blue gradient for logo
  - Clean, professional look with value propositions
  - Better visual hierarchy and branding
- **`prjct start` Display Bug** - Fixed editor names showing as "undefined"
  - Now correctly displays editor names (Claude Code, Cursor, etc.)
  - Uses `commandInstaller.editors[key].name` to get proper editor names

## [0.4.6] - 2025-10-02

### Added
- **`prjct start` Command** - First-time setup with interactive editor selection
  - Beautiful ASCII art welcome message
  - Auto-detects installed AI editors (Claude Code, Cursor, Windsurf)
  - Interactive prompt to choose which editors to install commands to
  - Replaces confusing `prjct install` command with clearer naming
  - Only runs once (blocks if already configured, suggests `prjct setup` to reconfigure)

- **Auto-Initialization** - Commands auto-run `prjct init` when needed
  - All core commands (now, done, ship, next, idea, recap, stuck, context) check initialization
  - Shows warning and runs init automatically if project not configured
  - Zero friction - users don't need to remember to run init first
  - Seamless workflow: `cd project/ && prjct now "task"` just works

### Changed
- **Simplified Installation Flow**
  - `npm install -g prjct-cli` → Shows welcome message, tells user to run `prjct start`
  - `prjct start` → Interactive setup (first-time only)
  - `prjct init` → Initialize project (links to global data)
  - `prjct setup` → Reconfigure editors (replaces old `prjct install`)
  - `npm update -g prjct-cli` → Auto-updates commands in tracked editors

- **Post-Install Behavior**
  - Removed auto-installation on npm install (was non-interactive and confusing)
  - First install shows: `Run: prjct start to get started`
  - Updates auto-update commands in previously selected editors
  - Cleaner, more predictable behavior

### Fixed
- **Critical Bug Fixes** - All commands now enforce global architecture correctly
  - `/p:design` now creates designs in global `analysis/designs/` instead of local `.prjct/designs/`
  - `/p:cleanup` now operates on global project data instead of local `.prjct/`
  - `getDaysSinceLastShip()` now reads from global `memory/context.jsonl` instead of local
  - All commands verify project is initialized before execution
  - Prevents creation of invalid local `.prjct/` structures
  - **Fixed post-install.js** - `currentVersion` now declared before use (prevents ReferenceError)
  - **Added 'Apps' directory** to migration scanner for better project detection

### Technical Details
- **New Commands**:
  - `start()` - First-time setup with ASCII art and interactive editor selection
  - `setup()` - Renamed from `install()` for clarity
  - `ensureProjectInit()` - Helper function for auto-initialization
- **Global Architecture**: All commands now use `pathManager.getGlobalProjectPath(projectId)`
  - design(), cleanup(), getDaysSinceLastShip() fully migrated
  - Prevents LOCAL .prjct/ creation
  - Requires project initialization before command execution
- **Auto-Init Integration**: now(), done(), ship(), next(), idea(), recap(), stuck(), context() all auto-initialize
- **Migration Enhancement**: Added ~/Apps to common directories scan
- **Post-Install Fix**: currentVersion variable properly declared at function start

## [0.4.4] - 2025-10-02

### Added
- **Automatic Editor Command Updates** - Commands auto-update when npm package is updated
  - New `core/editors-config.js` tracks which editors user has installed commands to
  - Stores editor selections in `~/.prjct-cli/config/installed-editors.json`
  - Post-install hook (`scripts/post-install.js`) auto-updates commands after `npm update -g prjct-cli`
  - **Auto-installation on first install** - Detects AI editors and installs commands automatically
  - Ensures version consistency across all configured editors (Claude, Cursor, Windsurf, Codex)
  - No manual reinstallation needed - updates happen automatically
  - Respects user's original editor choices from initial setup

- **Automatic Cleanup on Uninstall** - Clean uninstallation removes all traces
  - New `scripts/preuninstall.js` runs before `npm uninstall -g prjct-cli`
  - Automatically removes commands from all tracked editors
  - Deletes tracking configuration from `~/.prjct-cli/config/`
  - Added `uninstallFromEditor()` and `uninstallFromAll()` methods to command installer
  - Added `deleteConfig()` method to editors config
  - Prevents orphaned commands when package is uninstalled
  - Clean exit even if cleanup fails (doesn't block uninstall)

- **Automatic Data Migration** - Seamless upgrade from v0.1.0 to v0.4.4
  - Post-install hook automatically detects legacy `.prjct/` projects
  - Migrates data from local structure to new global architecture (`~/.prjct-cli/projects/{id}/`)
  - Scans common project directories (Projects, Documents, Developer, Code, **Apps**)
  - Preserves all project data during migration (now, next, shipped, ideas, memory)
  - Cleans up legacy directories while keeping config for compatibility
  - No user intervention required - migration happens automatically on update
  - Uses existing battle-tested `core/migrator.js` system

### Changed
- **Improved Command Tracking** - Always track editor installations for better update management
  - Modified `installToSelected()` to always save editor config (removed `!forceUpdate` restriction)
  - Ensures tracking happens even during force updates
  - Enables reliable auto-updates across all configured editors

### Fixed
- **Global Architecture Enforcement** - All commands now enforce global architecture correctly
  - `/p:design` now creates designs in global `analysis/designs/` instead of local `.prjct/designs/`
  - `/p:cleanup` now operates on global project data instead of local `.prjct/`
  - `getDaysSinceLastShip()` now reads from global `memory/context.jsonl` instead of local
  - All commands verify project is initialized before execution
  - Prevents creation of invalid local `.prjct/` structures
  - **Fixed post-install.js** - `currentVersion` now declared before use (prevents ReferenceError)
  - **Added 'Apps' directory** to migration scanner for better project detection

### Technical Details
- **Post-Install Hook**: Runs after `npm install -g prjct-cli` or `npm update -g prjct-cli`
  - First install: Auto-detects editors and installs commands
  - Updates: Checks version change and auto-updates commands in tracked editors
  - **Migration**: Automatically detects and migrates legacy projects from v0.1.0
  - Silent operation with debug mode via `DEBUG=1` environment variable
  - **Fixed**: currentVersion variable now properly declared at function start
  - **Enhanced**: Better error handling with debug logging
- **Pre-Uninstall Hook**: Runs before `npm uninstall -g prjct-cli`
  - Reads tracking config to find all installed editors
  - Removes command directories from each editor
  - Cleans up tracking configuration
  - Fails gracefully to not block uninstall
- **Migration System**: Automatic upgrade path from v0.1.0 to v0.4.4
  - Scans common project directories including **~/Apps** (fast, non-intrusive)
  - Migrates local `.prjct/` to global `~/.prjct-cli/projects/{id}/`
  - Preserves all data: core, progress, planning, analysis, memory layers
  - Cleans legacy directories while keeping compatibility config
  - Zero data loss, seamless upgrade experience
- **Global Architecture**: All commands now use `pathManager.getGlobalProjectPath(projectId)`
  - design(), cleanup(), getDaysSinceLastShip() fully migrated
  - Prevents LOCAL .prjct/ creation
  - Requires project initialization before command execution

## [0.4.3] - 2025-10-02

### Added
- **Automatic Editor Command Updates** - Commands auto-update when npm package is updated
  - New `core/editors-config.js` tracks which editors user has installed commands to
  - Stores editor selections in `~/.prjct-cli/config/installed-editors.json`
  - Post-install hook (`scripts/post-install.js`) auto-updates commands after `npm update -g prjct-cli`
  - **Auto-installation on first install** - Detects AI editors and installs commands automatically
  - Ensures version consistency across all configured editors (Claude, Cursor, Windsurf, Codex)
  - No manual reinstallation needed - updates happen automatically
  - Respects user's original editor choices from initial setup

- **Automatic Cleanup on Uninstall** - Clean uninstallation removes all traces
  - New `scripts/preuninstall.js` runs before `npm uninstall -g prjct-cli`
  - Automatically removes commands from all tracked editors
  - Deletes tracking configuration from `~/.prjct-cli/config/`
  - Added `uninstallFromEditor()` and `uninstallFromAll()` methods to command installer
  - Added `deleteConfig()` method to editors config
  - Prevents orphaned commands when package is uninstalled
  - Clean exit even if cleanup fails (doesn't block uninstall)

- **GitHub Packages Support** - Dual registry publication for better reliability
  - Package now published to both npm and GitHub Packages automatically
  - GitHub Actions workflow updated to publish to both registries in parallel
  - Added comprehensive GitHub Packages documentation (`docs/GITHUB_PACKAGES.md`)
  - Includes `.npmrc.example` for easy local configuration
  - Provides fallback option if npm registry is unavailable
  - Free hosting for public repositories with automatic authentication

### Changed
- **Installation Documentation** - Updated README with dual installation options
  - Primary: npm registry (recommended for most users)
  - Alternative: GitHub Packages (for advanced users or npm fallback)
  - Clear instructions for both installation methods

- **Command Installer Improvements**
  - `installToSelected()` now always saves editor config (removed force-update restriction)
  - Better tracking ensures updates work correctly even for force updates
  - Improved error handling and reporting

### Technical Details
- **Editor Tracking**: Configuration saved after all successful command installations
- **Post-Install Hook**:
  - Runs only for global installations, skips for local/dev installs
  - Auto-detects and installs to all AI editors on first install
  - Auto-updates commands when version changes
- **Pre-Uninstall Hook**:
  - Runs only for global uninstallations
  - Removes slash commands from `~/.claude/`, `~/.cursor/`, `~/.windsurf/`
  - Removes AGENTS.md from `~/.codex/` if present
  - Deletes tracking configuration
- **Version Detection**: Compares current version with last installed version
- **Force Update**: Automatically updates commands when version changes
- **Parallel Publication**: npm and GitHub Packages jobs run simultaneously for faster releases

## [0.4.2] - 2025-10-02

### Fixed
- **Analyzer Compatibility** - Fixed ENOENT error when running `/p:init` in non-prjct projects
  - Added validation to check if `bin/prjct` exists before reading
  - Analyzer now works correctly in any project type (React, Vue, etc.)
  - No longer throws "no such file or directory" error for normal projects
  - Maintains full functionality for prjct-cli development projects

- **Website Build Process** - Improved build script and component imports
  - Fixed Badge component import casing (badge → Badge)
  - Removed obsolete install.sh and setup.sh copying from build script
  - Cleaner and faster website builds

## [0.4.1] - 2025-10-01

### Added
- **Automatic Update Detection** - Built-in update checker that notifies users of new versions
  - Checks npm registry every 24 hours for new versions
  - Non-blocking background check during command execution
  - Formatted notification with update command
  - Shows only once per session to avoid notification spam
  - Respects 24-hour cache to minimize npm registry requests

- **Automated npm Publication** - GitHub Actions workflow for automatic npm publishing
  - Triggered on version tags (v*)
  - Automatic version verification against package.json
  - Provenance publishing with npm attestation
  - Post-publication verification
  - Publication summary in GitHub Actions

### Changed
- **Installation Method** - npm is now the primary and recommended installation method
  - Simplified to single installation method: `npm install -g prjct-cli`
  - Removed Homebrew and Bun installation scripts
  - Cleaner package with optimized file inclusion
  - Reduced package size: 104.6 KB (71 files)

### Fixed
- **Package Structure** - Improved npm package configuration
  - Added `files` field to control package contents
  - Created `.npmignore` for development file exclusion
  - Proper global data directory separation (`~/.prjct-cli/` for data only)
  - Fixed CI/CD tests to verify CLI functionality instead of individual modules

### Technical Details
- **Update Checker**: `core/update-checker.js` with semantic version comparison
- **Cache Management**: Update checks cached for 24 hours in `~/.prjct-cli/config/update-cache.json`
- **Architecture**: Clean separation between npm installation (`/opt/homebrew/lib/node_modules/prjct-cli/`) and user data (`~/.prjct-cli/`)
- **GitHub Actions**: `.github/workflows/publish-npm.yml` for automated npm publication

## [0.4.0] - 2025-10-01

### Added
- **Interactive Workflow System** - Intelligent agent workflows with user-guided capability installation
  - **Adaptive Workflows**: Workflows detect missing capabilities and prompt user for decisions
  - **Smart Recommendations**: Stack-aware tool suggestions (React → Vitest, Vue → Vitest, Angular → Jest)
  - **Installation Tracking**: Every tool installation becomes a visible, tracked workflow task
  - **Interactive Prompts**: Never auto-skips steps - always asks user (install/skip/continue/pause)
  - **Capability Detection**: Automatically detects design systems, test frameworks, and documentation tools
  - **Auto-Configuration**: Installed tools are automatically configured with framework-specific settings
  - **Workflow Types**: UI, API, Bug Fix, Refactor, and Feature workflows with specialized agent assignments

- **New Core Modules**:
  - `core/workflow-engine.js`: Orchestrates adaptive workflows with step management
  - `core/workflow-rules.js`: Defines workflow pipelines by task type
  - `core/workflow-prompts.js`: Interactive prompting engine with stack detection
  - `core/capability-installer.js`: Handles tool installation, configuration, and verification
  - `core/project-capabilities.js`: Detects existing project capabilities (design/test/docs)

- **New Commands**:
  - `workflowRespond(choice)`: Handle user responses to workflow prompts
  - Enhanced `done()`: Checks for prompts, advances workflows intelligently
  - Enhanced `idea()`: Auto-initializes workflows for actionable tasks

### Changed
- **Workflow Behavior**: Transformed from auto-skip to interactive prompting
  - Before: Missing capability → auto-skip step
  - After: Missing capability → prompt user → track installation → continue
- **Step Tracking**: All workflow steps now tracked with status, duration, and metadata
- **Installation Visibility**: Tool installations appear as first-class workflow tasks

### Technical Details
- **Stack Detection**: Identifies React/Vue/Angular, TypeScript, bundler (Vite/Webpack/esbuild)
- **Tool Recommendations**:
  - React + TS → Vitest + Testing Library
  - Vue → Vitest + @vue/test-utils
  - Angular → Jest + @types/jest
- **Auto-Configuration**:
  - Creates config files (vitest.config.js, jest.config.js, jsdoc.json)
  - Updates package.json scripts
  - Verifies installation success
- **Duration Tracking**: Installation tasks show completion time (e.g., "1.2 min")

## [0.3.2] - 2025-10-01

### Fixed
- **Interactive Installation Compatibility** - Fixed interactive editor selection failing due to inquirer ESM compatibility issues
  - Replaced inquirer v12 with prompts v2.4.2 for better CommonJS compatibility
  - inquirer v12 required complex ESM dynamic imports causing "prompt is not a function" errors
  - prompts provides simpler API with native CommonJS support
  - Reduced package count from 68 to 40 dependencies
  - Fixed "inquirer.prompt is not a function" and "createPromptModule is not a function" errors
  - Interactive UI now works reliably across all Node.js versions
  - Updated `scripts/interactive-install.js` and `core/command-installer.js` to use prompts

## [0.3.1] - 2025-10-01

### Fixed
- **Installation Path Resolution Error** - Fixed "setup.sh: No such file or directory" error during installation (#11)
  - Corrected path resolution in installation scripts (docs/install.sh, scripts/install.sh, scripts/setup.sh)
  - Added verification tests in `tests/verify-install-paths.sh`
  - Added comprehensive documentation in `tests/INSTALL_PATH_FIX.md`
  - Thanks to [@danrocha](https://github.com/danrocha) for reporting the issue

## [0.3.0] - 2025-09-30

### Added
- **Intelligent Codebase Analysis & Sync** - Auto-detect implemented features and sync project state
  - `/p:analyze` command to analyze codebase and detect implemented commands/features
  - `/p:analyze --sync` to automatically update `.prjct/` files with real implementation state
  - Auto-execution during `/p:init` when cloning repos with existing code
  - Detects implemented commands by scanning `bin/prjct` and `core/commands.js`
  - Detects completed features from:
    - Git commit history (feat:, ship:, feature: prefixes)
    - Package.json dependencies (major frameworks and libraries)
    - Directory structure (auth/, api/, dashboard/, etc.)
  - Automatically updates `next.md` by marking completed tasks
  - Automatically adds detected features to `shipped.md`
  - Generates detailed analysis reports in `analysis/repo-summary.md`
  - Prevents duplicate work when multiple developers work on same codebase
  - Provides real project status visibility across team members
  - Zero-configuration sync for better collaboration without cloud storage

- **Interactive Editor Selection** - Choose which AI editors to install commands to
  - Interactive checkbox UI during `prjct install` and `prjct init`
  - Detects all installed editors (Claude Code, Cursor, Codex, Windsurf)
  - Shows installation paths for each detected editor
  - Allows users to select only the editors they use
  - `--no-interactive` flag to install to all detected editors without prompts
  - Optimizes installation by avoiding unnecessary editor installations

### Changed
- **Updated branding** - New header design with kaomoji (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
  - Refreshed README.md header with fun, friendly design
  - Updated installer (scripts/install.sh) to match new branding
  - Consistent visual identity across documentation and installation experience

## [0.2.1] - 2025-09-30

### Added
- **Multi-Editor Command Installation** - Automatic slash command deployment across AI editors
  - `prjct install` command to install/update commands in all detected editors
  - Automatic detection of Claude Code, Cursor AI, and Codeium installations
  - Template-based command system in `~/.prjct-cli/templates/commands/`
  - Commands automatically installed during `prjct init`
  - Support for `--force`, `--editor`, and `--create-templates` flags
  - Cross-editor data synchronization through global architecture
  - Installation verification and detailed reports

- **Global Migration System** - Automatic migration for all projects on user's machine
  - `prjct migrate-all` command to find and migrate all legacy projects
  - Scans common project directories: `~/Projects`, `~/Documents`, `~/Developer`, etc.
  - Optional `--deep-scan` flag to scan entire home directory
  - Optional `--remove-legacy` flag to clean up old `.prjct/` directories after migration
  - Optional `--dry-run` flag to preview changes without making them
  - Progress tracking with real-time updates during migration
  - Comprehensive summary report with statistics and results

- **Automated Project Discovery**
  - `findAllProjects()` method to recursively search for `.prjct/` directories
  - Intelligent directory skipping (node_modules, .git, dist, build, etc.)
  - Configurable recursion depth for safety
  - Handles permission errors gracefully

- **Bulk Migration Support**
  - `migrateAll()` method to process multiple projects in batch
  - Per-project validation and error handling
  - Continues on individual project failures
  - Detailed error reporting for failed migrations
  - Preserves 100% of data during migration (files and directories)

### Changed
- **Multi-Editor Support**
  - Updated command templates to use global architecture paths
  - Modified `prjct init` to automatically detect and install commands
  - Enhanced command-installer.js with editor-specific logic
  - Standardized command format across all supported editors

- **Repository Structure Reorganization**
  - Moved source code to `src/` directory
  - Moved scripts to `scripts/` directory
  - Moved configuration to `.config/` directory
  - Renamed `lp/` to `website/` for clarity
  - Renamed `test/` to `tests/` for consistency
  - Removed `.serena/` integration (unused)
  - Cleaned up backup files and duplicates
  - Added `templates/commands/` for command distribution

- **Documentation Updates**
  - Updated CONTRIBUTING.md with new repository structure
  - Added detailed migration documentation
  - Documented v0.2.1 global structure and multi-editor support
  - Added automatic migration instructions
  - Updated README.md with Cursor and Codeium support
  - Enhanced MIGRATION.md with command installation instructions

- **CLI Interface**
  - Added `install` command to CLI entry point for manual command installation
  - Added `migrate-all` command to CLI entry point
  - Added help text for new migration and installation commands
  - Improved command error messages
  - Enhanced init command with automatic editor installation

### Fixed
- Added missing `getGlobalBasePath()` method to path-manager.js
- Improved error handling in migration system
- Fixed paths in GitHub Actions workflow after reorganization
- Updated Prettier configuration paths after reorganization

## [0.2.0] - 2025-09-30

### 🚨 BREAKING CHANGES

**⚠️ IMPORTANT**: This is a DATA RELOCATION, not deletion. ALL your data is preserved and moved to a better location.

- **Data Storage Relocation**: All project data moved from `.prjct/` to `~/.prjct-cli/projects/[project-id]/`
  - ✅ 100% data preservation - every file, log, and timestamp
  - ✅ Automatic migration with validation
  - ✅ Reversible process (`.prjct/` kept as backup by default)

- **Migration Required**: Projects from v0.1.0 need one-time migration
  - Zero data loss guarantee
  - Automatic integrity validation
  - Simple process via installer or `/p:migrate`

- **Collaboration-Ready Architecture**: Designed for teams WITHOUT exposing personal data
  - `.prjct/prjct.config.json` in project (safe to commit)
  - Personal logs stay in `~/.prjct-cli/` (never committed)
  - Author tracking enables future collaboration features
  - Non-intrusive: Your velocity and notes stay private

- **Author Tracking**: All operations now include author information
  - Prepares for multi-user collaboration
  - Tracks who did what without exposing personal metrics
  - Automatic detection via GitHub CLI or git config

### Added
- **Global Data Storage System**
  - Project data stored in `~/.prjct-cli/projects/[hash-id]/`
  - Prevents bundle size inflation and accidental commits to git
  - Maintains data locally while keeping projects clean
  - Layered directory structure: core, progress, planning, analysis, memory

- **Author Detection & Tracking**
  - Multi-source author detection (GitHub CLI, git config)
  - Author information included in all memory logs
  - Automatic GitHub username detection via `gh api user`
  - Fallback to git config for name and email
  - Preparation for multi-user collaboration features

- **Project Configuration System**
  - New `.prjct/prjct.config.json` file in project
  - Tracks project ID, data location, and author info
  - Manages synchronization timestamps
  - Version tracking for future migrations

- **Automatic Migration System**
  - Detects v0.1.0 projects automatically
  - Migrates data to new global structure
  - Preserves all existing data and history
  - Creates configuration file automatically
  - Validates migration integrity
  - Optional legacy directory cleanup

- **New Core Modules**
  - `core/path-manager.js`: Manages local and global paths with hash-based project IDs
  - `core/config-manager.js`: Handles prjct.config.json operations
  - `core/author-detector.js`: Multi-method author detection system
  - `core/migrator.js`: Complete migration logic and validation

- **Enhanced Installer Visual Design** (from previous unreleased)
  - New ASCII art logo for prjct/cli branding
  - Improved visual hierarchy with better spacing and borders
  - Professional appearance similar to modern CLI tools

- **Version Management System** (from previous unreleased)
  - Automatic version checking during installation
  - Smart update prompts only when new versions are available
  - Force reinstall option with `--force` flag

- **Installation Options** (from previous unreleased)
  - `--force`, `-y`, `--silent`, `--dev`, `--help` flags
  - Auto-accept mode when running through pipe (curl)

### Changed
- **Data Location**: Moved from `.prjct/` to `~/.prjct-cli/projects/[id]/`
- **Memory Logs**: Now include `author` field in all entries
- **File Structure**: Organized into layers (core, progress, planning, analysis, memory)
- **Initialization**: Creates global structure and config file
- **All Commands**: Updated to use global paths and track authorship

### Removed
- Local `.prjct/` directory usage (replaced with global storage)
- Legacy flat file structure (replaced with layered architecture)

### Migration Guide
See [MIGRATION.md](MIGRATION.md) for detailed migration instructions.

**Quick Migration**:
```bash
# Projects will auto-detect migration need
# Run init to trigger migration
/p:init

# Or run explicit migration
/p:migrate
```

### Breaking Change Impact

**For Individuals**:
- ✅ One-time migration required (automatic, zero data loss)
- ✅ Cleaner repositories (no `.prjct/` bloat)
- ✅ No accidental commits of personal work logs
- ✅ Better privacy for your productivity tracking

**For Teams**:
- ✅ Share `.prjct/prjct.config.json` for coordination
- ✅ Each member tracks privately with author info
- ✅ No exposure of individual work patterns
- ✅ Future collaboration features enabled
- ✅ Perfect for open source, remote teams, consulting

**For Projects**:
- ✅ Git Repositories: `.prjct/` safely removed after migration
- ✅ CI/CD Pipelines: No changes needed - data fully external
- ✅ Bundle Size: Zero impact from prjct tracking
- ✅ Collaboration: Non-intrusive team workflow ready

### Fixed
- Arithmetic operation syntax error in command counting (from previous unreleased)
- Version detection for existing installations (from previous unreleased)

## [0.1.0] - 2024-01-XX

### Added
- Initial release of prjct-cli
- AI-integrated project management system
- Support for Claude Code, OpenAI Codex, and Terminal
- Core commands: init, now, done, ship, recap, etc.
- MCP integration for AI assistants
- Automatic environment detection
- Project structure in `.prjct/` directory