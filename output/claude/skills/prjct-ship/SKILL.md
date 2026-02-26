---
description: "Ship feature: PR, version bump, changelog. Auto-completes active task if one exists before shipping. (prjct-cli, TypeScript)"
allowed-tools: ["Bash", "Read", "AskUserQuestion"]
user-invocable: true
---

## Workflow

### Pre-flight (BLOCKING)
1. Verify NOT on main/master: `git branch --show-current`
2. Verify GitHub auth: `gh auth status`

### Ship
```bash
prjct ship "$ARGUMENTS" --md
```
Review what will be committed, versioned, and PR'd.
ASK: "Ready to ship?" Yes / No / Show diff

### Finalize
- Commit with prjct footer: `Generated with [p/](https://www.prjct.app/)`
- Push and create PR
- Update issue tracker if linked
