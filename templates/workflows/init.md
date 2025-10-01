---
title: prjct init
invocable_name: p:init
description: Initialize prjct in current project with global architecture
---

# Steps

1. Check if project already initialized (`.prjct/prjct.config.json` exists)
2. If exists, display current configuration and exit
3. Generate unique project ID from path hash
4. Detect author information:
   - Try GitHub CLI: `gh api user` for username
   - Fallback to git config: `git config user.name` and `git config user.email`
5. Create global directory structure in `~/.prjct-cli/projects/{id}/`:
   - `core/` - now.md, next.md, context.md
   - `progress/` - shipped.md, metrics.md
   - `planning/` - ideas.md, roadmap.md
   - `analysis/` - repo-summary.md
   - `memory/` - context.jsonl
6. Create local config at `.prjct/prjct.config.json` with:
   - version: "0.2.1"
   - projectId
   - dataPath
   - author info
   - timestamps
7. Detect installed AI editors (Claude Code, Cursor, Codex, Windsurf)
8. Install commands in all detected editors
9. Display success message with next steps

# Response Format

```
✅ prjct initialized successfully!

🆔 Project ID: {hash-id}
👤 Author: {name} ({github})
💾 Data location: ~/.prjct-cli/projects/{id}/

📦 Commands installed in:
- ✓ Claude Code (~/.claude/commands/p/)
- ✓ Cursor AI (~/.cursor/commands/p/)
- ✓ OpenAI Codex (AGENTS.md)
- ✓ Windsurf/Codeium (.windsurf/workflows/)

🚀 Ready to start! Try:
- /p:now {task} - Set your current focus
- /p:idea {text} - Capture quick ideas
- /p:recap - See project overview
```

# Global Architecture Created

```
~/.prjct-cli/projects/{id}/
├── core/
│   ├── now.md (empty)
│   ├── next.md (template)
│   └── context.md (project info)
├── progress/
│   ├── shipped.md (empty)
│   └── metrics.md (initial stats)
├── planning/
│   ├── ideas.md (empty)
│   └── roadmap.md (template)
├── analysis/
│   └── repo-summary.md (generated)
└── memory/
    └── context.jsonl (init log)

.prjct/
└── prjct.config.json (project config)
```

# Error Handling

- If `.prjct/` exists but corrupted: Offer migration
- If author detection fails: Prompt for manual input
- If directory creation fails: Check permissions
- If editor installation fails: Continue with warning
