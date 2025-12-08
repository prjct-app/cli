---
allowed-tools: [Read, Write, Bash]
description: 'Undo last changes by restoring previous snapshot'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:undo - Revert to Previous Snapshot

## Overview
Reverts the project to the previous snapshot state. Uses Git-based snapshots stored in `~/.prjct-cli/projects/{projectId}/snapshots/`.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Snapshot History

BASH: `cd ~/.prjct-cli/projects/{projectId}/snapshots && git log --oneline -5 2>/dev/null || echo "NO_SNAPSHOTS"`

IF output contains "NO_SNAPSHOTS" OR empty:
  OUTPUT: "⚠️ No snapshots available. Create one with /p:ship first."
  STOP

CAPTURE last two lines as:
- {currentHash}: First line (current snapshot)
- {previousHash}: Second line (snapshot to restore)

IF only one snapshot exists:
  OUTPUT: "⚠️ Only one snapshot exists. Nothing to undo."
  STOP

## Step 3: Get Current State Info

BASH: `cd ~/.prjct-cli/projects/{projectId}/snapshots && git log -1 --pretty=format:'%s' {currentHash}`
CAPTURE as {currentMessage}

BASH: `cd ~/.prjct-cli/projects/{projectId}/snapshots && git log -1 --pretty=format:'%s' {previousHash}`
CAPTURE as {previousMessage}

## Step 4: Get Files That Will Change

BASH: `cd ~/.prjct-cli/projects/{projectId}/snapshots && git diff --name-only {previousHash} {currentHash}`
CAPTURE as {affectedFiles}

COUNT files as {fileCount}

## Step 5: Save Current State to Redo Stack

Before undoing, save current state so we can redo later.

READ: `{snapshotDir}/redo-stack.json` (create if not exists with `[]`)
PARSE as JSON array

ADD to array:
```json
{
  "hash": "{currentHash}",
  "message": "{currentMessage}",
  "timestamp": "{GetTimestamp()}"
}
```

WRITE: `{snapshotDir}/redo-stack.json`

## Step 6: Restore Previous Snapshot

### Checkout files from previous snapshot
BASH: `cd ~/.prjct-cli/projects/{projectId}/snapshots && git checkout {previousHash} -- .`

### Copy files back to project
For each file in {affectedFiles}:
  - Source: `{snapshotDir}/{file}`
  - Destination: `{projectPath}/{file}`
  - Copy content

NOTE: Use the SnapshotManager.restore() method if available via Node.js, or copy files manually.

## Step 7: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{GetTimestamp()}","action":"snapshot_undo","from":"{currentHash}","to":"{previousHash}","files":{fileCount}}
```

## Step 8: Log to Manifest

APPEND to: `{snapshotDir}/manifest.jsonl`

Single line (JSONL):
```json
{"type":"undo","from":"{currentHash}","to":"{previousHash}","timestamp":"{GetTimestamp()}","files":{fileCount}}
```

## Output

SUCCESS:
```
⏪ Undone: {currentMessage}

Restored to: {previousMessage}
Files affected: {fileCount}

/p:redo to redo | /p:history to see all snapshots
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No snapshots | "No snapshots available" | STOP |
| Only one snapshot | "Nothing to undo" | STOP |
| Git error | Show error message | STOP |
| File copy fails | "Failed to restore {file}" | CONTINUE |

## Examples

### Example 1: Successful Undo
```
⏪ Undone: Ship authentication feature

Restored to: Add login form
Files affected: 5

/p:redo to redo | /p:history to see all snapshots
```

### Example 2: Nothing to Undo
```
⚠️ Only one snapshot exists. Nothing to undo.

Create more snapshots with /p:ship
```

## Notes

- Undo is non-destructive: current state is saved to redo stack
- You can redo immediately after undoing
- Creating a new snapshot after undo clears the redo stack
- Snapshots are project-specific, not global
