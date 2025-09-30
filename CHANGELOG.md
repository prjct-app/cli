# Changelog

All notable changes to prjct-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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