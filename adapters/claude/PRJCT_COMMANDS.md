# PRJCT Commands for Claude Code

When you see /p:\* commands, execute these actions using filesystem operations:

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
