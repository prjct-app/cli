---
allowed-tools: [Read, Write, Bash]
description: 'View snapshot history and undo/redo changes'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
---

# p. history - Snapshot History & Undo/Redo

**ARGUMENTS**: $ARGUMENTS

Unified command for viewing snapshot history and managing undo/redo operations.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{redoStackPath}`: `{snapshotDir}/redo-stack.json`
- `{limit}`: Number of snapshots to show (default: 10)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. history` | Show snapshot history (default) |
| `p. history undo` | Revert to previous snapshot |
| `p. history redo` | Redo previously undone changes |

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

SET: globalPath = ~/.prjct-cli/projects/{projectId}
SET: snapshotDir = {globalPath}/snapshots
```

---

## Step 2: Route by Subcommand

```
PARSE: $ARGUMENTS
SET: subcommand = first word (or empty for default)

ROUTE:
  - no args OR "list" → Show History (default)
  - "undo" → Execute Undo
  - "redo" → Execute Redo
```

---

## Subcommand: (default) - Show History

### Check Snapshots Exist

```bash
ls {snapshotDir}/.git 2>/dev/null || echo "NO_SNAPSHOTS"
```

IF output contains "NO_SNAPSHOTS":
  OUTPUT: "⚠️ No snapshots yet. Create one with `p. ship`."
  STOP

### Get Snapshot History

```bash
cd {snapshotDir} && git log --pretty=format:'%h|%s|%ar|%ai' -n {limit}
```

PARSE each line:
- `{shortHash}`: Before first `|`
- `{message}`: Between first and second `|`
- `{relativeTime}`: Between second and third `|`
- `{absoluteTime}`: After third `|`

### Get Current Position

```bash
cd {snapshotDir} && git rev-parse --short HEAD
```
CAPTURE as {currentHash}

### Check Redo Stack

READ: `{redoStackPath}`

IF file exists AND not empty AND not "[]":
  PARSE as JSON array
  COUNT items as {redoCount}
ELSE:
  {redoCount} = 0

### Output

```
📜 Snapshot History

| # | Hash    | Description                  | When        |
|---|---------|------------------------------|-------------|
{FOR EACH snapshot in history:}
| {index} | {shortHash} | {message}{IF shortHash == currentHash: " [← NOW]"} | {relativeTime} |
{END FOR}

Current: {currentHash}
Redo available: {redoCount} snapshot(s)

Commands:
• `p. history undo` - Revert to previous snapshot
• `p. history redo` - Redo if available ({redoCount})
• `p. ship` - Create new snapshot
```

---

## Subcommand: undo

Reverts the project to the previous snapshot state.

### Check Snapshot History

```bash
cd {snapshotDir} && git log --oneline -5 2>/dev/null || echo "NO_SNAPSHOTS"
```

IF output contains "NO_SNAPSHOTS" OR empty:
  OUTPUT: "No snapshots available. Create one with `p. ship` first."
  STOP

CAPTURE last two lines as:
- {currentHash}: First line (current snapshot)
- {previousHash}: Second line (snapshot to restore)

IF only one snapshot exists:
  OUTPUT: "Only one snapshot exists. Nothing to undo."
  STOP

### Get State Info

```bash
cd {snapshotDir} && git log -1 --pretty=format:'%s' {currentHash}
```
CAPTURE as {currentMessage}

```bash
cd {snapshotDir} && git log -1 --pretty=format:'%s' {previousHash}
```
CAPTURE as {previousMessage}

### Get Files That Will Change

```bash
cd {snapshotDir} && git diff --name-only {previousHash} {currentHash}
```
CAPTURE as {affectedFiles}
COUNT files as {fileCount}

### Save Current State to Redo Stack

READ: `{redoStackPath}` (create if not exists with `[]`)
PARSE as JSON array

ADD to array:
```json
{
  "hash": "{currentHash}",
  "message": "{currentMessage}",
  "timestamp": "{GetTimestamp()}"
}
```

WRITE: `{redoStackPath}`

### Restore Previous Snapshot

```bash
cd {snapshotDir} && git checkout {previousHash} -- .
```

Copy files back to project for each file in {affectedFiles}:
- Source: `{snapshotDir}/{file}`
- Destination: `{projectPath}/{file}`

### Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{GetTimestamp()}","action":"snapshot_undo","from":"{currentHash}","to":"{previousHash}","files":{fileCount}}
```

