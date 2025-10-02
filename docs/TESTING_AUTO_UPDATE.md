# Testing Auto-Update System

This document explains how to test the automatic command update and cleanup system.

## System Overview

The auto-update system has three main components:

1. **Post-Install Hook** (`scripts/post-install.js`)
   - Runs after `npm install -g prjct-cli`
   - First install: Auto-detects editors and installs commands
   - Updates: Auto-updates commands when version changes

2. **Pre-Uninstall Hook** (`scripts/preuninstall.js`)
   - Runs before `npm uninstall -g prjct-cli`
   - Removes commands from all tracked editors
   - Cleans up tracking configuration

3. **Editor Config Tracking** (`~/.prjct-cli/config/installed-editors.json`)
   - Tracks which editors have commands installed
   - Stores installation paths and version
   - Used for automatic updates

## Testing First-Time Installation

### Test Scenario 1: Fresh Install with Editors

**Setup**:
```bash
# Make sure you have at least one AI editor installed
ls ~/.claude/   # Should exist (Claude Code)
ls ~/.cursor/   # Should exist (Cursor)
ls ~/.windsurf/ # Should exist (Windsurf)

# Make sure prjct-cli is NOT installed
npm uninstall -g prjct-cli

# Make sure no tracking config exists
rm -rf ~/.prjct-cli/config/
```

**Test**:
```bash
npm install -g prjct-cli@latest
```

**Expected Output**:
```
🔍 First-time installation detected...

📦 Installing commands to: Claude Code, Cursor

✅ Commands installed in: Claude Code, Cursor
   Commands installed: 36

✨ prjct-cli 0.4.4 is ready!
```

**Verification**:
```bash
# Check commands were installed
ls ~/.claude/commands/p/    # Should have: init.md, now.md, done.md, etc.
ls ~/.cursor/commands/p/    # Should have: init.md, now.md, done.md, etc.

# Check tracking config was created
cat ~/.prjct-cli/config/installed-editors.json
# Should show:
# {
#   "version": "0.4.4",
#   "editors": ["claude", "cursor"],
#   "lastInstall": "2025-10-02T...",
#   "paths": {
#     "claude": "/Users/you/.claude/commands/p",
#     "cursor": "/Users/you/.cursor/commands/p"
#   }
# }
```

### Test Scenario 2: Fresh Install without Editors

**Setup**:
```bash
# Temporarily rename editor directories
mv ~/.claude ~/.claude_backup
mv ~/.cursor ~/.cursor_backup

# Uninstall prjct-cli
npm uninstall -g prjct-cli
rm -rf ~/.prjct-cli/config/
```

**Test**:
```bash
npm install -g prjct-cli@latest
```

**Expected Output**:
```
🔍 First-time installation detected...

ℹ️  No AI editors detected
   Run `prjct install` when you set up Claude Code, Cursor, or Windsurf
```

**Cleanup**:
```bash
# Restore editor directories
mv ~/.claude_backup ~/.claude
mv ~/.cursor_backup ~/.cursor
```

## Testing Version Updates

### Test Scenario 3: Update to New Version

**Setup**:
```bash
# Install previous version first
npm install -g prjct-cli@0.4.4

# Verify commands are installed
ls ~/.claude/commands/p/

# Note the version in tracking config
cat ~/.prjct-cli/config/installed-editors.json | grep version
```

**Test**:
```bash
# Update to latest version
npm update -g prjct-cli
# OR
npm install -g prjct-cli@latest
```

**Expected Output**:
```
🔄 Updating prjct commands in configured editors...

✅ Updated commands in: Claude Code, Cursor
   Commands updated: 18

✨ prjct-cli 0.4.4 is ready!
```

**Verification**:
```bash
# Check version was updated in config
cat ~/.prjct-cli/config/installed-editors.json | grep version
# Should show: "version": "0.4.4"

# Check command files were updated
cat ~/.claude/commands/p/help.md
# Should show the NEW help content (interactive guide)
# NOT the old "layered structure" message
```

### Test Scenario 4: Same Version Reinstall

**Setup**:
```bash
# Install version 0.4.3
npm install -g prjct-cli@0.4.4
```

**Test**:
```bash
# Reinstall same version
npm install -g prjct-cli@0.4.4
```

