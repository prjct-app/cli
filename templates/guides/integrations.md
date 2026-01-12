# Integrations Guide

Skills and MCP server integration for prjct agents.

---

## Skills Integration

### Overview

Skills are Claude Code extensions from `claude-plugins.dev` that provide domain expertise.

### How Skills Work

1. **Discovery** (`/p:sync`): Search marketplace, install matches
2. **Linking**: Agent frontmatter has `skills: [skill-name]`
3. **Invocation** (`/p:task`): Skills auto-invoked when agent loads

### Skill Flow

```
p. task @frontend add button
  ↓
Load frontend.md (skills: [frontend-design])
  ↓
Auto-invoke: Skill("frontend-design")
  ↓
Skill context active for design decisions
```

### Skill Location

- Installed: `~/.claude/skills/`
- Mapping: `{globalPath}/config/skills.json`

### Search Terms by Agent

| Agent | Search Terms |
|-------|-------------|
| frontend | "frontend-design", "react", "ui" |
| backend | "{ecosystem} backend", "api" |
| uxui | "ux-designer", "ui ux" |
| testing | "testing", "test patterns" |
| devops | "devops", "ci cd" |

---

## MCP Server Integration

### Overview

MCP (Model Context Protocol) servers provide external capabilities like documentation lookup.

### How MCP Works

1. **Configuration** (`/p:sync`): Analyze deps, configure servers
2. **Linking**: Agent frontmatter has `mcp: [server-name]`
3. **Usage** (`/p:task`): Agents auto-query MCP for docs

### MCP Flow

```
p. task @backend add API endpoint
  ↓
Load backend.md (mcp: [context7])
  ↓
Auto-query: context7 for Hono/Express docs
  ↓
Documentation context available
```

### Available Servers

| Server | Purpose | Tools |
|--------|---------|-------|
| context7 | Library docs | resolve-library-id, query-docs |

### Per-Project Configuration

Path: `{globalPath}/config/mcp-servers.json`

```json
{
  "servers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "enabled": true
    }
  },
  "agentMcpMap": {
    "frontend": ["context7"],
    "backend": ["context7"],
    "database": ["context7"]
  }
}
```

### Agent-MCP Guidelines

| Agent | Needs MCP? | Reason |
|-------|------------|--------|
| frontend | Yes | Component library docs |
| backend | Yes | Framework docs |
| database | Yes | ORM docs |
| devops | Rarely | Uses bash commands |
| prjct-* | Sometimes | Framework planning |

---

## Combined Pipeline

```
Task Input
    ↓
Load Agent (frontmatter)
    ├── skills: [skill1, skill2]
    └── mcp: [context7]
    ↓
Auto-Invoke Skills
    ↓
Auto-Query MCP Docs
    ↓
Execute with Full Context
```

---

## Configuration During Sync

### Skills Configuration

```
FOR EACH agent generated:
  1. Determine search terms
  2. Search claude-plugins.dev
  3. Install matching skills
  4. Update agent frontmatter
  5. Save to config/skills.json
```

### MCP Configuration

```
FOR EACH agent generated:
  1. Check if uses external libraries
  2. If yes, add context7 to mcp
  3. Save to config/mcp-servers.json
```
