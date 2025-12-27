---
allowed-tools: [Read, Bash]
description: 'Push prjct data to Notion databases'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:notion push - Push Data to Notion

## Purpose

Manually sync all prjct data to Notion databases:
- Shipped features → Shipped Features database
- Ideas → Ideas database
- Queue tasks → Active Tasks database (optional)

## Prerequisites

1. Notion integration configured (`/p:notion setup`)
2. Token stored in `~/.prjct-cli/config/notion.json`

## Flow

### Step 1: Check Config

READ: `.prjct/prjct.config.json` → extract `projectId`
READ: `~/.prjct-cli/projects/{projectId}/project.json`

IF `integrations.notion.enabled !== true`:
  OUTPUT: "Notion not configured. Run /p:notion setup first."
  STOP

### Step 2: Load Token

READ: `~/.prjct-cli/config/notion.json` → extract `token`

IF no token:
  OUTPUT: "Notion token not found. Run /p:notion setup first."
  STOP

### Step 3: Load Data

READ: `~/.prjct-cli/projects/{projectId}/storage/shipped.json`
READ: `~/.prjct-cli/projects/{projectId}/storage/ideas.json`

### Step 4: Push to Notion

For each shipped feature:
```bash
curl -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer {token}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "database_id": "{databases.shipped}" },
    "properties": {
      "Name": { "title": [{ "text": { "content": "{feature.name}" } }] },
      "Project": { "select": { "name": "{projectName}" } },
      "Type": { "select": { "name": "{feature.type}" } },
      "Version": { "rich_text": [{ "text": { "content": "{feature.version}" } }] },
      "Shipped Date": { "date": { "start": "{feature.shippedAt}" } }
    }
  }'
```

For each idea:
```bash
curl -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer {token}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "database_id": "{databases.ideas}" },
    "properties": {
      "Name": { "title": [{ "text": { "content": "{idea.text}" } }] },
      "Project": { "select": { "name": "{projectName}" } },
      "Status": { "select": { "name": "{idea.status}" } },
      "Created": { "date": { "start": "{idea.addedAt}" } }
    }
  }'
```

### Step 5: Report Results

```
✅ Notion Push Complete

Shipped Features: {shipped.count} synced
Ideas: {ideas.count} synced

View in Notion: {dashboardUrl}
```

## Response (Success)

```
✅ Notion Push Complete

📦 Shipped: 11 features synced
💡 Ideas: 1 idea synced

Dashboard: https://notion.so/...
```

## Response (No Data)

```
Nothing to push. Add features or ideas first.
```

## Error Handling

| Error | Response |
|-------|----------|
| Not configured | "Run /p:notion setup first" |
| Token invalid | "Token expired. Run /p:notion setup again" |
| API error | Show error, suggest retry |
