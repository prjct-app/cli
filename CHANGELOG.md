# Changelog

All notable changes to prjct-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Coming Soon
- **Windows Compatibility** - Native Windows support
  - PowerShell and CMD command execution
  - Windows path handling (`%USERPROFILE%\.prjct-cli\`)
  - Windows-specific installation scripts
  - Cross-platform file operations
  - Windows Terminal integration

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