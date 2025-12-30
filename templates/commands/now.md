---
deprecated: true
redirect-to: 'task'
allowed-tools: [Read]
description: 'DEPRECATED - Use /p:task instead'
---

# /p:now - DEPRECATED

**This command has been deprecated. Use `/p:task` instead.**

The `/p:task` command provides:
- Automatic type classification (feature, bug, improvement, refactor, chore)
- 7-phase development workflow
- Git branch management
- Task breakdown and tracking

## Migration

Replace your usage:
```
/p:now "fix login bug"     ->  /p:task "fix login bug"
/p:now "add dark mode"     ->  /p:task "add dark mode"
```

## Redirect

IF task provided:
  OUTPUT: "Redirecting to /p:task..."
  EXECUTE: /p:task "{task}"

IF no task provided:
  READ: `.prjct/prjct.config.json` -> extract `projectId`
  IF missing: "No prjct project. Run /p:init first." -> STOP

  SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`
  READ: `{globalPath}/storage/state.json`

  IF currentTask exists AND status == "active":
    OUTPUT:
    ```
    Now: {currentTask.description}
    Type: {currentTask.type}

    Started: {elapsed} ago
    Branch: {branch.name}

    /p:done to complete | /p:pause to pause

    Note: /p:now is deprecated. Use /p:task for new tasks.
    ```
  ELSE:
    OUTPUT: "No current task. Use /p:task <description> to start one."
