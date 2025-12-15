---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Quick idea capture'
timestamp-rule: 'GetTimestamp() and GetDate() for timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/ideas.json'
claude-context: 'context/ideas.md'
backend-sync: 'sync/pending.json'
---

# /p:idea - Quick Idea Capture

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/ideas.json`
**Claude Context**: `context/ideas.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{ideasStoragePath}`: `{globalPath}/storage/ideas.json`
- `{ideasContextPath}`: `{globalPath}/context/ideas.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{text}`: User-provided idea text

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Analyze Idea

Based on {text}, detect:

### Priority Detection
- If mentions "urgent", "critical", "asap" → priority = "high"
- If mentions "later", "maybe", "nice to have" → priority = "low"
- Default → priority = "medium"

### Tag Detection
- If mentions UI/design → add `#ui` tag
- If mentions performance → add `#perf` tag
- If mentions bug/fix → add `#bug` tag
- If mentions API/backend → add `#api` tag
- If mentions security → add `#security` tag
- If mentions docs → add `#docs` tag

## Step 3: Update Storage (SOURCE OF TRUTH)

GENERATE: {ideaId} = UUID v4
SET: {now} = GetTimestamp()

### Read existing ideas
READ: `{ideasStoragePath}` or create default:
```json
{
  "ideas": [],
  "lastUpdated": null
}
```

### Create idea object
```json
{
  "id": "{ideaId}",
  "text": "{text}",
  "priority": "{priority}",
  "tags": ["{detected_tags}"],
  "status": "pending",
  "createdAt": "{now}"
}
```

### Update ideas.json
PREPEND new idea to ideas array
SET: lastUpdated = {now}
WRITE: `{ideasStoragePath}`

## Step 4: Generate Context (FOR CLAUDE)

WRITE: `{ideasContextPath}`

```markdown
# IDEAS

## Pending

{FOR EACH idea in ideas WHERE status == "pending":}
- **{idea.text}** {idea.tags.join(' ')}
  - Priority: {idea.priority}
  - Added: {idea.createdAt}
{END FOR}

## Converted

{FOR EACH idea in ideas WHERE status == "converted":}
- ~~{idea.text}~~ → Feature: {idea.convertedTo}
{END FOR}
```

## Step 5: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "idea.created",
  "path": ["ideas"],
  "data": {
    "ideaId": "{ideaId}",
    "text": "{text}",
    "priority": "{priority}",
    "tags": ["{detected_tags}"]
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 6: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"idea_added","ideaId":"{ideaId}","text":"{text}","priority":"{priority}"}
```

## Response

`💡 {text} | Saved | Start: /p:feature "{text}"`

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No text | "What's your idea?" | ASK |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Simple Idea
**Input:** `/p:idea add dark mode support`

**Output:**
```
💡 add dark mode support | Saved | Start: /p:feature "add dark mode support"
```

### Example 2: Idea with Priority
**Input:** `/p:idea urgent fix login bug`

**Output:**
```
💡 urgent fix login bug [high] | Saved | Start: /p:feature "fix login bug"
```

### Example 3: Idea with Tags
**Input:** `/p:idea improve API performance`

**Output:**
```
💡 improve API performance #api #perf | Saved
```
