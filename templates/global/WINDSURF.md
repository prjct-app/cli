---
trigger: always_on
description: "prjct - Context layer for AI coding agents"
---

<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Context layer for AI agents

Workflows: `/sync` `/task` `/done` `/ship` `/pause` `/resume` `/bug` `/dash` `/next`

When user triggers a workflow, execute the corresponding prjct CLI command with `--md` flag for context.

Rules:
- Never commit to main/master directly
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- Path resolution: `.prjct/prjct.config.json` → `~/.prjct-cli/projects/{projectId}`
- All storage through `prjct` CLI (SQLite internally)

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
