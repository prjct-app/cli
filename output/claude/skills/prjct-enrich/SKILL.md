---
description: "Finds relevant files for issues by analyzing local code. Input to linear/jira sync pipeline. (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "AskUserQuestion"]
user-invocable: true
---

## Workflow

```bash
prjct enrich "$ARGUMENTS" --md
```
Read CLI output for enrichment data.
