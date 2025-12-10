---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Quick idea capture'
timestamp-rule: 'GetTimestamp() and GetDate() for timestamps'
architecture: 'JSON-first - Write to data/ideas.json, views are generated'
---

# /p:idea - Quick Idea Capture

## Architecture: JSON-First

**Source of Truth**: `data/ideas.json`
**Generated View**: `views/ideas.md` (auto-generated)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{dataPath}`: `{globalPath}/data`
- `{ideasPath}`: `{dataPath}/ideas.json`
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
```json
{
  "ideas": [],
  "lastUpdated": ""
}
```

## Step 3: Add New Idea (JSON)

GENERATE: {ideaId} = "idea_" + 8 random alphanumeric chars
SET: {now} = GetTimestamp()

### Analyze idea for tags
Based on {text}, detect tags:
- If mentions UI/design → add "ui" tag
- If mentions performance → add "perf" tag
- If mentions bug/fix → add "bug" tag
- If mentions API/backend → add "api" tag

### Update ideas.json
```json
{
  "ideas": [
    {
      "id": "{ideaId}",
      "text": "{text}",
      "priority": "medium",
      "status": "pending",
      "tags": [{detected_tags}],
      "createdAt": "{now}"
    },
    ...existing ideas
  ],
  "lastUpdated": "{now}"
}
```

WRITE: `{ideasPath}`

## Step 4: Generate Views

BASH: `cd {projectRoot} && npx prjct-generate-views --project={projectId}`

## Step 5: Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"idea_added","ideaId":"{ideaId}","text":"{text}"}
```

## Response

`💡 {text} | Saved | Start: /p:feature "{text}"`