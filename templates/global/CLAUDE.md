<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Context layer for AI agents

Commands: `p. sync` `p. task` `p. done` `p. ship` `p. pause` `p. resume` `p. bug` `p. dash` `p. next` `p. jira` `p. linear` `p. status` + 25 more

When user types `p. <command>`, it invokes the `/p` slash command which loads and executes the correct template.

Rules:
- Never commit to main/master directly
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- Path resolution: `.prjct/prjct.config.json` → `~/.prjct-cli/projects/{projectId}`
- All storage through `prjct` CLI (SQLite internally)
- For code tasks, always start with `p. task` and follow Context Contract from CLI output
- Context7 MCP is mandatory for framework/library API decisions
- Templates are MANDATORY workflows — follow every step
- WORKFLOW IS MANDATORY: After completing work, ALWAYS run `p. ship`
- NEVER end a session without shipping or pausing

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