**Expected Output**:
```
(No output - post-install detects same version and skips update)
```

**Verification**:
```bash
# Config should still show 0.4.3
cat ~/.prjct-cli/config/installed-editors.json | grep version
```

## Testing Uninstallation

### Test Scenario 5: Clean Uninstall

**Setup**:
```bash
# Install prjct-cli
npm install -g prjct-cli@latest

# Verify commands exist
ls ~/.claude/commands/p/
ls ~/.cursor/commands/p/

# Verify tracking config exists
cat ~/.prjct-cli/config/installed-editors.json
```

**Test**:
```bash
npm uninstall -g prjct-cli
```

**Expected Output**:
```
🧹 Cleaning up prjct commands from AI editors...

✅ Removed from: Claude Code, Cursor

✨ prjct-cli uninstalled cleanly
```

**Verification**:
```bash
# Check commands were removed
ls ~/.claude/commands/p/
# Should NOT exist or be empty

ls ~/.cursor/commands/p/
# Should NOT exist or be empty

# Check tracking config was deleted
cat ~/.prjct-cli/config/installed-editors.json
# Should return: No such file or directory

# Verify package is uninstalled
prjct --version
# Should return: command not found
```

## Testing Edge Cases

### Test Scenario 6: Manual Command Installation

**Test manually installing to an editor not auto-detected**:

```bash
# After installing prjct-cli
npm install -g prjct-cli@latest

# Manually install to Windsurf
prjct install --editor windsurf

# Check that tracking was updated
cat ~/.prjct-cli/config/installed-editors.json
# Should now include "windsurf" in editors array

# Update package
npm update -g prjct-cli

# Verify Windsurf commands were also updated
ls ~/.windsurf/workflows/
# Should have updated p_*.md files
```

### Test Scenario 7: Partial Editor Installation

**Test when some editors are unavailable**:

```bash
# Remove Cursor but keep Claude
rm -rf ~/.cursor

# Update prjct-cli
npm update -g prjct-cli

# Expected: Claude commands update successfully
# Expected: Cursor update fails gracefully (editor not found)
# Expected: Overall operation succeeds
```

## Debugging

### Enable Debug Mode

```bash
# Set DEBUG environment variable
DEBUG=1 npm install -g prjct-cli
DEBUG=1 npm uninstall -g prjct-cli
```

### Check Tracking Config

```bash
# View current tracking config
cat ~/.prjct-cli/config/installed-editors.json | jq

# Expected structure:
{
  "version": "0.4.3",
  "editors": ["claude", "cursor"],
  "lastInstall": "2025-10-02T10:30:00.000Z",
  "paths": {
    "claude": "/Users/you/.claude/commands/p",
    "cursor": "/Users/you/.cursor/commands/p"
  }
}
```

### Verify Command Content

```bash
# Check if help.md has correct content
cat ~/.claude/commands/p/help.md

# Should start with:
# ---
# allowed-tools: [Read]
# description: "Interactive guide - talk naturally, no memorization needed"
# ---
#
# # /p:help
#
# ## Usage
# ```
# /p:help
# ```

# Should NOT contain old "layered structure" messages
```

## Common Issues

### Issue 1: Commands Not Updating

**Symptoms**: Old commands still present after update

**Diagnosis**:
```bash
# Check if tracking config exists
cat ~/.prjct-cli/config/installed-editors.json

# Check version in config
cat ~/.prjct-cli/config/installed-editors.json | grep version
```

**Fix**:
```bash
# Force reinstall
npm uninstall -g prjct-cli
rm -rf ~/.prjct-cli/config/
npm install -g prjct-cli@latest
```

### Issue 2: Commands Not Cleaned Up

**Symptoms**: Commands remain after uninstall

**Diagnosis**:
```bash
# Check if commands still exist
ls ~/.claude/commands/p/

# Check if tracking config was deleted
ls ~/.prjct-cli/config/
```

**Fix**:
```bash
# Manual cleanup
rm -rf ~/.claude/commands/p/
rm -rf ~/.cursor/commands/p/
rm -rf ~/.windsurf/workflows/p_*.md
rm -rf ~/.prjct-cli/config/
```

### Issue 3: No Auto-Installation on First Install

**Symptoms**: No installation message during first install

**Diagnosis**:
```bash
# Check if running as global install
npm list -g prjct-cli

