# /p:migrate-all - Migrate All Legacy Projects

Migrates all legacy prjct projects to the new global storage architecture.

## Usage

```
/p:migrate-all [--deep-scan] [--remove-legacy] [--dry-run]
```

## What This Command Does

1. **Scans Global Storage**
   - Reads all project IDs from `~/.prjct-cli/projects/`
   - Retrieves project paths from `project.json` files

2. **Detects Legacy Structure**
   - Checks each project for old `.prjct/` directory structure
   - Identifies projects that need migration

3. **Migrates Each Project**
   - Moves data from local `.prjct/` to global `~/.prjct-cli/projects/{id}/`
   - Creates new minimal local config (`.prjct/prjct.config.json`)
   - Preserves all project data and history

4. **Cleanup (Optional)**
   - Removes legacy `.prjct/` directories (with `--remove-legacy`)
   - Keeps only the new minimal config file

5. **Reports Summary**
   - Shows migrated, skipped, and failed projects
   - Lists detailed errors for any failures

## Options

- `--deep-scan`: Scan entire file system (slow but thorough)
- `--remove-legacy`: Delete old `.prjct/` directories after successful migration
- `--dry-run`: Show what would be migrated without making changes

## When to Use

- **After major version updates**: When architecture changes
- **Upgrading from v0.7.x to v0.8.x**: New global storage system
- **Consolidating projects**: Moving all projects to global storage
- **Troubleshooting**: If projects aren't working after update

## Migration Process

### Before (Legacy Structure)
```
your-project/
  .prjct/
    core/
    planning/
    progress/
    memory/
    analysis/
    prjct.config.json  # Full config
```

### After (Global Storage)
```
your-project/
  .prjct/
    prjct.config.json  # Minimal (projectId + dataPath only)

~/.prjct-cli/projects/3a5667a5dedb/
  core/
  planning/
  progress/
  memory/
  analysis/
  agents/
  project.json  # System config (authors, version, etc.)
```

## Output Example

```
🔄 Scanning for legacy prjct projects...

📁 Found 3 projects in global storage

🔄 Migrating: /Users/jj/Apps/my-app
   ✅ Migrated successfully

🔄 Migrating: /Users/jj/Apps/other-project
   ⏭️  Already migrated

📊 Migration Summary:
   ✅ Migrated: 1
   ⏭️  Skipped: 1
   ❌ Failed: 0
```

## Error Handling

- **No global storage**: Creates directory structure
- **Missing project paths**: Skips projects with invalid paths
- **Permission errors**: Reports which projects couldn't be migrated
- **Already migrated**: Safely skips without changes

## Safety

- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Original files only removed with `--remove-legacy`
- **Dry run available**: Test migration with `--dry-run` first
- **Automatic backup**: Legacy data preserved until explicitly removed

## Requirements

- Write permissions to `~/.prjct-cli/` and project directories
- Projects must have valid global config in `project.json`

## Notes

- This command does NOT require an initialized prjct project
- Migration is automatic on install (but manual execution is safer)
- Always test with `--dry-run` first for large migrations
- Can be safely interrupted and resumed
