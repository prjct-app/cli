# Changelog

All notable changes to prjct-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enhanced Installer Visual Design**
  - New ASCII art logo for prjct/cli branding
  - Improved visual hierarchy with better spacing and borders
  - More attractive success message with the logo
  - Professional appearance similar to modern CLI tools

- **Version Management System**
  - Automatic version checking during installation
  - Comparison between local and remote versions
  - Smart update prompts only when new versions are available
  - Force reinstall option with `--force` flag
  - Version display in installer header and success message

- **Installation Options**
  - `--force` flag for forced reinstallation
  - `-y` or `--yes` flag for unattended installation
  - `--silent` flag for minimal output mode
  - `--dev` flag for development branch installation
  - `--help` or `-h` flag for usage information
  - Auto-accept mode when running through pipe (curl)

- **Improved User Experience**
  - Clear version information throughout installation
  - Better prompts for updates and reinstallation
  - Graceful handling of up-to-date installations
  - Enhanced documentation with installation options

### Changed
- Installer header design with prominent ASCII art logo
- Success message format with visual branding
- Installation flow to check versions before updating
- Documentation to reflect new installation options

### Fixed
- Arithmetic operation syntax error in command counting
- Version detection for existing installations

## [0.1.0] - 2024-01-XX

### Added
- Initial release of prjct-cli
- AI-integrated project management system
- Support for Claude Code, OpenAI Codex, and Terminal
- Core commands: init, now, done, ship, recap, etc.
- MCP integration for AI assistants
- Automatic environment detection
- Project structure in `.prjct/` directory