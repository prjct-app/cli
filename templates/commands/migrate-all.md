---
allowed-tools: [Read, Write, Bash]
description: 'Migrate all legacy projects to global storage architecture'
---

# /p:migrate-all

## Usage

```
/p:migrate-all [--deep-scan] [--remove-legacy] [--dry-run]
```

## What It Does

1. **Scans global storage** → Reads all project IDs from `~/.prjct-cli/projects/`
2. **Detects legacy structure** → Checks each project for old `.prjct/` directory
3. **Migrates each project** → Moves data from local `.prjct/` to global storage
4. **Cleanup (optional)** → Removes legacy `.prjct/` directories (with `--remove-legacy`)
5. **Reports summary** → Shows migrated, skipped, failed counts

## Options

- `--deep-scan`: Scan entire file system (slow but thorough)
- `--remove-legacy`: Delete old `.prjct/` after successful migration
- `--dry-run`: Show what would be migrated without making changes

## When to Use

- After major version updates (architecture changes)
- Upgrading from v0.7.x to v0.8.x (new global storage)
- Troubleshooting projects not working after update

## Migration: Before → After

**Before (Legacy)**:
```
your-project/.prjct/     # All data locally
  core/, planning/, progress/, memory/, analysis/
```

**After (Global)**:
```
your-project/.prjct/
  prjct.config.json      # Minimal (projectId + dataPath only)

~/.prjct-cli/projects/{id}/
  core/, planning/, progress/, memory/, analysis/, agents/
```

## Safety

- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Original files only removed with `--remove-legacy`
- **Dry run**: Test with `--dry-run` first
- **Automatic backup**: Legacy data preserved until explicitly removed

## Requirements

- Write permissions to `~/.prjct-cli/` and project directories
- Projects must have valid global config in `project.json`
