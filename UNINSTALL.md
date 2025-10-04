# 🗑️ Uninstalling prjct-cli

This guide explains how to completely remove prjct-cli from your system.

## Quick Uninstall

```bash
# Uninstall the npm package
npm uninstall -g prjct-cli

# Remove user data (optional)
rm -rf ~/.prjct-cli
```

## What Gets Removed

### 1. npm Package

```bash
npm uninstall -g prjct-cli
```

This removes:

- The globally installed `prjct` command
- All CLI executables and core files
- npm package cache

### 2. User Data Directory (Optional)

```bash
rm -rf ~/.prjct-cli
```

This removes:

- `~/.prjct-cli/projects/` - All your project data
- `~/.prjct-cli/config/` - Configuration and cache files

### 3. AI Assistant Integration

If you installed editor commands with `prjct install`:

- `~/.claude/commands/p/` - Claude Code slash commands
- `~/.cursor/commands/p/` - Cursor AI commands
- `~/.codeium/commands/p/` - Codeium commands
- `~/.windsurf/commands/p/` - Windsurf commands

## Project Data (Local Config)

Each project has a small config file at `.prjct/prjct.config.json` that references the global data.

**To remove from a specific project:**

```bash
cd /path/to/your/project
rm -rf .prjct
```

**Important**: This only removes the local config, not your actual project data in `~/.prjct-cli/projects/`

## What Is NOT Removed

The uninstaller does NOT remove:

- Your actual project files (only `.prjct/` directories if you choose)
- Git repositories or version control
- Node.js or other system dependencies
- Other tools or configurations

## Complete Removal

To remove everything including data and editor commands:

```bash
# 1. Uninstall npm package
npm uninstall -g prjct-cli

# 2. Remove all user data
rm -rf ~/.prjct-cli

# 3. Remove editor commands
rm -rf ~/.claude/commands/p
rm -rf ~/.cursor/commands/p
rm -rf ~/.codeium/commands/p
rm -rf ~/.windsurf/commands/p

# 4. (Optional) Remove local project configs
# Find all .prjct directories:
find ~ -type d -name ".prjct" -maxdepth 5

# Remove specific project config:
rm -rf /path/to/project/.prjct
```

## Reinstallation

To reinstall prjct-cli after uninstalling:

```bash
npm install -g prjct-cli
```

If you preserved `~/.prjct-cli/`, your project data will be immediately available with the new installation.

## Troubleshooting

### Verify Complete Removal

Check if prjct is still installed:

```bash
# Check npm global packages
npm list -g prjct-cli

# Check command availability
which prjct

# Check user data
ls -la ~/.prjct-cli
```

### Permission Errors

If you encounter permission errors with npm:

```bash
# May need sudo on some systems
sudo npm uninstall -g prjct-cli
```

## Support

If you need help with uninstallation:

- Open an issue: [GitHub Issues](https://github.com/jlopezlira/prjct-cli/issues)
- Check documentation: [Project README](README.md)

## Feedback

We're sorry to see you go! If you have feedback about why you're uninstalling, please let us know by opening an issue. Your feedback helps us improve prjct-cli for everyone.
