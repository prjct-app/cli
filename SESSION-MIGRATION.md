# Session-Based Architecture Migration Guide

## Overview

This guide helps migrate existing prjct projects to the new session-based architecture, which prevents performance issues with large files (4000+ tasks/day).

## Why Migrate?

**Before (Monolithic Files):**
```
❌ roadmap.md grows to MB size with 4000+ tasks
❌ shipped.md contains entire history (slow reads)
❌ ideas.md never purged (grows indefinitely)
❌ Constant read/write to same large files (slow)
❌ Risk of data loss on concurrent writes
```

**After (Session-Based):**
```
✅ Daily sessions (max 1 day of work per file)
✅ Indexes keep only last 30 days (lightweight)
✅ Auto-archive old data (organized by month)
✅ Fast queries (read only relevant sessions)
✅ Append-only JSONL (no overwrites, no data loss)
✅ Historical data preserved in archives
```

## Migration Steps

### 1. Backup Current Data

```bash
# Backup entire project directory
cp -r ~/.prjct-cli/projects/{your-id} ~/.prjct-cli/projects/{your-id}.backup
```

### 2. Create Session Directories

```bash
cd ~/.prjct-cli/projects/{your-id}

# Create session directories
mkdir -p planning/sessions/$(date +%Y-%m)
mkdir -p planning/archive
mkdir -p progress/sessions/$(date +%Y-%m)
mkdir -p progress/archive
mkdir -p memory/sessions/$(date +%Y-%m)
```

### 3. Migrate Roadmap

#### Convert roadmap.md to session format

```bash
# Read current roadmap.md
cat planning/roadmap.md

# Create initial session file (today)
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"migration","source":"roadmap.md","features_migrated":10}' >> planning/sessions/$(date +%Y-%m)/$(date +%Y-%m-%d).jsonl

# For each feature in roadmap.md, create session entry
# Example:
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"feature_add","name":"Authentication","tasks":5,"impact":"high","effort":"6h","status":"queued"}' >> planning/sessions/$(date +%Y-%m)/$(date +%Y-%m-%d).jsonl
```

#### Create lightweight index

Extract only ACTIVE features (queued/in-progress) from roadmap.md and create new lightweight index:

```markdown
# Active Roadmap (Last 30 days)

## In Progress (2)
- [ ] Authentication (5 tasks, 2 complete) - Added 2025-10-01
- [ ] Dashboard UI (3 tasks, 0 complete) - Added 2025-10-03

## Queued (3)
- [ ] Email notifications - Added 2025-10-04
- [ ] Export to PDF - Added 2025-10-04

Last updated: 2025-10-04
Archive: planning/archive/roadmap-2025-10.md
```

#### Archive old data

Move all completed/old features to archive:

```bash
# Move old roadmap data to archive
cp planning/roadmap.md planning/archive/roadmap-$(date +%Y-%m).md
```

### 4. Migrate Shipped Features

#### Convert shipped.md to sessions

```bash
# For each shipped feature, create session entry
# Example:
echo '{"ts":"2025-10-01T18:00:00Z","type":"feature_ship","name":"User login","tasks_done":4,"duration":"6h","agent":"be","version":"0.5.0"}' >> progress/sessions/2025-10/2025-10-01.jsonl
```

#### Create lightweight index (last 30 days only)

```markdown
# Recently Shipped (Last 30 days)

## 2025-10-04
- ✅ Authentication (6h, 5 tasks, v0.5.1)
- ✅ User profile (2h, 3 tasks, v0.5.0)

## 2025-10-03
- ✅ Login flow (4h, 4 tasks, v0.4.9)

Archive: progress/archive/shipped-2025-10.md
```

#### Archive old ships

```bash
# Move all shipped features to archive
cp progress/shipped.md progress/archive/shipped-$(date +%Y-%m).md
```

### 5. Migrate Ideas

