---
allowed-tools: [Read, Write, Bash]
description: 'Redo previously undone changes'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:redo - Redo Previously Undone Snapshot

## Overview
Restores a previously undone snapshot. Only works if you have recently used /p:undo.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{redoStackPath}`: `{snapshotDir}/redo-stack.json`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Redo Stack

READ: `{redoStackPath}`

IF file not found OR empty OR equals "[]":
  OUTPUT: "⚠️ Nothing to redo. Use /p:undo first."
  STOP

PARSE as JSON array
GET last item as {redoSnapshot}

IF array is empty:
  OUTPUT: "⚠️ Nothing to redo. Use /p:undo first."
  STOP

EXTRACT from {redoSnapshot}:
- `{redoHash}`: hash
- `{redoMessage}`: message
- `{redoTimestamp}`: timestamp

## Step 3: Get Current State

BASH: `cd {snapshotDir} && git rev-parse HEAD`
CAPTURE as {currentHash}

BASH: `cd {snapshotDir} && git log -1 --pretty=format:'%s' {currentHash}`
CAPTURE as {currentMessage}

## Step 4: Get Files That Will Change

BASH: `cd {snapshotDir} && git diff --name-only {currentHash} {redoHash}`
CAPTURE as {affectedFiles}

COUNT files as {fileCount}

## Step 5: Restore Redo Snapshot

### Checkout files from redo snapshot
BASH: `cd {snapshotDir} && git checkout {redoHash} -- .`

### Copy files back to project
For each file in {affectedFiles}:
  - Source: `{snapshotDir}/{file}`
  - Destination: `{projectPath}/{file}`
  - Copy content

## Step 6: Remove from Redo Stack

READ: `{redoStackPath}`
PARSE as JSON array
REMOVE last item
WRITE: `{redoStackPath}`

## Step 7: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{GetTimestamp()}","action":"snapshot_redo","from":"{currentHash}","to":"{redoHash}","files":{fileCount}}
```

## Step 8: Log to Manifest

APPEND to: `{snapshotDir}/manifest.jsonl`

Single line (JSONL):
```json
{"type":"redo","from":"{currentHash}","to":"{redoHash}","timestamp":"{GetTimestamp()}","files":{fileCount}}
```

## Output

SUCCESS:
```
⏩ Redone: {redoMessage}

Restored from: {currentMessage}
Files affected: {fileCount}

/p:undo to undo again | /p:history to see all snapshots
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No redo stack | "Nothing to redo" | STOP |
| Empty redo stack | "Nothing to redo" | STOP |
| Git error | Show error message | STOP |
| File copy fails | "Failed to restore {file}" | CONTINUE |

## Examples

### Example 1: Successful Redo
```
⏩ Redone: Ship authentication feature

Restored from: Add login form
Files affected: 5

/p:undo to undo again | /p:history to see all snapshots
```

### Example 2: Nothing to Redo
```
⚠️ Nothing to redo. Use /p:undo first.
```

## Notes

- Redo only works after /p:undo
- Creating a new snapshot clears the redo stack
- Multiple redos are possible if you undid multiple times
- Redo stack is project-specific
