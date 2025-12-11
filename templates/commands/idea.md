---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Quick idea capture'
timestamp-rule: 'GetTimestamp() and GetDate() for timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:idea - Quick Idea Capture

## Architecture: MD-First

**Source of Truth**: `planning/ideas.md`

MD files are the source of truth. Write directly to MD files.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{ideasPath}`: `{globalPath}/planning/ideas.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{text}`: User-provided idea text

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Read Current Ideas

READ: `{ideasPath}` (or create default if not exists)

Default structure:
```markdown
# Ideas

## Pending

_No ideas yet_

## Implemented

_Nothing implemented yet_
```

## Step 3: Add New Idea (MD)

GENERATE: {ideaId} = "idea_" + 8 random alphanumeric chars
SET: {now} = GetTimestamp()

### Analyze idea for tags
Based on {text}, detect tags:
- If mentions UI/design → add `#ui` tag
- If mentions performance → add `#perf` tag
- If mentions bug/fix → add `#bug` tag
- If mentions API/backend → add `#api` tag

### Update ideas.md

Parse existing content and add new idea under "## Pending" section:

```markdown
# Ideas

## Pending

- **{text}** #{detected_tags}
  - ID: {ideaId}
  - Added: {now}

{...existing pending ideas}

## Implemented

{...existing implemented ideas}
```

WRITE: `{ideasPath}`

## Step 4: Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"idea_added","ideaId":"{ideaId}","text":"{text}"}
```

## Response

`💡 {text} | Saved | Start: /p:feature "{text}"`
