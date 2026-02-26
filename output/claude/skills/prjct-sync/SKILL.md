---
description: "Re-analyze project and regenerate context (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "AskUserQuestion"]
user-invocable: true
---

## Workflow

```bash
prjct sync $ARGUMENTS --md
```
Read CLI output for analysis results.
Present results: tables, analysis findings, anti-patterns, conventions.

## What sync does
- Git analysis (branch, changes, recent commits)
- Project stats (files, stack, frameworks)
- Skill regeneration (this skill and others)
- Index building (BM25, import graph, co-change)
- Pattern extraction and analysis
