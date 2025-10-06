# /p:setup - Reconfigure prjct-cli Installation

Reconfigures prjct-cli installation for Claude Code and Claude Desktop.

## Usage

```
/p:setup [--force]
```

## What This Command Does

1. **Detects Claude Installation**
   - Checks if `~/.claude/` directory exists
   - Verifies Claude Code or Claude Desktop is installed

2. **Syncs Commands to Claude**
   - Updates all `/p:*` commands in `~/.claude/commands/p/`
   - Adds new commands from latest version
   - Updates existing commands with latest templates
   - Removes orphaned/deprecated commands

3. **Installs/Updates Global Configuration**
   - Creates or updates `~/.claude/CLAUDE.md`
   - Adds prjct-specific instructions for Claude
   - Preserves existing user configuration

4. **Reports Results**
   - Shows commands added, updated, removed
   - Displays any errors encountered
   - Confirms successful installation

## Options

- `--force`: Remove existing installation and reinstall from scratch

## When to Use

- **After updating prjct-cli**: `npm update -g prjct-cli && /p:setup`
- **Commands not working**: If `/p:*` commands aren't recognized
- **Fresh installation**: After installing on a new machine
- **Troubleshooting**: When encountering command-related issues

## Requirements

- Claude Code or Claude Desktop must be installed
- Write permissions to `~/.claude/` directory

## Output Example

```
🔧 Reconfiguring prjct...

📦 Installing /p:* commands...
✓ 3 nuevos, 12 actualizados, 1 eliminado

📝 Installing global configuration...
✓ Updated ~/.claude/CLAUDE.md

✅ Setup complete!
```

## Error Handling

- **Claude not detected**: Shows installation URLs for Claude Code/Desktop
- **Permission errors**: Reports which files couldn't be written
- **Template errors**: Lists which commands failed to install

## Notes

- This command does NOT migrate projects (use `/p:migrate-all` for that)
- This command does NOT require an initialized prjct project
- Safe to run multiple times (idempotent)
- Will not overwrite user customizations in `~/.claude/CLAUDE.md`