```bash
# For each idea, create session entry
echo '{"ts":"2025-09-28T10:00:00Z","type":"idea_add","idea":"Add dark mode","actionable":true,"priority":"medium"}' >> planning/sessions/2025-09/2025-09-28.jsonl
```

Keep only last 30 days in ideas.md, archive the rest.

### 6. Verify Migration

Check that all files are in place:

```bash
tree ~/.prjct-cli/projects/{your-id}
```

Expected structure:

```
~/.prjct-cli/projects/{id}/
├── planning/
│   ├── roadmap.md              ✓ Lightweight (only last 30 days)
│   ├── ideas.md                ✓ Lightweight (only last 30 days)
│   ├── sessions/
│   │   └── 2025-10/
│   │       ├── 2025-10-01.jsonl   ✓ Daily session
│   │       ├── 2025-10-02.jsonl
│   │       └── 2025-10-04.jsonl
│   └── archive/
│       ├── roadmap-2025-10.md     ✓ Full history
│       └── ideas-2025-09.md
├── progress/
│   ├── shipped.md              ✓ Last 30 days only
│   ├── sessions/
│   │   └── 2025-10/
│   │       ├── 2025-10-01.jsonl
│   │       └── 2025-10-04.jsonl
│   └── archive/
│       └── shipped-2025-10.md     ✓ Full history
└── memory/
    ├── context.jsonl           ✓ Keep as-is
    └── sessions/
        └── 2025-10/
            └── 2025-10-04.jsonl
```

## Session File Format

### Planning Session (planning/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl)

```jsonl
{"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"auth","tasks":5,"impact":"high","effort":"6h","status":"queued"}
{"ts":"2025-10-04T16:00:00Z","type":"idea_add","idea":"dark mode","actionable":true,"priority":"medium"}
{"ts":"2025-10-04T17:00:00Z","type":"roadmap_update","feature":"auth","status":"in_progress"}
```

### Progress Session (progress/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl)

```jsonl
{"ts":"2025-10-04T15:00:00Z","type":"task_start","task":"JWT middleware","agent":"be","estimate":"2h"}
{"ts":"2025-10-04T17:15:00Z","type":"task_complete","task":"JWT middleware","duration":"2h15m"}
{"ts":"2025-10-04T18:00:00Z","type":"feature_ship","name":"auth","tasks_done":5,"duration":"6h","agent":"be","version":"0.5.1"}
```

## Querying Sessions

### Get all ships from last week

```javascript
const weekSessions = await readSessions('progress/sessions', -7, 'now')
const ships = weekSessions.filter(s => s.type === 'feature_ship')
```

### Get features added in October

```javascript
const octSessions = await readSessions('planning/sessions/2025-10')
const features = octSessions.filter(s => s.type === 'feature_add')
```

### Get complete roadmap history

```javascript
// Read current index
const current = await read('planning/roadmap.md')

// Read all archives
const archives = await glob('planning/archive/roadmap-*.md')
const fullHistory = [...current, ...archives]
```

## Automatic Archive

After migration, new commands will automatically:

1. Append to today's session file
2. Update lightweight index (last 30 days)
3. Archive entries > 30 days old

**No manual intervention needed after migration.**

## Rollback (if needed)

```bash
# Restore backup
rm -rf ~/.prjct-cli/projects/{your-id}
mv ~/.prjct-cli/projects/{your-id}.backup ~/.prjct-cli/projects/{your-id}
```

## Benefits After Migration

✅ **Performance**: Commands read only today's session + lightweight index
✅ **Scalability**: 4000 tasks/day → manageable daily files
✅ **Data Safety**: Append-only JSONL → no overwrites
✅ **History**: Complete history preserved in archives
✅ **Queries**: Flexible date-range queries on sessions
✅ **Backup**: Easy to sync/backup (organized by date)

## Need Help?

If migration seems complex, the system will automatically migrate on next command execution. Your data is safe - backups are created before any migration.
