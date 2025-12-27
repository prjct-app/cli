---
allowed-tools: [Read, Write, Bash, WebFetch]
description: 'Setup Notion integration for prjct dashboards'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:notion setup - Connect Notion Integration

## Purpose

Connect prjct with Notion to sync:
- Shipped features (auto on /p:ship)
- Ideas (auto on /p:idea)
- Roadmap and tasks

## Prerequisites

1. Notion account with workspace access
2. Permission to create integrations

## Setup Flow

### Step 1: Check Existing Config

Read `~/.prjct-cli/projects/{projectId}/project.json`

If `integrations.notion.enabled === true`:
```
Notion already configured for workspace "{workspaceName}".

Databases:
• Shipped Features: {databases.shipped ? '✓' : '✗'}
• Roadmap: {databases.roadmap ? '✓' : '✗'}
• Ideas: {databases.ideas ? '✓' : '✗'}
• Tasks: {databases.tasks ? '✓' : '✗'}

Use /p:notion sync to resync all data.
```

### Step 2: Guide Integration Setup

```
Notion Integration Setup

To connect prjct with Notion, you'll need to:

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "prjct-cli" and select your workspace
4. Click "Submit" to create the integration
5. Copy the "Internal Integration Secret" (starts with ntn_)

Do you have your API token ready? (paste token or 'cancel')
```

### Step 3: Validate Token

Test connection to Notion API:
- Endpoint: `https://api.notion.com/v1/users/me`
- Header: `Authorization: Bearer {token}`
- Header: `Notion-Version: 2022-06-28`

If valid:
```
Connected to workspace: "{workspaceName}"
```

If invalid:
```
Could not connect to Notion. Please check your token.
Ensure the token starts with "ntn_" or "secret_".
```

### Step 4: Get Parent Page

```
Now share a Notion page with your integration:

1. Create a new page in Notion named "prjct: {projectName}"
2. Click "..." → "Connect to" → select "prjct-cli"
3. Copy the page URL or ID

Paste the page URL or ID:
```

Parse page ID from URL:
- `https://notion.so/workspace/Page-Title-abc123...` → `abc123...`
- Just the 32-character ID is also valid

### Step 5: Create Project Databases

Create 4 databases + 1 dashboard under the parent page.
Each project gets its own set of databases (not shared).

| Created | Name | Description |
|---------|------|-------------|
| Dashboard | {projectName}: Dashboard | Metrics + links to all DBs |
| Database | {projectName}: Shipped Features | Track shipped features with metrics |
| Database | {projectName}: Roadmap | Feature planning and progress |
| Database | {projectName}: Ideas | Captured ideas and status |
| Database | {projectName}: Active Tasks | Current task queue |

The dashboard shows:
- Total features shipped
- Ideas pendientes
- Tareas activas
- Progreso del roadmap
- Links a cada database

### Step 6: Save Config

Update `project.json`:

```json
{
  "integrations": {
    "notion": {
      "enabled": true,
      "workspaceName": "{workspace}",
      "databases": {
        "shipped": "{shippedDbId}",
        "roadmap": "{roadmapDbId}",
        "ideas": "{ideasDbId}",
        "tasks": "{tasksDbId}"
      },
      "dashboardPageId": "{dashboardId}",
      "syncOn": {
        "ship": true,
        "idea": true,
        "done": false
      },
      "setupAt": "{GetTimestamp()}"
    }
  }
}
```

### Step 7: Store Token

Save token securely (NOT in project files):

```bash
# Add to shell profile
export NOTION_TOKEN="ntn_..."
```

Or create `~/.prjct-cli/config/notion.json`:
```json
{
  "token": "ntn_..."
}
```

## Response (Success)

```
✅ Notion Connected

Workspace: {workspaceName}
Project: {projectName}
Created: 1 dashboard + 4 databases

• {projectName}: Dashboard (with metrics)
• {projectName}: Shipped Features
• {projectName}: Roadmap
• {projectName}: Ideas
• {projectName}: Active Tasks

Auto-sync enabled:
• On /p:ship → Shipped Features + Dashboard metrics
• On /p:idea → Ideas + Dashboard metrics

To sync all existing data: /p:notion sync
```

## Response (Cancel)

```
Notion setup cancelled.

You can run /p:notion setup anytime to connect.
```

## Additional Commands

| Command | Description |
|---------|-------------|
| `/p:notion status` | Show connection status |
| `/p:notion sync` | Full sync of all data |
| `/p:notion disconnect` | Remove integration |

## Error Handling

| Error | Response |
|-------|----------|
| Invalid token | "Token invalid. Must start with ntn_ or secret_" |
| Page not shared | "Page not accessible. Share it with the integration first." |
| Rate limit | "Notion rate limit reached. Try again in a minute." |
| Network error | "Could not connect to Notion. Check internet connection." |
