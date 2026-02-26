---
description: "Report and track a bug with auto-priority (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "Task", "AskUserQuestion"]
user-invocable: true
---

## Workflow

1. If no description provided, ASK the user for details
2. Run `prjct bug "$ARGUMENTS" --md`
3. Search the codebase for affected files
4. ASK: "Fix this bug now?" Fix now / Queue for later
5. If fix now: create branch `bug/{slug}` and start working
6. If queue: done — bug is tracked
