---
description: "Marks the current task as complete and feeds the feedback loop. Use when the user says "done", "finished", "ship it", or wants to complete current work. Completion data flows to sync → skill regeneration. (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "AskUserQuestion"]
user-invocable: true
---

## Workflow

```bash
prjct done "$ARGUMENTS" --md
```
Read CLI output for completion summary and next steps.