# Check if editor directories exist
ls -la ~/.claude ~/.cursor ~/.windsurf
```

**Fix**:
```bash
# Manually run install command
prjct install

# Or force reinstall
npm uninstall -g prjct-cli
npm install -g prjct-cli@latest
```

## Testing Data Migration

### Test Scenario 8: Legacy Project Migration (v0.1.0 → v0.4.4)

**Setup**:
```bash
# Create a legacy v0.1.0 project structure
mkdir -p ~/Projects/test-legacy-project
cd ~/Projects/test-legacy-project

# Create old .prjct/ structure
mkdir -p .prjct
echo "# Current Task" > .prjct/now.md
echo "# Next Tasks" > .prjct/next.md
echo "# Shipped Features" > .prjct/shipped.md
echo "# Ideas" > .prjct/ideas.md
echo '{"timestamp":"2025-01-01","action":"test"}' > .prjct/memory.jsonl

# Verify legacy structure exists
ls -la .prjct/
```

**Test**:
```bash
# Update to v0.4.4 (from any previous version)
npm update -g prjct-cli
```

**Expected Output**:
```
🔄 Updating prjct commands in configured editors...

✅ Updated commands in: Claude Code, Cursor
   Commands updated: 18

🔍 Checking for legacy projects to migrate...

✅ Migrated 1 legacy project(s) to new structure
   Data location: ~/.prjct-cli/projects/

✨ prjct-cli 0.4.4 is ready!
```

**Verification**:
```bash
# Check global structure was created
ls ~/.prjct-cli/projects/

# Find project ID
cat ~/Projects/test-legacy-project/.prjct/prjct.config.json
# Should show:
# {
#   "projectId": "abc123...",
#   "dataPath": "~/.prjct-cli/projects/abc123..."
# }

# Verify data was migrated to global location
PROJECT_ID=$(jq -r .projectId ~/Projects/test-legacy-project/.prjct/prjct.config.json)
ls ~/.prjct-cli/projects/$PROJECT_ID/
# Should show: core/ progress/ planning/ analysis/ memory/

# Verify files were migrated correctly
cat ~/.prjct-cli/projects/$PROJECT_ID/core/now.md
cat ~/.prjct-cli/projects/$PROJECT_ID/progress/shipped.md
cat ~/.prjct-cli/projects/$PROJECT_ID/planning/ideas.md
cat ~/.prjct-cli/projects/$PROJECT_ID/memory/context.jsonl

# Verify legacy directories were cleaned up
ls ~/Projects/test-legacy-project/.prjct/
# Should show ONLY: prjct.config.json
# Old directories (now.md, shipped.md, etc.) should be gone
```

### Test Scenario 9: Multiple Legacy Projects

**Setup**:
```bash
# Create multiple legacy projects
for project in project-a project-b project-c; do
  mkdir -p ~/Projects/$project/.prjct
  echo "# Task for $project" > ~/Projects/$project/.prjct/now.md
  echo "# Shipped in $project" > ~/Projects/$project/.prjct/shipped.md
done
```

**Test**:
```bash
npm update -g prjct-cli
```

**Expected Output**:
```
🔍 Checking for legacy projects to migrate...

✅ Migrated 3 legacy project(s) to new structure
   Data location: ~/.prjct-cli/projects/
```

**Verification**:
```bash
# Check all projects were migrated
ls ~/.prjct-cli/projects/
# Should show 3 project directories

# Verify each has config
for project in project-a project-b project-c; do
  cat ~/Projects/$project/.prjct/prjct.config.json | jq .projectId
done
```

## Success Criteria

✅ **First Install**: Commands auto-install to detected editors
✅ **Updates**: Commands auto-update when version changes
✅ **Uninstall**: Commands auto-remove from all editors
✅ **Tracking**: Config file accurately tracks installations
✅ **Idempotent**: Multiple installs of same version don't break anything
✅ **Manual Install**: Tracking updates when using `prjct install`
✅ **Clean State**: No orphaned files after uninstall
✅ **Data Migration**: Legacy v0.1.0 projects automatically migrate to v0.4.4
✅ **Preserve Data**: All project data preserved during migration (no data loss)
✅ **Clean Migration**: Legacy directories cleaned while keeping config for compatibility
