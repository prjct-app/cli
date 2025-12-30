---
deprecated: true
redirect-to: 'task'
allowed-tools: [Read]
description: 'DEPRECATED - Use /p:task instead'
---

# /p:feature - DEPRECATED

**This command has been deprecated. Use `/p:task` instead.**

The `/p:task` command provides everything `/p:feature` did, plus:
- Automatic type classification (the agent determines if it's a feature, bug, etc.)
- Same 7-phase development workflow
- Git branch management
- Task breakdown and tracking

## Migration

Replace your usage:
```
/p:feature "add authentication"  ->  /p:task "add authentication"
/p:feature "dark mode toggle"    ->  /p:task "dark mode toggle"
```

The agent will automatically classify these as `feature` type based on the description.

## Redirect

IF feature description provided:
  OUTPUT: "Redirecting to /p:task..."
  EXECUTE: /p:task "{feature}"

IF no feature description provided:
  OUTPUT:
  ```
  /p:feature is deprecated. Use /p:task instead.

  Example: /p:task "add user authentication"

  The agent will automatically:
  - Classify the task type (feature, bug, improvement, etc.)
  - Run the 7-phase workflow
  - Create appropriate git branch
  - Break down into subtasks
  ```
