---
allowed-tools: [Read, Bash, Write]
description: 'Bidirectional sync between prjct and Notion'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:notion sync - Bidirectional Sync

## Purpose

Full bidirectional sync between prjct and Notion:
- **Pull**: Get new items created in Notion → prjct
- **Push**: Sync local items → Notion
- **Merge**: Update existing items with latest data

Uses "last edit wins" conflict resolution via `lastSyncedAt` timestamps.

## Prerequisites

1. Notion integration configured (`/p:notion setup`)
2. Token stored in `~/.prjct-cli/config/notion.json`
3. Databases have `prjctId` and `Last Updated` columns

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{token}`: From `~/.prjct-cli/config/notion.json`

## Flow

### Step 1: Check Configuration

READ: `.prjct/prjct.config.json` → extract `projectId`
READ: `{globalPath}/project.json`

IF `integrations.notion.enabled !== true`:
  OUTPUT: "Notion not configured. Run /p:notion setup first."
  STOP

### Step 2: Load Token

READ: `~/.prjct-cli/config/notion.json` → extract `token`

IF no token:
  OUTPUT: "Notion token not found. Run /p:notion setup first."
  STOP

### Step 3: Load Local Data

READ: `{globalPath}/storage/shipped.json`
READ: `{globalPath}/storage/ideas.json`

SET: {localShipped} = shipped.shipped array
SET: {localIdeas} = ideas.ideas array

### Step 4: Initialize Notion Client

```typescript
import { notionClient } from '../core/integrations/notion/client'
import { bidirectionalSync } from '../core/integrations/notion/sync'

notionClient.initialize(config.integrations.notion, token)
```

### Step 5: Execute Bidirectional Sync

```typescript
const results = await bidirectionalSync(
  projectId,
  config.integrations.notion,
  {
    shipped: localShipped,
    ideas: localIdeas
  }
)
```

### Step 6: Merge Pull Results with Local Data

For shipped features:
```typescript
// Merge pulled items with local
const mergedShipped = [...localShipped]

for (const pulled of results.pulled.shipped.items) {
  const existingIndex = mergedShipped.findIndex(
    f => f.id === pulled.id || f.notionPageId === pulled.notionPageId
  )

  if (existingIndex >= 0) {
    // Update existing
    mergedShipped[existingIndex] = pulled
  } else {
    // Add new
    mergedShipped.push(pulled)
  }
}
```

Same logic for ideas.

### Step 7: Write Updated Data

WRITE: `{globalPath}/storage/shipped.json`
```json
{
  "shipped": {mergedShipped},
  "lastUpdated": "{GetTimestamp()}"
}
```

WRITE: `{globalPath}/storage/ideas.json`
```json
{
  "ideas": {mergedIdeas},
  "lastUpdated": "{GetTimestamp()}"
}
```

### Step 8: Regenerate Context

After updating storage, regenerate markdown context:

WRITE: `{globalPath}/context/shipped.md` (from shipped.json)
WRITE: `{globalPath}/context/ideas.md` (from ideas.json)

### Step 9: Log to Memory

APPEND to: `{globalPath}/memory/events.jsonl`
```json
{"timestamp":"{GetTimestamp()}","action":"notion_sync","pulled":{"shipped":{shippedPulled},"ideas":{ideasPulled}},"pushed":{"shipped":{shippedPushed},"ideas":{ideasPushed}}}
```

## Response (Success)

```
Notion Sync Complete

Pulled from Notion:
- Shipped: {newShipped} new, {updatedShipped} updated
- Ideas: {newIdeas} new, {updatedIdeas} updated

Pushed to Notion:
- Shipped: {pushedShipped} features
- Ideas: {pushedIdeas} ideas

Local storage updated.
```

## Response (No Changes)

```
Notion Sync Complete

Already in sync - no changes detected.
```

## Response (Errors)

```
Notion Sync Complete (with warnings)

Pulled: 5 shipped, 2 ideas
Pushed: 3 features

Errors:
- {error1}
- {error2}
```

## Database Field Mapping

### Shipped Features

| prjct Field | Notion Property | Type |
|-------------|-----------------|------|
| id | prjctId | rich_text |
| name | Name | title |
| version | Version | rich_text |
| shippedAt | Shipped Date | date |
| type | Type | select |
| description | Description | rich_text |
| duration | Duration | rich_text |
| codeMetrics.linesAdded | Lines Added | number |
| codeMetrics.linesRemoved | Lines Removed | number |
| codeMetrics.filesChanged | Files Changed | number |
| commit.hash | Commit | rich_text |
| (calculated) | Impact | select |
| (auto) | Last Updated | date |

### Ideas

| prjct Field | Notion Property | Type |
|-------------|-----------------|------|
| id | prjctId | rich_text |
| text | Idea | title |
| status | Status | status |
| priority | Priority | select |
| tags | Tags | multi_select |
| addedAt | Created | date |
| details | Details | rich_text |
| impactEffort.impact | Impact | select |
| impactEffort.effort | Effort | select |
| convertedTo | Converted To | rich_text |
| (auto) | Last Updated | date |

## Conflict Resolution

**Strategy: Last Edit Wins**

When the same item exists in both Notion and prjct:
1. Compare `lastSyncedAt` (prjct) with `Last Updated` (Notion)
2. Most recent timestamp wins
3. Update both sides to match

**Matching Logic:**
1. First match by `prjctId` ↔ `id`
2. If no prjctId, match by `notionPageId` ↔ Notion page ID
3. If neither, treat as new item

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| Not configured | "Run /p:notion setup first" | STOP |
| Token invalid | "Token expired. Re-run setup" | STOP |
| API rate limit | "Rate limited. Retry in 1 min" | WARN |
| Parse error | Log warning | CONTINUE |
| Network error | "Connection failed" | STOP |

## Examples

### Example 1: First Sync (Push Only)
```
/p:notion sync

Output:
Notion Sync Complete

Pulled from Notion:
- Shipped: 0 new, 0 updated
- Ideas: 0 new, 0 updated

Pushed to Notion:
- Shipped: 11 features
- Ideas: 3 ideas

Local storage updated.
```

### Example 2: New Ideas from Notion
```
/p:notion sync

Output:
Notion Sync Complete

Pulled from Notion:
- Shipped: 0 new, 0 updated
- Ideas: 2 new, 0 updated

Pushed to Notion:
- Shipped: 0 features
- Ideas: 0 ideas

Local storage updated.

New ideas added:
- "Add dark mode toggle"
- "Improve error messages"
```

### Example 3: Bidirectional Changes
```
/p:notion sync

Output:
Notion Sync Complete

Pulled from Notion:
- Shipped: 1 new, 2 updated
- Ideas: 3 new, 1 updated

Pushed to Notion:
- Shipped: 2 features
- Ideas: 1 idea

Local storage updated.
```
