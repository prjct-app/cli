---
allowed-tools: [Read, Write, Bash, Glob]
description: 'Migrate project to UUID format + sync'
---

# /p:migrate - UUID Migration

Migrate project ID to UUID format and run full sync.

## Context Variables

- `{projectId}`: Current ID from `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`

## Step 1: Read Configuration

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check UUID Format

UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (36 chars with dashes)

IF projectId matches UUID regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`:
  OUTPUT: "✅ Already UUID: {projectId}"
  GOTO: Step 7 (Run Sync)

IF projectId does NOT match UUID format:
  CONTINUE to Step 3

## Step 3: Generate New UUID

Generate new UUID using Node.js `crypto.randomUUID()`.

Store:
- `{oldId}` = current projectId
- `{newId}` = generated UUID

## Step 4: Show Migration Plan

OUTPUT:
```
📦 UUID Migration Plan

Current ID: {oldId} (non-UUID format)
New UUID:   {newId}

Actions:
1. Rename folder: ~/.prjct-cli/projects/{oldId}/ → ~/.prjct-cli/projects/{newId}/
2. Update .prjct/prjct.config.json
3. Update project.json
4. Run /p:sync

Continue? (yes/no)
```

WAIT for user confirmation.

## Step 5: Rename Global Folder

BASH:
```bash
mv ~/.prjct-cli/projects/{oldId} ~/.prjct-cli/projects/{newId}
```

IF error:
  OUTPUT: "❌ Failed to rename folder: {error}"
  STOP

## Step 6: Update Configuration Files

### Local Config (.prjct/prjct.config.json)

READ current config, UPDATE:
```json
{
  "projectId": "{newId}",
  "dataPath": "~/.prjct-cli/projects/{newId}"
}
```

WRITE back to `.prjct/prjct.config.json`

### Global Config (project.json)

READ: `~/.prjct-cli/projects/{newId}/project.json`
REPLACE all occurrences of `{oldId}` with `{newId}`
WRITE back

## Step 7: Run Sync

Execute `/p:sync` to:
- Analyze project
- Regenerate CLAUDE.md
- Update agents

## Output

**If migrated:**
```
✅ Migrated to UUID

Old ID: {oldId}
New ID: {newId}

Updated:
- Folder renamed
- Config updated
- Sync completed

Next: Continue working with /p:now
```

**If skipped (already UUID):**
```
✅ Already UUID: {projectId}

Sync completed.

Next: Continue working with /p:now
```

## Error Handling

| Error | Action |
|-------|--------|
| No config | "Run /p:init first" |
| Folder not found | "Global data missing - reinitialize" |
| Rename failed | Show error, abort |
| User cancels | STOP without changes |

## Notes

- Migration is idempotent: if already UUID, skips to sync
- UUIDs are standard format for PostgreSQL consistency
- Always runs sync after migration
