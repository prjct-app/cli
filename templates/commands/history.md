---
allowed-tools: [Read, Bash]
description: 'View snapshot history for undo/redo'
timestamp-rule: 'None required - read-only command'
---

# /p:history - View Snapshot History

## Overview
Displays the history of snapshots for the current project. Shows what can be undone/redone.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{limit}`: Number of snapshots to show (default: 10)

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Snapshots Exist

BASH: `ls ~/.prjct-cli/projects/{projectId}/snapshots/.git 2>/dev/null || echo "NO_SNAPSHOTS"`

IF output contains "NO_SNAPSHOTS":
  OUTPUT: "⚠️ No snapshots yet. Create one with /p:ship."
  STOP

## Step 3: Get Snapshot History

BASH: `cd {snapshotDir} && git log --pretty=format:'%h|%s|%ar|%ai' -n {limit}`

CAPTURE output and parse each line:
- `{shortHash}`: Before first `|`
- `{message}`: Between first and second `|`
- `{relativeTime}`: Between second and third `|`
- `{absoluteTime}`: After third `|`

## Step 4: Get Current Position

BASH: `cd {snapshotDir} && git rev-parse --short HEAD`
CAPTURE as {currentHash}

## Step 5: Check Redo Stack

READ: `{snapshotDir}/redo-stack.json`

IF file exists AND not empty AND not "[]":
  PARSE as JSON array
  COUNT items as {redoCount}
ELSE:
  {redoCount} = 0

## Step 6: Format Output

Build table with columns:
- `#`: Index (1, 2, 3...)
- `Hash`: Short hash
- `Description`: Commit message (first line)
- `When`: Relative time
- `Status`: "← current" for current, empty for others

### Table Format

```
# Snapshot History

| # | Hash    | Description                  | When       |
|---|---------|------------------------------|------------|
| 1 | abc1234 | Ship authentication [← NOW]  | 2 hours ago|
| 2 | def5678 | Add login form               | 5 hours ago|
| 3 | ghi9012 | Initial setup                | 1 day ago  |
```

## Output

SUCCESS:
```
📜 Snapshot History

| # | Hash    | Description                  | When        |
|---|---------|------------------------------|-------------|
{formattedTable}

Current: {currentHash}
Redo available: {redoCount} snapshot(s)

Commands:
• /p:undo - Revert to previous snapshot
• /p:redo - Redo if available ({redoCount})
• /p:ship - Create new snapshot
```

## Empty State

IF no snapshots:
```
📜 Snapshot History

No snapshots yet.

Create your first snapshot:
• /p:ship <feature> - Ship a feature and create snapshot
```

## Examples

### Example 1: Multiple Snapshots
```
📜 Snapshot History

| # | Hash    | Description                  | When        |
|---|---------|------------------------------|-------------|
| 1 | a1b2c3d | Ship user authentication     | 2 hours ago |
| 2 | e4f5g6h | Add login form               | 5 hours ago |
| 3 | i7j8k9l | Setup database models        | 1 day ago   |
| 4 | m0n1o2p | Initial project setup        | 2 days ago  |

Current: a1b2c3d
Redo available: 0 snapshot(s)

Commands:
• /p:undo - Revert to previous snapshot
• /p:redo - Redo if available (0)
• /p:ship - Create new snapshot
```

### Example 2: After Undo
```
📜 Snapshot History

| # | Hash    | Description                  | When        |
|---|---------|------------------------------|-------------|
| 1 | e4f5g6h | Add login form [← NOW]       | 5 hours ago |
| 2 | i7j8k9l | Setup database models        | 1 day ago   |
| 3 | m0n1o2p | Initial project setup        | 2 days ago  |

Current: e4f5g6h
Redo available: 1 snapshot(s)

Commands:
• /p:undo - Revert to previous snapshot
• /p:redo - Redo if available (1)
• /p:ship - Create new snapshot
```

### Example 3: No Snapshots
```
📜 Snapshot History

No snapshots yet.

Create your first snapshot:
• /p:ship <feature> - Ship a feature and create snapshot
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No snapshots | Show empty state | STOP |
| Git error | Show error message | STOP |

## Notes

- History is read-only, doesn't modify anything
- Shows relative times for quick scanning
- Indicates current position in history
- Shows redo availability count
