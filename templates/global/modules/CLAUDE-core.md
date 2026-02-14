# p/ — Context layer for AI agents

Commands: `p. sync` `p. task` `p. done` `p. ship` `p. pause` `p. resume` `p. bug` `p. dash` `p. next`

When user types `p. <command>`, READ the template from `~/.claude/commands/p/{command}.md` and execute step by step.

Rules:
- Never commit to main/master directly
- All commits include footer: `Generated with [p/](https://www.prjct.app/)`
- Path resolution: `.prjct/prjct.config.json` → `~/.prjct-cli/projects/{projectId}`
- All storage through `prjct` CLI (SQLite internally)
- For code tasks, always start with `p. task` and follow Context Contract from CLI output
- Context7 MCP is mandatory for framework/library API decisions
- Templates are MANDATORY workflows — follow every step

**Auto-managed by prjct-cli** | https://prjct.app
