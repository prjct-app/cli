# 🗑️ Uninstalling prjct-cli

This guide explains how to completely remove prjct-cli from your system.

## Quick Uninstall

```bash
cd ~/.prjct-cli
./uninstall.sh
```

## What Gets Removed

The uninstaller will remove the following components:

### 1. Installation Directory
- `~/.prjct-cli/` - The main installation directory containing all prjct-cli files

### 2. Command Line Tools
- `~/.local/bin/prjct` - The symlink for the `prjct` command
- Any npm global installations of `@prjct/cli`

### 3. Shell Configuration
- PATH modifications in:
  - `~/.zshrc` (for Zsh users)
  - `~/.bashrc` (for Bash users)
  - `~/.profile` (fallback)

### 4. AI Assistant Integration
- `~/.claude/commands/p/` - Claude Code command files
- MCP server configurations (if applicable)

## Project Data Options

The uninstaller will detect any `.prjct/` directories in your projects and offer three options:

### Option 1: Keep All Data (Recommended)
- **Default choice**
- Preserves all `.prjct/` directories in your projects
- You can manually delete them later if needed
- Best if you might reinstall prjct-cli

### Option 2: Backup Before Removal
- Creates a backup at `~/prjct-backup-[date]`
- Each project's `.prjct/` data is saved with the project name
- Original `.prjct/` directories are then removed
- Good for archiving your project history

### Option 3: Permanent Deletion
- **⚠️ IRREVERSIBLE ACTION**
- Permanently deletes all `.prjct/` directories
- Requires typing `DELETE` to confirm
- Cannot be undone - use with extreme caution

## Safety Features

The uninstaller includes multiple safety measures:

1. **Detection Phase**: Shows exactly what will be removed before any action
2. **Confirmation Required**: Must type `yes` to proceed (not just y/n)
3. **Data Protection**: Project data requires separate confirmation
4. **Double Confirmation**: Destructive actions require typing specific words
5. **Graceful Exit**: Cancel at any point preserves everything

## What Is NOT Removed

The uninstaller does NOT remove:

- Your actual project files (only `.prjct/` directories if you choose)
- Git repositories or version control
- Node.js or other system dependencies
- Other tools or configurations

## Manual Uninstall

If you prefer to uninstall manually:

```bash
# 1. Remove installation directory
rm -rf ~/.prjct-cli

# 2. Remove symlink
rm -f ~/.local/bin/prjct

# 3. Remove Claude Code commands
rm -rf ~/.claude/commands/p

# 4. Edit your shell config file and remove these lines:
# # prjct/cli
# export PATH="$HOME/.prjct-cli/bin:$PATH"

# 5. (Optional) Remove project data
# Find all .prjct directories:
find ~ -type d -name ".prjct" -maxdepth 5

# Remove specific project data:
rm -rf /path/to/project/.prjct
```

## Reinstallation

To reinstall prjct-cli after uninstalling:

```bash
curl -fsSL https://prjct.app/install.sh | bash
```

Your project data (if preserved) will be immediately available with the new installation.

## Troubleshooting

### Uninstaller Not Found

If the uninstaller script is not in your installation:

```bash
# Download the latest uninstaller
curl -fsSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/uninstall.sh -o uninstall.sh
chmod +x uninstall.sh
./uninstall.sh
```

### Permission Errors

If you encounter permission errors:

```bash
# Run with appropriate permissions
sudo ./uninstall.sh
```

### Incomplete Removal

If some components remain after uninstalling:

1. Check for lingering PATH entries in your shell config
2. Verify npm global packages: `npm list -g @prjct/cli`
3. Look for Claude Code commands: `ls ~/.claude/commands/p/`

## Support

If you need help with uninstallation:

- Open an issue: [GitHub Issues](https://github.com/jlopezlira/prjct-cli/issues)
- Check documentation: [Project README](README.md)

## Feedback

We're sorry to see you go! If you have feedback about why you're uninstalling, please let us know by opening an issue. Your feedback helps us improve prjct-cli for everyone.