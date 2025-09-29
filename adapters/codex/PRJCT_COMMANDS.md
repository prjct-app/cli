# PRJCT Commands for OpenAI Codex

When you see /p:* commands, execute these actions using filesystem operations:

## Command Implementations

### /p:init
Create .prjct/ directory structure with initial files (now.md, next.md, shipped.md, ideas.md, memory.jsonl)

### /p:now [task]
- Without task: Read and display current task from .prjct/now.md
- With task: Update .prjct/now.md with new task and timestamp

### /p:done
Mark current task complete, clear now.md, suggest next task from queue

### /p:ship <feature>
Add feature to .prjct/shipped.md with celebration message and update weekly count

### /p:next
Display prioritized task queue from .prjct/next.md

### /p:idea <text>
Capture idea to .prjct/ideas.md, optionally add to next queue if actionable

### /p:recap
Show project overview: current task, shipped features, queued tasks, ideas

### /p:progress [period]
Display progress metrics for specified period (day/week/month)

### /p:stuck <issue>
Provide contextual help based on the issue description

### /p:context
Show project context and recent actions from memory.jsonl

## Response Format
Always respond with emoji-enhanced messages and suggest next actions to maintain momentum.

## Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/p:init` | Initialize project | `/p:init` |
| `/p:now` | Get/set current task | `/p:now implement auth` |
| `/p:done` | Complete current task | `/p:done` |
| `/p:ship` | Ship a feature | `/p:ship user authentication` |
| `/p:next` | Show task queue | `/p:next` |
| `/p:idea` | Capture an idea | `/p:idea add dark mode` |
| `/p:recap` | Project overview | `/p:recap` |
| `/p:progress` | Show metrics | `/p:progress week` |
| `/p:stuck` | Get help | `/p:stuck debugging auth` |
| `/p:context` | Project context | `/p:context` |

## File Locations

All project management files are stored in the `.prjct/` directory:
- `.prjct/now.md` - Current task
- `.prjct/next.md` - Task queue
- `.prjct/shipped.md` - Completed features
- `.prjct/ideas.md` - Idea capture
- `.prjct/memory.jsonl` - Activity log

## Integration with OpenAI Codex

This adapter enables prjct commands within OpenAI Codex environments:
1. Commands are executed through filesystem operations
2. All data is stored locally in the project
3. No external dependencies required
4. Works in sandboxed Codex containers

For detailed implementation, see the main AGENTS.md file in the repository root.