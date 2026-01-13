---
allowed-tools: [Read, Write, Bash]
description: 'Initialize prjct'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
---

# /p:init - Initialize Project

## Architecture: Write-Through Pattern

Creates the full storage structure for a new project.

## Context Variables
- `{projectId}`: Generated UUID (standard format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{cwd}`: Current working directory (repository path)

## Project ID Format

**CRITICAL**: Project IDs MUST be standard UUIDs for PostgreSQL consistency.

```
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Example: 550e8400-e29b-41d4-a716-446655440000
```

Generate using: `crypto.randomUUID()`

## Flow

1. **Check existing**: Read `.prjct/prjct.config.json`
2. **Generate UUID**: Use `crypto.randomUUID()`
3. **Create directories**: storage/, context/, sync/, agents/, memory/
4. **Create config files**: local + global
5. **Analyze project**: Detect stack, dependencies
6. **Generate agents**: Based on detected stack

## Directory Structure

```
~/.prjct-cli/projects/{projectId}/
├── storage/                  # Source of Truth (JSON)
│   ├── state.json           # Current + paused task
│   ├── queue.json           # Task queue
│   ├── ideas.json           # Ideas list
│   └── shipped.json         # Shipped features
├── context/                  # For Claude (MD)
│   ├── CLAUDE.md            # Full context
│   ├── now.md               # Current task
│   ├── next.md              # Queue
│   ├── ideas.md             # Ideas
│   └── shipped.md           # Shipped
├── sync/                     # Backend Sync
│   └── pending.json         # Events queue
├── agents/                   # Specialists
├── memory/                   # Audit Trail
│   └── events.jsonl
├── progress/                 # Historical Data
│   └── sessions/{YYYY-MM}/
└── project.json             # Metadata
```

## Step: Create Storage Files

### storage/state.json
```json
{
  "currentTask": null,
  "pausedTask": null,
  "previousTask": null,
  "lastUpdated": null
}
```

### storage/queue.json
```json
{
  "tasks": [],
  "lastUpdated": null
}
```

### storage/ideas.json
```json
{
  "ideas": [],
  "lastUpdated": null
}
```

### storage/shipped.json
```json
{
  "shipped": [],
  "lastUpdated": null
}
```

### sync/pending.json
```json
[]
```

## Step: Create project.json (REQUIRED)

This file is the source of truth for the web dashboard.

### Determine Project Name
- Try package.json → `name` field
- Try Cargo.toml → `[package] name`
- Try pyproject.toml → `[project] name`
- Fallback to directory name

WRITE: `{globalPath}/project.json`

```json
{
  "projectId": "{projectId}",
  "repoPath": "{cwd}",
  "name": "{projectName}",
  "createdAt": "{GetTimestamp()}",
  "lastSync": "{GetTimestamp()}"
}
```

## Step: Create Local Config

WRITE: `.prjct/prjct.config.json`

```json
{
  "projectId": "{projectId}",
  "dataPath": "~/.prjct-cli/projects/{projectId}"
}
```

## Step: Install MCP Servers

Install required MCP servers by merging `templates/mcp-config.json` into `~/.claude/settings.json`.

```
READ: templates/mcp-config.json
READ: ~/.claude/settings.json (if exists)
MERGE: mcpServers (don't overwrite existing)
WRITE: ~/.claude/settings.json

Servers installed:
- context7: Library documentation lookup
- Atlassian: JIRA/Confluence (OAuth, SSO compatible)
```

## Step: Optional Integrations

After core setup, offer optional integrations.

### JIRA Integration (Optional)

Ask: "Would you like to connect with JIRA for issue tracking?"

If yes:
1. MCP server already installed (Atlassian)
2. Ask user to authenticate:
   - "Run `p. jira setup` after init completes"
   - First use will open browser for OAuth (SSO compatible)
3. Store config in `project.json`:

```json
{
  "integrations": {
    "jira": {
      "enabled": true,
      "provider": "jira",
      "authMode": "mcp"
    }
  }
}
```

If no: Skip (integration can be added later with `p. jira setup`).

### Linear Integration (Optional)

Ask: "Would you like to connect with Linear for issue tracking?"

If yes:
1. Ask for LINEAR_API_KEY (from https://linear.app/settings/api)
2. Run `p. linear setup` to complete configuration

## Response

```
✅ Initialized prjct

Project ID: {projectId}
Data Path: ~/.prjct-cli/projects/{projectId}/

Structure:
├── storage/    # JSON (source of truth)
├── context/    # MD (for Claude)
├── sync/       # Backend events
└── agents/     # Specialists

MCP Servers:
• context7: Library docs ✓
• Atlassian: JIRA/Confluence ✓

Integrations:
• JIRA: {enabled|disabled}
• Linear: {enabled|disabled}

Next:
• p. sync - Analyze project and generate agents
• p. jira setup - Configure JIRA project (if enabled)
• p. linear setup - Configure Linear (if enabled)
• p. task "{first_task}" - Start first task
• p. help - See all commands
```

## Error Handling

| Error | Response |
|-------|----------|
| Already initialized | Show existing projectId |
| Permission denied | Suggest chmod |
| Write fails | Show error |
