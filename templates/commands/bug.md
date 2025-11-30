---
allowed-tools: [Read, Write, Task, Glob]
description: 'Report bug with auto-priority'
---

# /p:bug

## Agent Delegation (REQUIRED)

Before fixing a bug, delegate to specialist agent:

1. **List agents**: `Glob("~/.prjct-cli/projects/{projectId}/agents/*.md")`
2. **Analyze bug domain**: frontend, backend, database, etc.
3. **Delegate via Task tool**:

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent
    Read: ~/.prjct-cli/projects/{projectId}/agents/{agent}.md

    ## Bug
    {bug description}

    ## Flow
    1. Read agent file
    2. Apply expertise to fix bug
    3. Return fix
  '
)
```

## Severity Keywords
- **Critical**: crash, down, broken, production
- **High**: error, fail, issue
- **Medium**: bug, incorrect
- **Low**: minor, typo

## Flow
1. Detect severity → Format: `🐛 [LEVEL] {desc}`
2. Insert: top if critical/high, bottom if med/low
3. Update `core/next.md` + log

## Response
`🐛 {severity} | Queued #{position} | Start: /p:now`
