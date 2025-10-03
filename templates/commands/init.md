---
allowed-tools: [Read, Write, Bash]
description: "Initialize prjct project"
---

# /p:init

## Flow
1. Generate: project ID from path hash
2. Create: `~/.prjct-cli/projects/{id}/` structure
3. Write: `.prjct/prjct.config.json`
4. Init: all markdown files with templates
5. Log: `memory/context.jsonl`

## Directory Structure
```
~/.prjct-cli/projects/{id}/
├── core/          # now.md, next.md, context.md
├── progress/      # shipped.md, metrics.md
├── planning/      # ideas.md, roadmap.md
├── analysis/      # repo-summary.md
└── memory/        # context.jsonl
```

## Config Format
```json
{
  "version": "0.6.0",
  "projectId": "{id}",
  "dataPath": "~/.prjct-cli/projects/{id}",
  "author": {
    "name": "{from git}",
    "email": "{from git}",
    "github": "{from remote}"
  }
}
```

## Response
```
✅ prjct initialized!

📁 Data: ~/.prjct-cli/projects/{id}
📝 Config: .prjct/prjct.config.json

/p:now | /p:idea | /p:status
```

