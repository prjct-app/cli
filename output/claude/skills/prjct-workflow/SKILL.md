---
description: "Configures workflow gates, hooks, steps, and instructions via natural language (English/Spanish). Use when the user wants to customize the task→done→ship cycle with before/after hooks, quality gates, or custom steps. (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "AskUserQuestion"]
user-invocable: true
---

## Workflow

```bash
prjct workflow "$ARGUMENTS" --md
```
Read CLI output for hook configuration results.

Supports natural language in English and Spanish:
- "before ship, run tests"
- "antes de ship, correr tests"
- Gates: block transitions until conditions are met
- Hooks: run commands before/after state transitions
- Steps: add custom workflow stages
