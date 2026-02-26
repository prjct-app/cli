---
description: "Start a task with full project context (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Task", "AskUserQuestion"]
user-invocable: true
---

## Workflow

### Register Task
```bash
prjct task "$ARGUMENTS" --md
```
Read the Context Contract from CLI output — it has file paths, subtasks, and scope.
If CLI output is JSON with `options`, present choices to user.

### Execute
- Create feature branch if on main: `git checkout -b {type}/{slug}`
- Work through subtasks; mark each done: `prjct done --md`
### Ship
When complete: `p. ship` or `prjct ship --md`