### Log to Manifest

APPEND to: `{snapshotDir}/manifest.jsonl`
```json
{"type":"undo","from":"{currentHash}","to":"{previousHash}","timestamp":"{GetTimestamp()}","files":{fileCount}}
```

### Output

```
⏪ Undone: {currentMessage}

Restored to: {previousMessage}
Files affected: {fileCount}

`p. history redo` to redo | `p. history` to see all snapshots
```

---

## Subcommand: redo

Restores a previously undone snapshot.

### Check Redo Stack

READ: `{redoStackPath}`

IF file not found OR empty OR equals "[]":
  OUTPUT: "Nothing to redo. Use `p. history undo` first."
  STOP

PARSE as JSON array
GET last item as {redoSnapshot}

IF array is empty:
  OUTPUT: "Nothing to redo. Use `p. history undo` first."
  STOP

EXTRACT from {redoSnapshot}:
- `{redoHash}`: hash
- `{redoMessage}`: message
- `{redoTimestamp}`: timestamp

### Get Current State

```bash
cd {snapshotDir} && git rev-parse HEAD
```
CAPTURE as {currentHash}

```bash
cd {snapshotDir} && git log -1 --pretty=format:'%s' {currentHash}
```
CAPTURE as {currentMessage}

### Get Files That Will Change

```bash
cd {snapshotDir} && git diff --name-only {currentHash} {redoHash}
```
CAPTURE as {affectedFiles}
COUNT files as {fileCount}

### Restore Redo Snapshot

```bash
cd {snapshotDir} && git checkout {redoHash} -- .
```

Copy files back to project for each file in {affectedFiles}:
- Source: `{snapshotDir}/{file}`
- Destination: `{projectPath}/{file}`

### Remove from Redo Stack

READ: `{redoStackPath}`
PARSE as JSON array
REMOVE last item
WRITE: `{redoStackPath}`

### Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{GetTimestamp()}","action":"snapshot_redo","from":"{currentHash}","to":"{redoHash}","files":{fileCount}}
```

### Log to Manifest

APPEND to: `{snapshotDir}/manifest.jsonl`
```json
{"type":"redo","from":"{currentHash}","to":"{redoHash}","timestamp":"{GetTimestamp()}","files":{fileCount}}
```

### Output

```
⏩ Redone: {redoMessage}

Restored from: {currentMessage}
Files affected: {fileCount}

`p. history undo` to undo again | `p. history` to see all snapshots
```

---

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No snapshots | Show empty state | STOP |
| Only one snapshot | "Nothing to undo" | STOP |
| Nothing to redo | "Use undo first" | STOP |
| Git error | Show error message | STOP |
| File copy fails | "Failed to restore {file}" | CONTINUE |

---

## Empty State

IF no snapshots:
```
📜 Snapshot History

No snapshots yet.

Create your first snapshot:
• `p. ship <feature>` - Ship a feature and create snapshot
```

---

## Examples

### Example 1: View History
```
p. history

📜 Snapshot History

| # | Hash    | Description                  | When        |
|---|---------|------------------------------|-------------|
| 1 | a1b2c3d | Ship user authentication     | 2 hours ago |
| 2 | e4f5g6h | Add login form               | 5 hours ago |
| 3 | i7j8k9l | Setup database models        | 1 day ago   |

Current: a1b2c3d
Redo available: 0 snapshot(s)
```

### Example 2: Undo
```
p. history undo

⏪ Undone: Ship user authentication

Restored to: Add login form
Files affected: 5

`p. history redo` to redo | `p. history` to see all snapshots
```

### Example 3: Redo
```
p. history redo

⏩ Redone: Ship user authentication

Restored from: Add login form
Files affected: 5

`p. history undo` to undo again | `p. history` to see all snapshots
```

---

## Notes

- History is non-destructive: current state is saved to redo stack before undo
- You can redo immediately after undoing
- Creating a new snapshot after undo clears the redo stack
- Multiple redos are possible if you undid multiple times
- Snapshots are project-specific, not global
