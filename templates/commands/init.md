---
allowed-tools: [Read, Write, Bash]
description: 'Initialize prjct'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:init

## Context Variables
- `{projectId}`: Generated unique ID (12 chars hex)
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{cwd}`: Current working directory (repository path)

## Flow

**Existing**: ID → dirs → config → analyze → agents
**Blank + idea**: ARCHITECT → analyze → recommend stack → create → roadmap

## Structure
`~/.prjct-cli/projects/{id}/`: core, progress, planning, analysis, agents, memory

## Config
`.prjct/prjct.config.json`: version, projectId, dataPath, author

## Step: Create project.json (REQUIRED)

This file is the source of truth for the web dashboard. It maps projectId → repoPath.

### Determine Project Name
- Try package.json → `name` field
- Try Cargo.toml → `[package] name`
- Try pyproject.toml → `[project] name`
- Fallback to directory name (last segment of current path)

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

## Response
`✅ Init | {stack} | {N} agents | Next: /p:feature or /p:help`

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🚀 Start first feature (RECOMMENDED) → /p:feature "{first_feature}"
2. 📊 See roadmap → /p:roadmap
3. 🔍 Review structure → /p:recap
4. 💡 Modify plan → Just tell me

💬 REMEMBER: Talk naturally! "Start with auth" / "Show roadmap" / "Add another feature"

Ready to start building? 🚀
