---
allowed-tools: [Read, Write, Bash]
description: 'Migrate all projects to UUID format'
---

# /p:migrate-all

Migrate all projects to UUID format.

## Usage

```
/p:migrate-all [--deep-scan] [--dry-run]
```

## What It Does

1. **Scans global storage** → Lists all projects in `~/.prjct-cli/projects/`
2. **Checks UUID format** → Identifies projects with non-UUID IDs
3. **Migrates each project** → Renames folders and updates configs to UUID
4. **Reports summary** → Shows migrated, skipped, failed counts

## Options

- `--deep-scan`: Also scan for projects in common locations
- `--dry-run`: Show what would be migrated without making changes

## Migration Flow

For each project:

1. Read `project.json` to get current ID
2. Check if ID is already UUID format
3. If not UUID:
   - Generate new UUID
   - Rename folder to new UUID
   - Update `project.json`
   - Find and update linked `.prjct/prjct.config.json`

## UUID Format

Standard UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (36 chars)
Example: `550e8400-e29b-41d4-a716-446655440000`

## Before → After

**Before**:
```
~/.prjct-cli/projects/
  3a5667a5dedb/    # Hash-based ID
  abc12345/        # Short ID
```

**After**:
```
~/.prjct-cli/projects/
  550e8400-e29b-41d4-a716-446655440000/  # UUID
  7c9e6679-7425-40de-944b-e07fc1f90ae7/  # UUID
```

## Safety

- **Idempotent**: Safe to run multiple times (skips UUIDs)
- **Non-destructive**: Renames, doesn't delete
- **Dry run**: Test with `--dry-run` first

## Requirements

- Write permissions to `~/.prjct-cli/`
- Projects must have valid `project.json`

## Output

```
📦 UUID Migration

Scanning ~/.prjct-cli/projects/...

Found 5 projects:
- 3a5667a5dedb: Needs migration
- abc12345: Needs migration
- 550e8400-e29b-...: Already UUID ✓
- def67890: Needs migration
- 7c9e6679-7425-...: Already UUID ✓

Migrating 3 projects...

✅ 3a5667a5dedb → 9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d
✅ abc12345 → 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d
✅ def67890 → 2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e

Summary:
- Migrated: 3
- Skipped (already UUID): 2
- Failed: 0
```
